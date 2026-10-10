/**
 * Task 14 — assertions structurelles du PDF d'intégration (`out/integration.pdf`),
 * produit par `integration/run-export.ts` (Electron headless, fixture régénéré
 * par `createFixtureProject` de `@repowiki-pdf/core` dans un tmpdir — 0.1.8).
 * Node pur : pdf-lib + pdfjs-dist (résolus via le
 * hoisting du workspace, comme `packages/core/src/pdf.ts`).
 *
 * Chaque check imprime `PASS <nom>` ; toute assertion échouée imprime
 * `FAIL <nom> — <détails>` et le process sort en code 1 (fin de process après
 * le dump complet pour le rapport).
 *
 * NOTE Task 14 (doc dans le rapport) — encodage RÉEL des liens internes observé
 * sur le PDF produit : Chromium (printToPDF, Electron 33) n'émet PAS d'action
 * `/A { /S /GoTo }` ; il émet des annotations `/Link` avec `/Dest /<nom>`
 * (destination NOMMÉE) résolue par l'arbre `/Dests` du catalogue — le
 * mécanisme GoTo natif prévu par PDF 32000-1 §12.3.2 (« either /Dest or /A »).
 * Les liens sont donc cliquables et fonctionnels ; l'assertion « /Link /S /D »
 * du brief, écrite en anticipant un encodage précis, vérifie ici le mécanisme
 * réel : /Subtype /Link + /Dest (ou /A /S /GoTo), /Dest résolvable dans
 * l'arbre /Dests, ≥ 4 sur la page TOC.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { VerbosityLevel, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.resolve(here, '../../../out/integration.pdf');

const failures = [];
let checkIndex = 0;
const results = [];
async function check(name, fn) {
  checkIndex += 1;
  try {
    const detail = await fn();
    results.push([`PASS ${name}${detail ? ` (${detail})` : ''}`, 1]);
  } catch (err) {
    failures.push(`${name} — ${err.message}`);
    results.push([`FAIL ${name} — ${err.message}`, 0]);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Chargements (deux vues complémentaires) ---------------------------------
const bytes = new Uint8Array(await fs.readFile(pdfPath));
const pdfDoc = await PDFDocument.load(bytes.slice());
const jsDoc = await getDocument({
  data: bytes.slice(),
  verbosity: VerbosityLevel.ERRORS,
}).promise;

// util : dictionnaire de bas niveau d'une page (pdf-lib n'expose pas /Annots).
// ATTENTION Task 0.1.3 : Skia (printToPDF, Chromium/Electron 33) CHUNKES le
// /Pages en nœuds intermédiaires de 8 Kids maximum — un document de 9 pages a
// donc une arborescence NIÉE (nœud de 8 + 1 feuille directe), alors que 8 pages
// restent plates. Les checks #5/#6 (annots bruts) exigent une descente
// RÉCURSIVE de l'arbre, feuilles dans l'ordre documentaire.
function leafPageDicts(doc) {
  const dicts = [];
  const refs = [];
  const visit = (node, ref) => {
    if (!(node instanceof PDFDict)) return;
    const kidsV = node.get(PDFName.of('Kids'));
    if (!kidsV) {
      dicts.push(node); // feuille
      refs.push(String(ref));
      return;
    }
    const kids = doc.context.lookup(kidsV);
    if (!(kids instanceof PDFArray)) return;
    for (let i = 0; i < kids.size(); i++) {
      const childRef = kids.get(i);
      visit(doc.context.lookup(childRef), childRef);
    }
  };
  visit(doc.context.lookup(doc.catalog.get(PDFName.of('Pages'))), null);
  return { dicts, refs };
}
const leafPages = leafPageDicts(pdfDoc);
function pageNode(doc, index) {
  const pageDict = leafPages.dicts[index];
  assert(pageDict instanceof PDFDict, 'page dict absent');
  return pageDict;
}
// annots = [{ ref, dict }] pour la page (index 0-based)
function annotsOf(doc, index) {
  const node = pageNode(doc, index);
  const arr = doc.context.lookup(node.get(PDFName.of('Annots')));
  if (!(arr instanceof PDFArray)) return [];
  const out = [];
  for (let i = 0; i < arr.size(); i++) {
    const ref = arr.get(i);
    const dict = doc.context.lookup(ref);
    if (dict instanceof PDFDict) out.push({ ref, dict });
  }
  return out;
}
// destinations nommées → refs de page, via l'arbre /Dests du catalogue
// (structure dict { /nom: [refPage /XYZ x y z] }) observé sur le PDF produit.
function destNameRefs(doc) {
  const map = new Map();
  const destsRef = doc.catalog.get(PDFName.of('Dests'));
  if (!destsRef) return map;
  const dests = doc.context.lookup(destsRef);
  if (!(dests instanceof PDFDict)) return map;
  for (const [key, value] of dests.entries()) {
    const name = key.toString().replace(/^\//, '');
    if (value instanceof PDFRef) {
      const target = doc.context.lookup(value);
      if (target instanceof PDFArray && target.size() >= 1) {
        map.set(name, target.get(0));
      }
    } else if (value instanceof PDFArray && value.size() >= 1) {
      map.set(name, value.get(0));
    }
  }
  return map;
}
async function pageText(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  const { items } = await page.getTextContent();
  return items.map((it) => ('str' in it ? it.str : '')).join('');
}

// 1. Toutes les pages A4 : largeur ≈ 595 ± 2, hauteur ≈ 842 ± 2 (pdf-lib).
await check('pages-toutes-A4', () => {
  const sizes = pdfDoc.getPages().map((p) => p.getSize());
  for (const [i, s] of sizes.entries()) {
    assert(
      Math.abs(s.width - 595) <= 2 && Math.abs(s.height - 842) <= 2,
      `page ${i + 1} = ${Math.round(s.width)}x${Math.round(s.height)} pt`,
    );
  }
  return `${sizes.length} pages A4`;
});

// 2. Page 1 = couverture avec le nom du projet.
await check('couverture-fake-project', async () => {
  const t = await pageText(jsDoc, 1);
  assert(t.includes('fake-project'), 'page 1 sans « fake-project »');
  return 'page 1 OK';
});

// 3. TOUTES les pages de section wiki (marquées §§p-0NN§§) ont leur repère
//    extractible — le blanc #ffffff survit à l'impression (cf. offscreen.ts).
const markerPages = new Map();
await check('marqueurs-section-extractibles-5sur5', async () => {
  for (let i = 1; i <= jsDoc.numPages; i++) {
    const t = await pageText(jsDoc, i);
    for (const m of t.matchAll(/§§(p-\d{3})§§/g)) {
      markerPages.set(m[1], i);
    }
  }
  assert(
    markerPages.size >= 5,
    `${markerPages.size} marqueurs (${[...markerPages.keys()].join(',')})`,
  );
  return `${markerPages.size} sections localisées : ${[...markerPages].map(([k, v]) => `${k}@p${v}`).join(' ')}`;
});

// 4. Signets ≥ 3 (pdfjs getOutline).
await check('signets-min-3', async () => {
  const outline = await jsDoc.getOutline();
  assert(outline && outline.length >= 3, `outline = ${outline?.length ?? 0}`);
  return `${outline.length} signets`;
});

// 5. Liens internes ≥ 4 sur la page TOC : /Subtype /Link + /Dest (ou /A /S /GoTo),
//    et CHAQUE lien compté doit résoudre une destination réelle : nom /Dests
//    présent (sinon lien mort = FAIL), puis ref de page membre de /Pages Kids.
//    L'assertion est inconditionnelle par lien (aucun skip /A GoTo, aucun guard
//    destRefs.has) — le test échoue si Chromium émet une destination absente.
const destRefs = destNameRefs(pdfDoc);
const tocPage = await (async () => {
  for (let i = 1; i <= jsDoc.numPages; i++) {
    if ((await pageText(jsDoc, i)).includes('Table des matières')) return i;
  }
  throw new Error('page TOC introuvable');
})();
await check('liens-internes-toc-min-4', () => {
  assert(tocPage >= 1, 'page TOC non trouvée');
  const annots = annotsOf(pdfDoc, tocPage - 1);
  const internal = [];
  for (const { dict } of annots) {
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue;
    const destVal = dict.get(PDFName.of('Dest'));
    const action = dict.get(PDFName.of('A'));
    if (action instanceof PDFDict) {
      const s = action.get(PDFName.of('S'));
      const d = action.get(PDFName.of('D'));
      if (s === PDFName.of('GoTo') && d) {
        internal.push({ via: '/A GoTo', dest: d });
      }
    } else if (destVal) {
      internal.push({ via: '/Dest', dest: destVal });
    }
  }
  assert(internal.length >= 4, `=${internal.length}`);
  // refs des feuilles de l'arbre /Pages (descente récursive, cf. leafPages) :
  // une destination valide = ref membre des feuilles.
  const kidRefs = leafPages.refs;
  // Résout la valeur brute d'une destination (/Dest ou /A /D) en ref de page.
  // Les deux encodages sont acceptés (rien n'est ignoré silencieusement) :
  // - destination INLINE : [refPage /XYZ x y z] (forme autorisée §12.3.2),
  // - ref DIRECTE vers la page ou le tableau de destination,
  // - destination NOMMÉE (/Dest /nom ou /D /nom) : le nom DOIT exister dans
  //   l'arbre /Dests du catalogue — sinon c'est un lien mort → assert FAIL.
  const pageRefForDest = (raw, label) => {
    if (raw instanceof PDFArray && raw.size() >= 1) return raw.get(0);
    if (raw instanceof PDFRef) {
      const target = pdfDoc.context.lookup(raw);
      if (target instanceof PDFArray && target.size() >= 1)
        return target.get(0);
      return raw;
    }
    const name = raw.toString().replace(/^\//, '');
    assert(
      destRefs.has(name),
      `${label} : destination nommée /${name} absente de l'arbre /Dests (lien mort)`,
    );
    return destRefs.get(name);
  };
  for (const l of internal) {
    const pageRef = pageRefForDest(l.dest, `lien ${l.via}`);
    assert(
      kidRefs.includes(pageRef.toString()),
      `lien ${l.via} : destination ${pageRef} non membre de /Pages /Kids`,
    );
  }
  return `${internal.length} liens internes (mécanisme: ${internal.map((l) => l.via).join(', ')})`;
});

// 6. Au moins une annotation /URI quelque part (lien web example.com).
await check('lien-web-uri', async () => {
  const jsUri = [];
  for (let i = 1; i <= jsDoc.numPages; i++) {
    const anns = await (await jsDoc.getPage(i)).getAnnotations();
    for (const a of anns) {
      if (a.subtype === 'Link' && a.url) jsUri.push(`p${i}:${a.url}`);
    }
  }
  assert(jsUri.length >= 1, 'aucune annotation url côté pdfjs');
  let raw = 0;
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    for (const { dict } of annotsOf(pdfDoc, i)) {
      if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue;
      const a = dict.get(PDFName.of('A'));
      if (
        a instanceof PDFDict &&
        a.get(PDFName.of('S')) === PDFName.of('URI') &&
        a.get(PDFName.of('URI'))
      ) {
        raw += 1;
      }
    }
  }
  assert(raw >= 1, 'aucun /A /S /URI côté raw pdf-lib');
  return `pdfjs: ${jsUri.join(' ')} | raw /S /URI: ${raw}`;
});

// 7. Le diagramme invalide a son texte de repli « Diagramme non généré ».
await check('mermaid-invalide-repli', async () => {
  const all = [];
  for (let i = 1; i <= jsDoc.numPages; i++) all.push(await pageText(jsDoc, i));
  const page = all.findIndex((t) => t.includes('Diagramme non généré')) + 1;
  assert(page >= 1, 'texte de repli introuvable');
  return `page ${page}`;
});

// 8. Le diagramme valide est rendu en vecteurs textuels : « Core » ET « App »
//    dans le texte de la page de la section Architecture (marqueur §§p-002§§).
await check('mermaid-valide-core-app', async () => {
  let page = 0;
  for (let i = 1; i <= jsDoc.numPages; i++) {
    if ((await pageText(jsDoc, i)).includes('§§p-002§§')) {
      page = i;
      break;
    }
  }
  assert(page >= 1, 'section §§p-002§§ (Architecture) introuvable');
  const t = await pageText(jsDoc, page);
  assert(t.includes('Core') && t.includes('App'), 'Core/App absents du texte');
  return `page ${page} contient Core + App (SVG vecteur)`;
});

// 9. Task 0.1.3 — le diagramme démesurément haut (« 6. Grand Schema », chaîne
//    A0→A30, 2e orpheline) tient sur UNE seule page : ses nœuds (texte vectoriel
//    extractible « A30 ») sont sur la page du marqueur de cette section, et ne
//    se prolongent pas sur la page suivante (pas de fragmentation). L'id
//    §§p-0NN§§ de la page est résolu dynamiquement (DFS : orphelines en fin de
//    TOC) plutôt que codé en dur.
await check('diagramme-tall-une-seule-page', async () => {
  let tall = null;
  for (const [id, p] of markerPages) {
    const t = await pageText(jsDoc, p);
    if (t.includes('Grand Schema')) {
      tall = { id, page: p, text: t };
      break;
    }
  }
  assert(
    tall !== null,
    'page « Grand Schema » (marqueur §§p-0NN§§) introuvable',
  );
  assert(
    tall.text.includes('A30'),
    `nœud A30 absent de la page ${tall.page} (§§${tall.id}§§) — SVG fragmenté`,
  );
  assert(
    tall.text.includes('A0'),
    `nœud A0 absent de la page ${tall.page} (§§${tall.id}§§) — SVG fragmenté`,
  );
  if (tall.page < jsDoc.numPages) {
    const next = await pageText(jsDoc, tall.page + 1);
    assert(
      !next.includes('A30'),
      `A30 se prolonge sur la page ${tall.page + 1} — fragmentation non résolue`,
    );
  }
  return `§§${tall.id}§§ page ${tall.page} : A0→A30 complets sur la même page`;
});

// 10. Task 0.1.3 — `out/integration-warnings.json` (écrit par run-export)
//     contient ≥ 1 MERMAID_INVALID dont le message porte le vrai motif mermaid
//     (> 40 caractères) ET l'extrait de source (« source: … »).
const warningsPath = path.resolve(
  here,
  '../../../out/integration-warnings.json',
);
await check('warnings-mermaid-invalid-detailles', async () => {
  const warnings = JSON.parse(await fs.readFile(warningsPath, 'utf8'));
  assert(Array.isArray(warnings), 'integration-warnings.json pas un tableau');
  const invalid = warnings.filter((w) => w && w.code === 'MERMAID_INVALID');
  assert(
    invalid.length >= 1,
    `aucun MERMAID_INVALID sur ${warnings.length} warning(s)`,
  );
  for (const w of invalid) {
    assert(
      typeof w.message === 'string' && w.message.length > 40,
      `message trop court (${w.message?.length ?? 0}) : ${JSON.stringify(w.message)}`,
    );
    assert(
      w.message.includes('source:'),
      `message sans extrait de source : ${w.message}`,
    );
  }
  return `${invalid.length} MERMAID_INVALID ; 1er message : ${invalid[0].message.slice(0, 120)}…`;
});

// 11. Parité mermaid 12 (ADR-0006) — le diagramme « canary » v12-only de la
//     section Architecture (`classDiagram` avec `<<enum>>` à membres quotés,
//     MERMAID_INVALID sous v11) est rendu en SVG : les textes vectoriels
//     extractibles « CmsRole » (classe enum) et « editor » (membre quotté)
//     sont présents dans le périmètre de pages de cette section (du marqueur
//     §§p-002§§ jusqu'à la page précédant le marqueur de la section suivante ;
//     le second diagramme déborde sur la page 5, ce qui est légitime ici —
//     contrairement au cas #9, c'est une coupure de CONTENT flow, pas du SVG).
await check('mermaid12-enum-canary', async () => {
  const start = markerPages.get('p-002');
  assert(start !== undefined, 'section §§p-002§§ (Architecture) introuvable');
  const laterPages = [...markerPages.values()].filter((p) => p > start);
  const end =
    laterPages.length > 0 ? Math.min(...laterPages) - 1 : jsDoc.numPages;
  let found = 0;
  let text = '';
  for (let i = start; i <= end; i++) {
    const t = await pageText(jsDoc, i);
    if (t.includes('CmsRole') && t.includes('editor')) {
      found = i;
      text = t;
      break;
    }
  }
  assert(
    found >= 1,
    `« CmsRole » + « editor » absents des pages ${start}–${end} — classDiagram <<enum>> non rendu (v12 ?)`,
  );
  assert(
    !text.includes('Diagramme non généré'),
    `repli « Diagramme non généré » sur la page ${found} — enum v12 n'a pas été rendu`,
  );
  return `pages ${start}–${end} (§§p-002§§) : CmsRole + editor rendus en SVG (page ${found})`;
});

// 12. Task 0.1.3 (ADR-0008) — réparation du dialecte « toléré par Qoder » :
//     le 3e diagramme de la section Architecture (<<enum>> à membres quotés,
//     NON indentés — repro minimisé du probe) échoue à la passe 1, est adapté
//     par R4 (repairMermaidSource) à la passe 2 → warnings JSON contient
//     ≥ 1 MERMAID_REPAIRED (message avec « source: », page hôtesse p-002) et
//     le compte de MERMAID_INVALID reste EXACTEMENT 1 (le `X --->??? invalid`
//     de 3.1 API.md, véritablement cassé — la réparation ne ressuscite rien).
//     Bonus rendu : le SVG réparé est vectoriel (« production » extractible).
await check('mermaid-repair-double-passe', async () => {
  const warnings = JSON.parse(await fs.readFile(warningsPath, 'utf8'));
  const repaired = warnings.filter((w) => w && w.code === 'MERMAID_REPAIRED');
  assert(
    repaired.length >= 1,
    `aucun MERMAID_REPAIRED sur ${warnings.length} warning(s) — double passe inopérante ?`,
  );
  for (const w of repaired) {
    assert(
      typeof w.message === 'string' && w.message.includes('source:'),
      `MERMAID_REPAIRED sans extrait de source : ${JSON.stringify(w.message)}`,
    );
  }
  const invalid = warnings.filter((w) => w && w.code === 'MERMAID_INVALID');
  assert(
    invalid.length === 1,
    `MERMAID_INVALID = ${invalid.length} (attendu : exactement 1 — le bloc cassé doit rester le seul)`,
  );
  const start = markerPages.get('p-002');
  assert(start !== undefined, 'section §§p-002§§ (Architecture) introuvable');
  const laterPages = [...markerPages.values()].filter((p) => p > start);
  const end =
    laterPages.length > 0 ? Math.min(...laterPages) - 1 : jsDoc.numPages;
  let rendered = 0;
  for (let i = start; i <= end; i++) {
    if ((await pageText(jsDoc, i)).includes('production')) {
      rendered = i;
      break;
    }
  }
  assert(
    rendered >= 1,
    `« production » absent des pages ${start}–${end} — diagramme réparé non rendu en SVG`,
  );
  return `${repaired.length} MERMAID_REPAIRED, 1 MERMAID_INVALID ; SVG réparé page ${rendered}`;
});

await jsDoc.destroy();

// Sortie + code d'échec -----------------------------------------------------
for (const [line] of results) {
  console.log(line);
}
if (failures.length > 0) {
  console.error(`\n${failures.length} FAIL: ${failures.join(' ; ')}`);
  process.exit(1);
}
console.log(`\nALL PASS (${results.length} assertions) — ${pdfPath}`);
