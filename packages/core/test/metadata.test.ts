import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseWikiMeta } from '../src/metadata.js';

describe('parseWikiMeta', () => {
  let tempDir: string | undefined;
  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });
  const writeMeta = async (content: string): Promise<string> => {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-meta-'));
    const p = path.join(tempDir, 'repowiki-metadata.json');
    await fs.writeFile(p, content, 'utf8');
    return p;
  };

  it('null si metaPath null, fichier absent ou JSON invalide', async () => {
    expect(await parseWikiMeta(null)).toBeNull();
    expect(
      await parseWikiMeta(path.join(tempDir ?? os.tmpdir(), 'nope.json')),
    ).toBeNull();
    expect(
      await parseWikiMeta(await writeMeta('{ ceci n’est pas du JSON')),
    ).toBeNull();
  });

  it('extrait wiki_catalogs[].name dans l’ordre du tableau (non trié)', async () => {
    const p = await writeMeta(
      JSON.stringify({
        wiki_catalogs: [
          { name: 'Guide' },
          { name: 'Architecture' },
          { name: 'API' },
        ],
      }),
    );
    expect(await parseWikiMeta(p)).toEqual({
      titles: ['Guide', 'Architecture', 'API'],
    });
  });

  it('null si wiki_catalogs absent ou non-tableau (shape mismatch)', async () => {
    expect(
      await parseWikiMeta(await writeMeta(JSON.stringify({ wiki_repo: 1 }))),
    ).toBeNull();
    expect(
      await parseWikiMeta(
        await writeMeta(JSON.stringify({ wiki_catalogs: 'x' })),
      ),
    ).toBeNull();
  });

  it('ignore les entrées sans name string', async () => {
    const p = await writeMeta(
      JSON.stringify({
        wiki_catalogs: [
          { name: 'A' },
          { name: 42 },
          { name: null },
          {},
          'pas un objet',
          { name: 'B' },
        ],
      }),
    );
    expect(await parseWikiMeta(p)).toEqual({ titles: ['A', 'B'] });
  });
});
