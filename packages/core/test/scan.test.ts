import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WikiNotFoundError, scanProject } from '../src/scan.js';
import { createFixtureProject } from '../src/testing/fixtureProject.js';

describe('scanProject', () => {
  let tempDir: string | undefined;
  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });
  it('détecte le wiki, la langue en, le plan et les 5 pages', async () => {
    // 0.1.8 : fixture régénéré par la fabrique dans un tmpdir (plus de
    // `fixtures/` dans l'arbre). Sous-dossier nommé `fake-project` pour
    // conserver l'assertion `projectName`.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-scan-fix-'));
    const fixture = await createFixtureProject(
      path.join(tempDir, 'fake-project'),
    );
    const r = await scanProject(fixture);
    expect(r.projectName).toBe('fake-project');
    expect(r.planPath?.endsWith('wiki_plan.yaml')).toBe(true);
    expect(r.languages.map((l) => l.language)).toEqual(['en']);
    expect(r.languages[0]?.files.map((f) => f.name)).toEqual([
      "1. Vue d'ensemble",
      '2. Architecture',
      '3.1 API',
      '5. Orpheline',
      '6. Grand Schema',
    ]);
    // fake-project n’a pas de <lang>/meta/repowiki-metadata.json → null.
    expect(r.languages[0]?.metaPath).toBeNull();
  });
  it('metaPath pointant vers <lang>/meta/repowiki-metadata.json quand présent', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-scan-meta-'));
    const wiki = path.join(tempDir, '.qoder', 'repowiki');
    await fs.mkdir(path.join(wiki, 'fr', 'content'), { recursive: true });
    await fs.mkdir(path.join(wiki, 'en', 'content'), { recursive: true });
    await fs.mkdir(path.join(wiki, 'en', 'meta'), { recursive: true });
    await fs.writeFile(
      path.join(wiki, 'en', 'meta', 'repowiki-metadata.json'),
      '{}',
      'utf8',
    );
    const r = await scanProject(tempDir);
    const en = r.languages.find((l) => l.language === 'en');
    expect(en?.metaPath).toBe(
      path.join(wiki, 'en', 'meta', 'repowiki-metadata.json'),
    );
    const fr = r.languages.find((l) => l.language === 'fr');
    expect(fr?.metaPath).toBeNull();
  });
  it('lève WikiNotFoundError sans .qoder/repowiki', async () => {
    // Root vide créé dans le tmpdir OS : jamais impacté par un .qoder/repowiki
    // généré pour ce dépôt.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-scan-empty-'));
    await expect(scanProject(tempDir)).rejects.toThrow(WikiNotFoundError);
  });
});
