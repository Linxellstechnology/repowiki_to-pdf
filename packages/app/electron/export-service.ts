/**
 * Service d'export PDF (Task 12) — orchestration du pipeline spec §5 :
 *
 *   scan → plan/TOC → rendu markdown par page (images embarquées, liens
 *   réécrits, ancres connues) → composition document unique (cover + TOC +
 *   sections + thème) → rendu Mermaid offscreen (SVGs inline, fallbacks
 *   révélés) → printToPDF (A4/Letter, marges et pieds de page figés par le
 *   brief) → locateSections (repères §§p-00N§§) + outline + polishPdf → écriture.
 *
 * Ce fichier ne réimplémente AUCUNE brique : ce sont les fonctions testées de
 * `@repowiki-pdf/core` et `@repowiki-pdf/theme`, orchestration uniquement.
 * Les APIs Electron vivent ici (et protocol.ts/assets.ts/offscreen.ts), jamais
 * dans core (contrainte globale).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildToc,
  composeDocument,
  embedImages,
  flattenToc,
  locateSections,
  parsePlan,
  parseWikiMeta,
  pdfCopyFor,
  polishPdf,
  renderPageMarkdown,
  repairMermaidSource,
  rewriteLinks,
  scanProject,
} from '@repowiki-pdf/core';
import type {
  CoreWarning,
  OutlineItem,
  RenderedPage,
  SectionMark,
  TocNode,
} from '@repowiki-pdf/core';
import { loadThemeCss } from '@repowiki-pdf/theme';
import { BrowserWindow } from 'electron';
import type { PrintToPDFOptions } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { RpcError } from '../src/ipc.js';
import type { ExportOptions, ExportResult, ProgressEvent } from '../src/ipc.js';
import { OFFSCREEN_PAGE_URL } from './offscreen.js';
import type { OffscreenRenderResult } from './offscreen.js';

/** Ce que la phase « préparation » (étapes a–d) produit pour print & preview. */
interface PreparedDocument {
  html: string;
  marks: SectionMark[];
  toc: TocNode[];
  projectName: string;
  warnings: CoreWarning[];
}

type Emit = (progress: ProgressEvent) => void;

/**
 * Étapes a–d du pipeline (ruling n°2) : scan, plan/TOC, rendu HTML de chaque
 * page feuilleton (embedImages + rewriteLinks avec l'ensemble des ancres de
 * titres produites), composition du document unique avec le thème.
 */
