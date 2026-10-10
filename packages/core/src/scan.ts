import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageScan, ScanResult, WikiPageFile } from './types.js';

export class WikiNotFoundError extends Error {
  constructor(public projectRoot: string) {
    super(
      `Aucun RepoWiki trouvé dans ${projectRoot}. Génère le Repo Wiki dans Qoder (bouton « Generate » du panneau Repo Wiki), puis relance.`,
    );
    this.name = 'WikiNotFoundError';
  }
}

const isDir = async (p: string) =>
  (await fs.stat(p).catch(() => null))?.isDirectory() === true;

async function collectMd(dir: string): Promise<WikiPageFile[]> {
  const out: WikiPageFile[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectMd(p)));
    else if (e.name.endsWith('.md'))
      out.push({ name: e.name.replace(/\.md$/, ''), path: p });
  }
  return out;
}

export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const wikiDir = path.join(projectRoot, '.qoder', 'repowiki');
  if (!(await isDir(wikiDir))) throw new WikiNotFoundError(projectRoot);
  const planCandidate = path.join(wikiDir, 'wiki_plan.yaml');
  const planPath = (await fs.stat(planCandidate).catch(() => null))
    ? planCandidate
    : null;
  const languages: LanguageScan[] = [];
  for (const e of await fs.readdir(wikiDir, { withFileTypes: true })) {
    const contentDir = path.join(wikiDir, e.name, 'content');
    if (e.isDirectory() && (await isDir(contentDir))) {
      const metaCandidate = path.join(
        wikiDir,
        e.name,
        'meta',
        'repowiki-metadata.json',
      );
      languages.push({
        language: e.name,
        contentDir,
        metaPath: (await fs.stat(metaCandidate).catch(() => null))
          ? metaCandidate
          : null,
        files: (await collectMd(contentDir)).sort((a, b) =>
          a.path.localeCompare(b.path, 'fr', { numeric: true }),
        ),
      });
    }
  }
  return {
    projectRoot,
    projectName: path.basename(path.resolve(projectRoot)),
    wikiDir,
    planPath,
    languages,
  };
}
