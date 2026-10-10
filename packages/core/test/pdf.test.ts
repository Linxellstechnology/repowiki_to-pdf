import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { locateSections, polishPdf } from '../src/pdf.js';
import type { SectionMark } from '../src/types.js';

async function synth(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of ['§§p-001§§ Intro', 'page deux', '§§p-002§§ Architecture']) {
    const p = doc.addPage([595, 842]);
    p.drawText(t, { x: 40, y: 800, font, size: 8 });
  }
  return doc.save();
}

// pdf-lib 1.17.1 n'expose aucune API de lecture d'outline (getOutline() n'existe
// pas) : on relit les signets avec pdfjs pour vérifier le round-trip réel.
async function readOutline(bytes: Uint8Array) {
  const { getDocument, VerbosityLevel } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  );
  const doc = await getDocument({
    data: bytes.slice(),
    verbosity: VerbosityLevel.ERRORS,
  }).promise;
  const outline = await doc.getOutline();
  await doc.destroy();
  return outline;
}

describe('pdf polish', () => {
  it('localise les sections par leurs marqueurs texte', async () => {
    const map = await locateSections(await synth(), [
      { id: 'p-001', level: 1, title: 'Intro' },
      { id: 'p-002', level: 1, title: 'Architecte' },
    ]);
    expect(map.get('p-001')).toBe(0);
    expect(map.get('p-002')).toBe(2);
  });
  it('ajoute outline et métadonnées', async () => {
    const polished = await polishPdf(
      await synth(),
      [
        { title: 'Intro', level: 1, pageIndex: 0 },
        { title: 'Architecture', level: 1, pageIndex: 2 },
        { title: 'Sous-sys', level: 2, pageIndex: 2 },
      ],
      { title: 'Projet X', subject: 'RepoWiki' },
    );
    const re = await PDFDocument.load(polished);
    expect(re.getTitle()).toBe('Projet X');
    const kids = await readOutline(polished);
    expect(kids.length).toBe(2);
    // Le niveau 2 s'imbrique sous le dernier frère de niveau parent.
    expect(kids[1]?.items.length).toBe(1);
    expect(kids[1]?.items[0]?.title).toBe('Sous-sys');
  });
  it('mark introuvable → absent, onMissing appelé', async () => {
    const missing: string[] = [];
    const map = await locateSections(
      await synth(),
      [{ id: 'p-999', level: 1, title: 'x' }],
      (id) => missing.push(id),
    );
    expect(map.size).toBe(0);
    expect(missing).toEqual(['p-999']);
  });
});
