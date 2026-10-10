import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import type { PDFDict, PDFRef } from 'pdf-lib';
import type { OutlineItem, SectionMark } from './types.js';

/** Marqueur texte littéral émis par compose.ts (`§§<id>§§`). */
const MARKER = '§§';

/**
 * Localise chaque section en recherchant son marqueur textuel `§§<id>§§` dans le
 * texte extrait de chaque page (pdfjs legacy). La première page contenant le
 * marqueur gagne (pageIndex 0-based). Un marqueur jamais trouvé est absent de la
 * Map et signalé via `onMissing`.
 *
 * Le comparaison est faite sur la chaîne LITTÉRALE (aucune normalisation) afin de
 * rester tolérante aux octets accentués / marqueurs de section.
 */
export async function locateSections(
  pdf: Uint8Array,
  marks: SectionMark[],
  onMissing?: (id: string) => void,
): Promise<Map<string, number>> {
  const { getDocument, VerbosityLevel } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  );
  // pdfjs peut transférer/détacher le buffer : on slice pour que le tableau de
  // l'appelant reste intact (il doit pouvoir resservir pour polishPdf ensuite).
  // verbosity=ERRORS : on garde les erreurs réelles mais on supprime les warnings
  // non bloquants de pdfjs (ex. `standardFontDataUrl` manquant) qui polluent
  // autrement la sortie des tests. L'extraction texte fonctionne quand même.
  const doc = await getDocument({
    data: pdf.slice(),
    verbosity: VerbosityLevel.ERRORS,
  }).promise;
  const found = new Map<string, number>();
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const { items } = await page.getTextContent();
      const text = items
        .map((item) => ('str' in item ? item.str : ''))
        .join('');
      for (const m of marks) {
        if (!found.has(m.id) && text.includes(`${MARKER}${m.id}${MARKER}`)) {
          found.set(m.id, i - 1);
        }
      }
    }
  } finally {
    await doc.destroy();
  }
  for (const m of marks) {
    if (!found.has(m.id)) onMissing?.(m.id);
  }
  return found;
}

/** Noeud interne de l'arbre de signets (construction en mémoire). */
type BookmarkNode = {
  title: string;
  pageIndex: number;
  children: BookmarkNode[];
};
/** Entrée de la pile : le niveau de l'item et le noeud correspondant. */
type StackEntry = { level: number; node: BookmarkNode };

/**
 * Finition du PDF : métadonnées (titre/sujet/producteur/créateur) puis outline
 * hiérarchique (signets). pdf-lib 1.17.1 n'expose AUCUNE API d'outline de haut
 * niveau (`doc.outline` / `createChild` n'existent pas), donc on construit le
 * dictionnaire `/Outlines` au bas niveau via `doc.context`.
 *
 * La hiérarchie est produite par une passe unique avec une pile indexée par
 * niveau : on dépile tout ancêtre dont le niveau est >= celui courant, puis le
 * parent est le sommet de pile (frère le plus récent de niveau strictement
 * inférieur) ou la racine. Les items de niveau 1 vont donc à la racine.
 */
export async function polishPdf(
  pdf: Uint8Array,
  outline: OutlineItem[],
  meta: { title: string; subject: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  doc.setTitle(meta.title);
  doc.setSubject(meta.subject);
  doc.setProducer('RepoWiki→PDF');
  doc.setCreator('RepoWiki→PDF');

  const context = doc.context;
  const pageCount = doc.getPageCount();
  const clamp = (i: number): number => Math.max(0, Math.min(i, pageCount - 1));

  // 1. Construire l'arbre (pile indexée par niveau).
  const root: BookmarkNode = { title: '', pageIndex: 0, children: [] };
  const stack: StackEntry[] = [];
  const peek = (): StackEntry | undefined => stack[stack.length - 1];
  for (const item of outline) {
    let top = peek();
    while (top !== undefined && top.level >= item.level) {
      stack.pop();
      top = peek();
    }
    const node: BookmarkNode = {
      title: item.title,
      pageIndex: item.pageIndex,
      children: [],
    };
    const parent = top === undefined ? root : top.node;
    parent.children.push(node);
    stack.push({ level: item.level, node });
  }

  // 2. Sérialiser l'arbre en dictionnaires PDF /Outlines (liaisons First/Last/
  //    Parent/Prev/Next/Count + /Dest vers la page).
  const serializeChildren = (
    nodes: BookmarkNode[],
    parentRef: PDFRef,
  ): { first: PDFRef; last: PDFRef; count: number } | null => {
    if (nodes.length === 0) return null;
    let first: PDFRef | undefined;
    let last: PDFRef | undefined;
    let prevDict: PDFDict | undefined;
    let prevRef: PDFRef | undefined;
    let count = 0;
    for (const node of nodes) {
      const dict = context.obj({});
      const ref = context.register(dict);
      if (first === undefined) first = ref;
      if (prevRef !== undefined) dict.set(PDFName.of('Prev'), prevRef);
      if (prevDict !== undefined) prevDict.set(PDFName.of('Next'), ref);
      prevDict = dict;
      prevRef = ref;
      last = ref;
      count += 1;

      dict.set(PDFName.of('Title'), PDFHexString.fromText(node.title));

      const dest = context.obj([]);
      dest.push(doc.getPage(clamp(node.pageIndex)).ref);
      dest.push(PDFName.of('XYZ'));
      dest.push(context.obj(null));
      dest.push(context.obj(null));
      dest.push(context.obj(null));
      dict.set(PDFName.of('Dest'), dest);
      dict.set(PDFName.of('Parent'), parentRef);

      const child = serializeChildren(node.children, ref);
      if (child !== null) {
        dict.set(PDFName.of('First'), child.first);
        dict.set(PDFName.of('Last'), child.last);
        dict.set(PDFName.of('Count'), context.obj(child.count));
        count += child.count;
      }
    }
    if (first === undefined || last === undefined) return null;
    return { first, last, count };
  };

  const outlines = context.obj({});
  const outlinesRef = context.register(outlines);
  outlines.set(PDFName.of('Type'), PDFName.of('Outlines'));
  const top = serializeChildren(root.children, outlinesRef);
  if (top !== null) {
    outlines.set(PDFName.of('First'), top.first);
    outlines.set(PDFName.of('Last'), top.last);
    outlines.set(PDFName.of('Count'), context.obj(top.count));
  }
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

  return doc.save();
}