async function prepareDocument(
  opts: ExportOptions,
  emit: Emit,
): Promise<PreparedDocument> {
  // a. scan + sélection de la langue
  const scan = await scanProject(opts.projectRoot);
  const langScan = scan.languages.find((l) => l.language === opts.language);
  if (!langScan) {
    throw new RpcError(
      `Langage « ${opts.language} » absent du wiki (langues disponibles : ${scan.languages
        .map((l) => l.language)
        .join(', ')}).`,
      'LANGUAGE_MISSING',
      {
        language: opts.language,
        available: scan.languages.map((l) => l.language).join(', '),
      },
    );
  }

  // 0.1.11 : chrome du PDF (couverture, TOC, replis visibles) dans la langue
  // du WIKI sélectionné — jamais celle de l'interface.
  const copy = pdfCopyFor(opts.language);

  const warnings: CoreWarning[] = [];

  // b. plan → TOC (chaîne de repli ADR-0007 : wiki_plan.yaml →
  //    <lang>/meta/repowiki-metadata.json → ordre des fichiers).
  const plan = await parsePlan(scan.planPath);
  const meta = await parseWikiMeta(langScan.metaPath);
  const built = buildToc(plan, langScan.files, {
    metaTitles: meta?.titles,
    contentDir: langScan.contentDir,
  });
  warnings.push(...built.warnings);

  // c. feuilles de l'arbo TOC (DFS) = pages physiques à rendre
  const flatLeaves = flattenToc(built.toc).filter(
    (n): n is TocNode & { filePath: string } => n.filePath !== null,
  );

  // c1. rendu markdown de chaque page ; collecte de TOUTES les ancres de titres
  //     (`id="<pageId>--<slug>"` produites par renderPageMarkdown, Task 5) pour
  //     que rewriteLinks puisse valider les liens cross-page à fragment.
  interface Draft {
    node: TocNode & { filePath: string };
    html: string;
  }
  const drafts: Draft[] = [];
  const knownAnchors = new Set<string>();
  for (const node of flatLeaves) {
    const md = await fs.readFile(node.filePath, 'utf8');
    const rendered = renderPageMarkdown(md, node.id, {
      mermaidFallbackTitle: copy.mermaidFallbackTitle,
    });
    drafts.push({ node, html: rendered.html });
    for (const match of rendered.html.matchAll(/id="([^"]+)"/g)) {
      const id = match[1];
      if (id) knownAnchors.add(id);
    }
  }

  // c2. embarquement des images (data-URI) puis réécriture des liens, puis
  //     progression `render` page par page.
  const pages = new Map<string, RenderedPage>();
  const total = drafts.length;
  let done = 0;
  for (const draft of drafts) {
    const pageDir = path.dirname(draft.node.filePath);
    const withImages = await embedImages(draft.html, pageDir, warnings);
    const html = rewriteLinks(
      withImages,
      pageDir,
      built.fileToPageId,
      warnings,
      knownAnchors,
    );
    pages.set(draft.node.id, {
      id: draft.node.id,
      title: draft.node.title,
      html,
    });
    done += 1;
    emit({
      phase: 'render',
      page: done,
      total,
      title: draft.node.title,
      label: `Rendu de la page ${done}/${total} : ${draft.node.title}`,
    });
  }

  // d. composition du document unique (cover + TOC + sections marquées)
  const css = await loadThemeCss();
  const composed = composeDocument({
    projectName: scan.projectName,
    languageLabel: langScan.language,
    dateLabel: new Date().toISOString().slice(0, 10),
    toc: built.toc,
    pages,
    css,
  });

  // Choix minimal documenté (ruling n°2.d) : `composeDocument` émet toujours la
  // page de garde (Task 8) ; `includeCover: false` la retire par simple coupe du
  // <section class="cover"> — la page TOC reste.
  const html = opts.includeCover
    ? composed.html
    : composed.html.replace(
        /<section class="cover">[\s\S]*?<\/section>\n?/,
        '',
      );

  return {
    html,
    marks: composed.marks,
    toc: built.toc,
    projectName: scan.projectName,
    warnings,
  };
}

/**
 * Fenêtre offscreen éphémère : chargée via `wikiapp://` (protocole privé,
 * ruling n°5), passée au callback, détruite inconditionnellement.
 */
