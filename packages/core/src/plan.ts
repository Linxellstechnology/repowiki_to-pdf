import { existsSync, readdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import type {
  CoreWarning,
  PlanFile,
  TocNode,
  WikiPageFile,
  WikiPlanDocument,
} from './types.js';

interface RawPlanShape {
  repowiki?: { documents?: unknown };
  documents?: unknown;
}

/**
 * Le YAML est du contenu non maîtrisé : le cast `as WikiPlanDocument[]` ne
 * garantit rien à l'exécution. Une entrée `parent: 42` (non-string) ferait
 * planter `buildToc` sur `(42).toLowerCase()` → abort de tout l'export, en
 * violation de la spec §6 (« plan illisible → fallback ») / N1. On réduit donc
 * un `parent` non-string à `undefined` : le nœud est alors traité comme racine.
 * (Pas de warning dédié : la hiérarchie dégradée suffit, choix minimal.)
 */
function sanitizeParent(d: WikiPlanDocument): WikiPlanDocument {
  const parent: unknown = d.parent;
  return typeof parent === 'string' || parent === undefined
    ? d
    : { ...d, parent: undefined };
}

export async function parsePlan(
  planPath: string | null,
): Promise<PlanFile | null> {
  if (!planPath) return null;
  try {
    const raw = yaml.load(
      await fs.readFile(planPath, 'utf8'),
    ) as RawPlanShape | null;
    const docs = (raw?.repowiki?.documents ??
      raw?.documents ??
      []) as WikiPlanDocument[];
    return Array.isArray(docs)
      ? {
          documents: docs
            .filter((d) => d && typeof d.title === 'string')
            .map(sanitizeParent),
        }
      : null;
  } catch {
    return null; // spec §6 : plan illisible → fallback
  }
}

export function titleFromFilename(name: string): string {
  return name.replace(/^[\d]+([.][\d]+)*[\s.\-]+\s*/, '').trim() || name;
}

function makeCounter(): () => string {
  let n = 0;
  return () => `p-${String(++n).padStart(3, '0')}`;
}

export interface BuildTocOptions {
  metaTitles?: string[];
  contentDir?: string;
}

/**
 * Reconstruit la hiérarchie depuis l'arborescence du répertoire `content`
 * (Qoder récent : `<Title>.md` en racine = page ; `<Section>/<Section>.md` +
 * enfants = section), fratries ordonnées par l'index du titre dans les
 * catalogues Qoder (ids p-0NN en pré-ordre DFS de ce nouvel ordre). Les titres
 * absents du catalogue passent après les connus, en ordre localeCompare. Un
 * dossier sans page propre `<dirname>.md` devient un nœud titre seul
 * (filePath null) dont les enfants sont le contenu du dossier.
 */
function buildTocFromMeta(
  contentDir: string,
  metaTitles: string[],
  nextId: () => string,
  fileToPageId: Map<string, string>,
): TocNode[] {
  const rank = new Map<string, number>();
  for (let i = 0; i < metaTitles.length; i += 1) {
    const t = metaTitles[i];
    if (t !== undefined && !rank.has(t)) rank.set(t, i);
  }
  const indexOf = (title: string): number =>
    rank.get(title) ?? Number.POSITIVE_INFINITY;
  const compareSiblings = (a: string, b: string): number => {
    const ia = indexOf(a);
    const ib = indexOf(b);
    if (ia !== ib) return ia < ib ? -1 : 1;
    if (ia === Number.POSITIVE_INFINITY) return a.localeCompare(b);
    return 0;
  };

  const walk = (
    dir: string,
    level: number,
    ownPagePath: string | null,
  ): TocNode[] => {
    const entries: { title: string; filePath: string; isDir: boolean }[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        entries.push({ title: e.name, filePath: '', isDir: true });
      } else if (e.name.endsWith('.md')) {
        const filePath = path.join(dir, e.name);
        // la page propre de la section courante est absorbée par le nœud de
        // section (filePath du parent) : elle ne devient pas un enfant.
        if (filePath !== ownPagePath) {
          entries.push({
            title: e.name.slice(0, -'.md'.length),
            filePath,
            isDir: false,
          });
        }
      }
    }
    entries.sort((a, b) => compareSiblings(a.title, b.title));
    return entries.map((t) => {
      const id = nextId();
      if (!t.isDir) {
        fileToPageId.set(t.filePath, id);
        return {
          id,
          title: t.title,
          filePath: t.filePath,
          level,
          children: [],
        };
      }
      const dirPath = path.join(dir, t.title);
      const ownMd = path.join(dirPath, `${t.title}.md`);
      const hasOwn = existsSync(ownMd);
      const children = walk(dirPath, level + 1, hasOwn ? ownMd : null);
      if (hasOwn) fileToPageId.set(ownMd, id);
      return {
        id,
        title: t.title,
        filePath: hasOwn ? ownMd : null,
        level,
        children,
      };
    });
  };

  return walk(contentDir, 1, null);
}

