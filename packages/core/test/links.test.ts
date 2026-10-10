import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { embedImages, rewriteLinks } from '../src/links.js';
import { createFixtureProject } from '../src/testing/fixtureProject.js';
import type { CoreWarning } from '../src/types.js';

// 0.1.8 : le contenu fixture vient de la fabrique `createFixtureProject`
// (tmpdir) — plus de dépendance au dossier `fixtures/` du dépôt.
let tempBase: string;
let CONTENT: string;
let map: Map<string, string>;

beforeAll(async () => {
  tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-links-'));
  const root = await createFixtureProject(path.join(tempBase, 'fake-project'));
  CONTENT = path.join(root, '.qoder', 'repowiki', 'en', 'content');
  map = new Map([
    [path.join(CONTENT, '2. Architecture.md'), 'p-002'],
    [path.join(CONTENT, '3. Sous-systemes/3.1 API.md'), 'p-003'],
  ]);
});

afterAll(async () => {
  if (tempBase) {
    await fs.rm(tempBase, { recursive: true, force: true });
  }
});

describe('rewriteLinks', () => {
  it('ancre un lien md relatif', () => {
    const w: CoreWarning[] = [];
    const h = rewriteLinks(
      '<a href="./2.%20Architecture.md">x</a>',
      CONTENT,
      map,
      w,
    );
    expect(h).toContain('href="#p-002"');
    expect(w).toHaveLength(0);
  });

  // Ruling 1 + 2 : l'ancre est DECODE (Unicode brut, `é` non encodé) et
  // n'est conservée que si elle figure dans `knownAnchors`.
  it('résout le fragment vers une ancre préfixée (Unicode brut)', () => {
    const w: CoreWarning[] = [];
    const known = new Set(['p-003--détails']);
    const h = rewriteLinks(
      '<a href="./3.%20Sous-systemes/3.1%20API.md#D%C3%A9tails">y</a>',
      CONTENT,
      map,
      w,
      known,
    );
    expect(h).toContain('href="#p-003--détails"');
    expect(w).toHaveLength(0);
  });

  // Ruling 2 : fragment inconnu → retour à l'ancre de page + LINK_FRAG_DROPPED.
  it('droppe le fragment inconnu et émet LINK_FRAG_DROPPED', () => {
    const w: CoreWarning[] = [];
    const known = new Set(['p-003--autre']);
    const h = rewriteLinks(
      '<a href="./3.%20Sous-systemes/3.1%20API.md#D%C3%A9tails">y</a>',
      CONTENT,
      map,
      w,
      known,
    );
    expect(h).toContain('href="#p-003"');
    expect(w.some((x) => x.code === 'LINK_FRAG_DROPPED')).toBe(true);
  });

  it('warning si cible absente du wiki', () => {
    const w: CoreWarning[] = [];
    rewriteLinks('<a href="./Inconnu.md">z</a>', CONTENT, map, w);
    expect(w.some((x) => x.code === 'BROKEN_LINK')).toBe(true);
  });

  // Critical 1 (spec N1) : un `href` avec un `%` malformé est observable
  // depuis le contenu du wiki. decodeURIComponent lève URIError → il ne faut
  // SURTOUT pas aborter l'export : warning BROKEN_LINK + <a> laissé intact.
  it('% malformé dans href → BROKEN_LINK, html inchangé, ne lève pas', () => {
    const w: CoreWarning[] = [];
    const input = '<a href="./10% Something.md">x</a>';
    const h = rewriteLinks(input, CONTENT, map, w);
    expect(h).toBe(input); // laissé tel quel (pas d'ancre fabriquée)
    expect(
      w.some((x) => x.code === 'BROKEN_LINK' && x.message.includes('10%')),
    ).toBe(true);
  });
});

describe('embedImages', () => {
  it('convertit une image relative en data-uri', async () => {
    const w: CoreWarning[] = [];
    const h = await embedImages('<img src="./assets/logo.png">', CONTENT, w);
    expect(h).toContain('src="data:image/png;base64,iVBOR');
    expect(w).toHaveLength(0);
  });

  it('placeholder + warning si image absente', async () => {
    const w: CoreWarning[] = [];
    const h = await embedImages('<img src="./assets/nope.png">', CONTENT, w);
    expect(h).toContain('img-missing');
    expect(w.some((x) => x.code === 'IMAGE_MISSING')).toBe(true);
  });

  // Critical 1 (spec N1) : un `src` avec un `%` malformé ne doit pas lever
  // URIError et aborter l'export → traité comme une image absente (placeholder
  // + IMAGE_MISSING), jamais de throw.
  it('% malformé dans src → placeholder IMAGE_MISSING, ne lève pas', async () => {
    const w: CoreWarning[] = [];
    const h = await embedImages('<img src="./10% x.png">', CONTENT, w);
    expect(h).toContain('img-missing');
    expect(w.some((x) => x.code === 'IMAGE_MISSING')).toBe(true);
  });

  // Important 3 : deux balises <img> distinctes (attributs différents) mais au
  // MÊME src doivent toutes deux être réécrites (l'ancienne dédup par `seen`
  // laissait la 2e en src relatif → image silencieusement cassée dans le PDF).
  it('deux balises <img> même src → toutes deux réécrites en data-uri', async () => {
    const w: CoreWarning[] = [];
    const h = await embedImages(
      '<img src="./assets/logo.png"><img src="./assets/logo.png" width="10">',
      CONTENT,
      w,
    );
    expect(h).not.toContain('src="./assets/logo.png"'); // aucun src relatif restant
    expect(h.match(/data:image\/png;base64/g)?.length).toBe(2);
    expect(w).toHaveLength(0);
  });
});