async function withOffscreenWindow<T>(
  fn: (win: BrowserWindow) => Promise<T>,
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadURL(OFFSCREEN_PAGE_URL);
    return await fn(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/** Options d'impression exactes du brief (ruling n°2.f). */
export function printOptionsFor(pageSize: 'A4' | 'Letter'): PrintToPDFOptions {
  // Correctif Task 14 (diagnostic probe3, Electron 33 / Windows) : l'API
  // printToPDF n'AUCUN champ top-level `width`/`height` (voir electron.d.ts :
  // la taille se passe via `pageSize`, nommée ou objet {width,height} en
  // pouces). L'ancien code passait width/height par spread — ignorés
  // silencieusement, sortie Letter (612x792) même pour A4 demandé. Vérifié
  // empiriquement : `pageSize: 'A4'` → 595.92x842.88.
  return {
    pageSize,
    margins: { top: 0.6, bottom: 0.7, left: 0.85, right: 0.6 },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;text-align:center;font-size:7px;color:#656d76"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  };
}

/** Étape e : rendu Mermaid réel dans la fenêtre déjà chargée. */
async function renderMermaidInWindow(
  win: BrowserWindow,
  html: string,
  repairs?: Record<string, string>,
): Promise<OffscreenRenderResult> {
  // executeJavaScript attend la promesse retournée par renderDocument ; le
  // résultat est sérialisable (structured clone). Les deux arguments (html,
  // Map index→source réparée) sont des chaînes JSON plates — payload 100 %
  // sérialisable (contrainte Task 0.1.3 / ADR-0008).
  const repairsArg =
    repairs === undefined ? '' : `, ${JSON.stringify(repairs)}`;
  const result: OffscreenRenderResult = await win.webContents.executeJavaScript(
    `window.renderDocument(${JSON.stringify(html)}${repairsArg})`,
  );
  return result;
}

/** Résultat de l'étape e avec la double passe « réparation » (ADR-0008). */
interface MermaidRenderOutcome {
  /** HTML final (celui dont on imprime le DOM). */
  html: string;
  /** Blocs toujours échoués APRÈS la seconde passe éventuelle. */
  failed: OffscreenRenderResult['failed'];
  /** Blocs d'abord échoués, rendus OK grâce à leur source réparée. */
  repaired: OffscreenRenderResult['failed'];
}

/**
 * Étape e complète : passe 1 brute ; si des blocs échouent ET que
 * `repairMermaidSource` (core) propose une réécriture validée pour l'un
 * d'eux, on rejoue le document ENTIER dans la même fenêtre (reset
 * déterministe du DOM côté offscreen) avec la Map index→source réparée.
 * Un bloc jamais réparé n'est jamais touché — les sources valides restent
 * bit-à-bit inchangées (garantie du no-op `null`).
 */
async function renderMermaidWithRepair(
  win: BrowserWindow,
  html: string,
): Promise<MermaidRenderOutcome> {
  const first = await renderMermaidInWindow(win, html);
  if (first.failed.length === 0) {
    return { html: first.html, failed: [], repaired: [] };
  }
  const repairs: Record<string, string> = {};
  for (const f of first.failed) {
    const repairedSrc = repairMermaidSource(f.raw);
    if (repairedSrc !== null) repairs[String(f.index)] = repairedSrc;
  }
  if (Object.keys(repairs).length === 0) {
    // Rien que le dialecte ne connaisse : fallback + MERMAID_INVALID classiques.
    return { html: first.html, failed: first.failed, repaired: [] };
  }
  const second = await renderMermaidInWindow(win, html, repairs);
  const stillFailed = new Set(second.failed.map((f) => f.index));
  const repaired = first.failed.filter(
    (f) => repairs[String(f.index)] !== undefined && !stillFailed.has(f.index),
  );
  return { html: second.html, failed: second.failed, repaired };
}

function mermaidWarnings(
  failed: OffscreenRenderResult['failed'],
  warnings: CoreWarning[],
  repaired: OffscreenRenderResult['failed'] = [],
): void {
  // Task 0.1.3 (ADR-0008) : blocs adaptés par la double passe → warning
  // dédié, visible, avec l'extrait de la source d'origine (≤ 120 car).
  for (const r of repaired) {
    warnings.push({
      code: 'MERMAID_REPAIRED',
      vars: { src: r.src },
      message: `Diagramme adapté (syntaxe non standard Qoder) — source: ${r.src}`,
      page: r.pageId ?? undefined,
    });
  }
  for (const f of failed) {
    // Task 0.1.3 : le warning porte le VRAI message de mermaid (Parse error
    // sur la ligne N, jeton attendu…) + un extrait single-line de la source,
    // pour diagnostiquer un « lisible dans Qoder, invalide ici » sans code.
    const error = typeof f.error === 'string' ? f.error.slice(0, 300) : '';
    const src = typeof f.src === 'string' ? f.src.slice(0, 120) : '';
    warnings.push({
      code: 'MERMAID_INVALID',
      vars: { error, src },
      message: `${error} — source: ${src}`,
      page: f.pageId ?? undefined,
    });
  }
}

/**
 * Pipeline complet : produit un vrai PDF (étapes a–h, ruling n°2).
 * N'écrit AUCUN fichier avant l'étape h.
 */
export async function runExport(
  opts: ExportOptions,
  emit: Emit,
): Promise<ExportResult> {
  const prepared = await prepareDocument(opts, emit);
  const { warnings } = prepared;

  // e + f : même fenêtre offscreen — printToPDF s'exécute APRÈS que les SVGs
  // Mermaid sont injectés dans le DOM (ruling n°5), sur le DOM rendu.
  emit({
    phase: 'mermaid',
    label: 'Rendu offscreen des diagrammes Mermaid…',
  });
  const { pdf } = await withOffscreenWindow(async (win) => {
    const outcome = await renderMermaidWithRepair(win, prepared.html);
    mermaidWarnings(outcome.failed, warnings, outcome.repaired);
    emit({ phase: 'print', label: 'Impression du PDF…' });
    const buffer = await win.webContents.printToPDF(
      printOptionsFor(opts.pageSize),
    );
    return { pdf: new Uint8Array(buffer) };
  });

  // g : localisation des sections via les repères §§<id>§§, puis signets +
  //     métadonnées. Un marqueur non trouvé = id absent de la Map, signet omis,
  //     warning SECTION_MARK_MISSING (choix minimal documenté).
  emit({
    phase: 'polish',
    label: 'Repérage des sections et ajout des signets…',
  });
  const found = await locateSections(pdf, prepared.marks, (id) => {
    warnings.push({
      code: 'SECTION_MARK_MISSING',
      vars: { id },
      message: `Repère de section ${id} introuvable dans le PDF ; signet omis.`,
      page: id,
    });
  });

  const outline: OutlineItem[] = [];
  // Racines couvertes (ruling n°2.g, minimal) : avec la cover, le CSS d'impression
  // (page-break-before) garantit cover = page 0 et TOC = page 1. SANS cover
  // (prepareDocument coupe la <section class="cover">), la page TOC existe
  // TOUJOURS dans le PDF et occupe désormais la page 0 → on garde son signet,
  // décalé, au lieu de le perdre.
  // 0.1.11 : libellés fixes du PDF (couverture/TOC) dans la LANGUE DU WIKI.
  const copy = pdfCopyFor(opts.language);
  if (opts.includeCover) {
    outline.push({ title: copy.cover, level: 1, pageIndex: 0 });
    outline.push({ title: copy.tocTitle, level: 1, pageIndex: 1 });
  } else {
    outline.push({ title: copy.tocTitle, level: 1, pageIndex: 0 });
  }
  for (const node of flattenToc(prepared.toc)) {
    const pageIndex = found.get(node.id);
    if (pageIndex === undefined) continue;
    outline.push({ title: node.title, level: node.level, pageIndex });
  }

  const polished = await polishPdf(pdf, outline, {
    title: `${prepared.projectName} — Documentation`,
    subject: `RepoWiki (${opts.language}) généré depuis .qoder/repowiki`,
  });
  const polishedDoc = await PDFDocument.load(polished);
  const pageCount = polishedDoc.getPageCount();

  // h : écriture dans outputDir (défaut : racine du projet scanné).
  // Windows lève EPERM sur mkdir('D:\', {recursive:true}) même quand la
  // racine existe : on ne crée le dossier que s'il est absent.
  emit({ phase: 'write', label: 'Écriture du fichier PDF…' });
  const outDir = opts.outputDir ?? opts.projectRoot;
  const dirStat = await fs.stat(outDir).catch(() => null);
  if (dirStat && !dirStat.isDirectory()) {
    throw new RpcError(
      `Output folder is not a directory: ${outDir}`,
      'OUTPUT_NOT_DIR',
      { path: outDir },
    );
  }
  if (!dirStat) {
    await fs.mkdir(outDir, { recursive: true });
  }
  const outputPath = path.join(
    outDir,
    `${prepared.projectName}-Documentation.pdf`,
  );
  try {
    await fs.writeFile(outputPath, polished);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new RpcError(
      `Cannot write ${outputPath} — ${detail}. Close the PDF if it is open in a reader, or pick another output folder.`,
      'WRITE_FAILED',
      { path: outputPath, detail },
    );
  }

  return { outputPath, pageCount, warnings };
}

/**
 * Étape 6 (ruling) : les étapes a–e uniquement — retourne le HTML final rendu
 * (SVGs Mermaid en place, fallbacks révélés) pour l'aperçu iframe de la Task 13.
 * N'écrit et n'imprime rien.
 */
export async function composePreviewHtml(opts: ExportOptions): Promise<string> {
  const noop: Emit = () => {};
  const prepared = await prepareDocument(opts, noop);
  const { html } = await withOffscreenWindow(async (win) => {
    const outcome = await renderMermaidWithRepair(win, prepared.html);
    return { html: outcome.html };
  });
  return html;
}
