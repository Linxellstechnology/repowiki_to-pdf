import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  CoreWarning,
  LanguageScan,
  OutlineItem,
  PlanFile,
  RenderedPage,
  ScanResult,
  SectionMark,
  TocNode,
  WikiPageFile,
  WikiPlanDocument,
} from '../src/index.js';
import {
  createFixtureProject,
  fixtureProjectFiles,
} from '../src/testing/fixtureProject.js';

let tempBase: string;
let repowikiDir: string;

beforeAll(async () => {
  tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-factory-'));
  const root = await createFixtureProject(path.join(tempBase, 'fake-project'));
  repowikiDir = `${path.join(root, '.qoder', 'repowiki')}${path.sep}`;
});

afterAll(async () => {
  if (tempBase) {
    await fs.rm(tempBase, { recursive: true, force: true });
  }
});

const readWiki = (rel: string) =>
  fs.readFile(
    path.join(
      tempBase,
      'fake-project',
      '.qoder',
      'repowiki',
      ...rel.split('/'),
    ),
    'utf8',
  );

describe('domain types', () => {
  it('accept representative literals', () => {
    const document: WikiPlanDocument = {
      title: "Vue d'ensemble",
      goal: 'intro',
    };
    const withParent: WikiPlanDocument = {
      title: 'API',
      goal: 'api',
      parent: 'Architecture',
    };
    const plan: PlanFile = { documents: [document, withParent] };
    const page: WikiPageFile = {
      name: "1. Vue d'ensemble.md",
      path: "C:/fake/.qoder/repowiki/en/content/1. Vue d'ensemble.md",
    };
    const scan: LanguageScan = {
      language: 'en',
      contentDir: 'content',
      files: [page],
      metaPath: null,
    };
    const result: ScanResult = {
      projectRoot: 'C:/fake',
      projectName: 'fake',
      wikiDir: 'C:/fake/.qoder/repowiki',
      planPath: null,
      languages: [scan],
    };
    const node: TocNode = {
      id: '1',
      title: "Vue d'ensemble",
      filePath: null,
      level: 0,
      children: [],
    };
    const warning: CoreWarning = {
      code: 'orphan-page',
      message: 'absente du plan',
    };
    const rendered: RenderedPage = {
      id: '1',
      title: 'Vue',
      html: '<h1>Vue</h1>',
    };
    const mark: SectionMark = { id: 'details', level: 2, title: 'Détails' };
    const outline: OutlineItem = { title: 'Détails', level: 2, pageIndex: 0 };

    expect(plan.documents).toHaveLength(2);
    expect(result.languages[0]?.files[0]?.name).toBe("1. Vue d'ensemble.md");
    expect(node.children).toEqual([]);
    expect(warning.page).toBeUndefined();
    expect(rendered.html).toContain('<h1>');
    expect(mark.level).toBe(2);
    expect(outline.pageIndex).toBe(0);
  });
});

describe('fixture factory (createFixtureProject)', () => {
  it('écrit l’arbre attendu sous <root>/.qoder/repowiki', async () => {
    expect(fixtureProjectFiles().sort()).toEqual(
      [
        'wiki_plan.yaml',
        "en/content/1. Vue d'ensemble.md",
        'en/content/2. Architecture.md',
        'en/content/3. Sous-systemes/3.1 API.md',
        'en/content/5. Orpheline.md',
        'en/content/6. Grand Schema.md',
        'en/content/assets/logo.png',
      ].sort(),
    );
    for (const rel of fixtureProjectFiles()) {
      const abs = path.join(
        tempBase,
        'fake-project',
        '.qoder',
        'repowiki',
        ...rel.split('/'),
      );
      await expect(fs.stat(abs)).resolves.toBeTruthy();
    }
  });

  it('reproduit le contenu verbatim, accents intacts', async () => {
    const plan = await readWiki('wiki_plan.yaml');
    expect(plan).toContain('title: "Vue d\'ensemble"');
    expect(plan).toContain('parent: "Architecture"');
    expect(plan).not.toContain('Orpheline');

    const overview = await readWiki("en/content/1. Vue d'ensemble.md");
    expect(overview).toContain("Texte d'introduction");
    expect(overview).toContain('./2.%20Architecture.md');
    expect(overview).toContain('https://example.com');

    const arch = await readWiki('en/content/2. Architecture.md');
    expect(arch).toContain('![logo](./assets/logo.png)');
    expect(arch).toContain('```mermaid');
    // Canary v12 : `classDiagram <<enum>>` à membres quotés n'est accepté que
    // par mermaid 12 (MERMAID_INVALID sous v11) — voir ADR-0006.
    expect(arch).toContain('<<enum>>');
    expect(arch).toContain('CmsRole');
    expect(arch).toContain('./3.%20Sous-systemes/3.1%20API.md#d%C3%A9tails');
    // Canary 0.1.3 (ADR-0008) : TROISIÈME diagramme en syntaxe non standard
    // « tolérée par Qoder » — membres d'un `<<enum>>` entre guillemets, NON
    // indentés (repro minimisé du probe, minires #6) : rejeté par mermaid
    // 12.1.0 à la passe 1, adapté par la règle R4 de `repairMermaidSource`
    // → warning MERMAID_REPAIRED + SVG (assertion #12 de l'intégration).
    expect(arch).toContain('class CmsEnvMode {');
    expect(arch).toContain('"staging"');

    const api = await readWiki('en/content/3. Sous-systemes/3.1 API.md');
    expect(api).toContain('## Détails');
    expect(api).toContain('X --->??? invalid');
    expect(api).toContain('| Col1 | Col2 |');

    const orphan = await readWiki('en/content/5. Orpheline.md');
    expect(orphan).toContain('# Orpheline');
    expect(orphan).toContain('Page absente du plan.');

    // Chaîne A0-->…-->A30 volontairement démesurée (test d'intégration
    // « diagramme haut = une seule page »).
    const grand = await readWiki('en/content/6. Grand Schema.md');
    expect(grand).toContain('# Grand Schema');
    expect(grand).toContain('graph TD');
    expect(grand).toContain('A29-->A30');
    expect(plan).not.toContain('Grand Schema');
  });

  it('embarque le logo PNG 1×1 en base64', async () => {
    const logo = await fs.readFile(
      path.join(
        tempBase,
        'fake-project',
        '.qoder',
        'repowiki',
        'en',
        'content',
        'assets',
        'logo.png',
      ),
    );
    expect(logo.subarray(1, 4).toString()).toBe('PNG');
    expect(logo.length).toBe(70);
    // Signature byte-for-byte de l'ancien fixtures/fake-project.
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(logo).digest('hex')).toBe(
      'c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77',
    );
  });
});