export function buildToc(
  plan: PlanFile | null,
  files: WikiPageFile[],
  opts: BuildTocOptions = {},
): {
  toc: TocNode[];
  fileToPageId: Map<string, string>;
  warnings: CoreWarning[];
} {
  const warnings: CoreWarning[] = [];
  const byTitle = new Map<string, WikiPageFile>();
  for (const f of files)
    byTitle.set(titleFromFilename(f.name).toLowerCase(), f);
  const nextId = makeCounter();
  const fileToPageId = new Map<string, string>();
  const nodeFor = (
    title: string,
    file: WikiPageFile,
    level: number,
  ): TocNode => {
    const id = nextId();
    fileToPageId.set(file.path, id);
    return { id, title, filePath: file.path, level, children: [] };
  };

  if (plan === null) {
    // Chaîne de repli (ADR-0007) : wiki_plan.yaml → repowiki-metadata.json
    // (hiérarchie = arborescence content/, ordre = catalogues Qoder) → ordre
    // des fichiers.
    const metaTitles = opts.metaTitles ?? [];
    if (
      metaTitles.length > 0 &&
      opts.contentDir !== undefined &&
      existsSync(opts.contentDir)
    ) {
      warnings.push({
        code: 'PLAN_METADATA_USED',
        message:
          'wiki_plan.yaml absent — hiérarchie reconstruite depuis repowiki-metadata.json (ordre des catalogues Qoder).',
      });
      const toc = buildTocFromMeta(
        opts.contentDir,
        metaTitles,
        nextId,
        fileToPageId,
      );
      return { toc, fileToPageId, warnings };
    }
    warnings.push({
      code: 'PLAN_MISSING',
      message:
        'wiki_plan.yaml absent ou illisible — TOC reconstruite depuis l’ordre des fichiers.',
    });
    const toc = files.map((f) => nodeFor(titleFromFilename(f.name), f, 1));
    return { toc, fileToPageId, warnings };
  }

  const toc: TocNode[] = [];
  const usedFiles = new Set<string>();
  const planNodes = new Map<string, TocNode>();
  for (const d of plan.documents) {
    const file = byTitle.get(d.title.toLowerCase());
    if (!file) {
      warnings.push({
        code: 'PLAN_TITLE_UNMATCHED',
        message: `« ${d.title} » du plan ne correspond à aucun fichier.`,
      });
      continue;
    }
    const parent = d.parent ? planNodes.get(d.parent.toLowerCase()) : undefined;
    const node = nodeFor(d.title, file, parent ? parent.level + 1 : 1);
    usedFiles.add(file.path);
    planNodes.set(d.title.toLowerCase(), node);
    if (parent) parent.children.push(node);
    else toc.push(node);
  }
  for (const f of files) {
    if (!usedFiles.has(f.path)) {
      warnings.push({
        code: 'PAGE_NOT_IN_PLAN',
        page: f.name,
        message: `« ${f.name} » ajoutée en fin de TOC (absente du plan).`,
      });
      toc.push(nodeFor(titleFromFilename(f.name), f, 1));
    }
  }
  return { toc, fileToPageId, warnings };
}
