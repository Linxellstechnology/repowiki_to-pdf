import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildToc, parsePlan, titleFromFilename } from '../src/plan.js';
import { createFixtureProject } from '../src/testing/fixtureProject.js';
import type { PlanFile, TocNode, WikiPageFile } from '../src/types.js';

const F = (name: string): WikiPageFile => ({ name, path: `/x/${name}.md` });

const collectIds = (nodes: TocNode[]): string[] =>
  nodes.flatMap((n) => [n.id, ...collectIds(n.children)]);

const flatten = (nodes: TocNode[]): TocNode[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);

describe('titleFromFilename', () => {
  it('retire les préfixes numériques', () => {
    expect(titleFromFilename("1. Vue d'ensemble")).toBe("Vue d'ensemble");
    expect(titleFromFilename('3.1 API')).toBe('API');
  });
});

describe('buildToc', () => {
  const files = [
    F("1. Vue d'ensemble"),
    F('2. Architecture'),
    F('3.1 API'),
    F('5. Orpheline'),
  ];
  const fullPlan: PlanFile = {
    documents: [
      { title: "Vue d'ensemble" },
      { title: 'Architecture' },
      { title: 'API', parent: 'Architecture' },
    ],
  };

  it("imbrique selon parent et ajoute l'orpheline à la racine", () => {
    const { toc } = buildToc(fullPlan, files);
    // Racines déclarées par le plan, puis « 5. Orpheline » ajoutée à la
    // racine (level 1) — jamais imbriquée sous un noeud.
    expect(toc).toHaveLength(3);
    expect(toc.map((t) => t.title)).toEqual([
      "Vue d'ensemble",
      'Architecture',
      'Orpheline',
    ]);
    expect(toc[1]?.children.map((c) => c.title)).toEqual(['API']);
    expect(toc[1]?.children[0]?.level).toBe(2); // parent.level + 1
    expect(toc[2]?.level).toBe(1);
    expect(toc[2]?.filePath).toBe('/x/5. Orpheline.md');
    const nested: TocNode[] = [];
    const walk = (ns: TocNode[]): void => {
      for (const n of ns) {
        nested.push(...n.children);
        walk(n.children);
      }
    };
    walk(toc);
    expect(nested.map((n) => n.title)).not.toContain('Orpheline');
  });

  it('attribue des ids p-0NN uniques et stables (format)', () => {
    const { toc, fileToPageId } = buildToc(fullPlan, files);
    expect(fileToPageId.get('/x/3.1 API.md')).toMatch(/^p-\d{3}$/);
    const ids = collectIds(toc);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length); // unicité dans l'arbre
    for (const id of fileToPageId.values()) expect(ids).toContain(id);
    // stabilité : deux appels sur les mêmes entrées produisent les mêmes ids
    const again = buildToc(fullPlan, files);
    expect([...again.fileToPageId.entries()]).toEqual([
      ...fileToPageId.entries(),
    ]);
  });

  it('fallback sans plan : ordre des fichiers, plan absent → warning PLAN_MISSING', () => {
    const { toc, warnings } = buildToc(null, files);
    expect(toc.map((t) => t.title)).toEqual([
      "Vue d'ensemble",
      'Architecture',
      'API',
      'Orpheline',
    ]);
    expect(warnings.some((w) => w.code === 'PLAN_MISSING')).toBe(true);
  });

  it('page absente du plan → warning PAGE_NOT_IN_PLAN et ajout à la racine', () => {
    const { toc, warnings } = buildToc(
      { documents: [{ title: 'Architecture' }] },
      files,
    );
    expect(toc.length).toBeGreaterThan(1);
    expect(toc).toHaveLength(4); // 1 titre du plan + 3 fichiers hors plan
    expect(toc.every((t) => t.level === 1 && t.children.length === 0)).toBe(
      true,
    );
    const orphans = warnings.filter((w) => w.code === 'PAGE_NOT_IN_PLAN');
    expect(orphans.map((w) => w.page)).toContain('5. Orpheline');
    expect([...new Set(orphans.map((w) => w.page))].sort()).toEqual([
      "1. Vue d'ensemble",
      '3.1 API',
      '5. Orpheline',
    ]);
    // « Vue d'ensemble » est un vrai fichier : il ne peut pas être un titre
    // de plan non matché → pas de PLAN_TITLE_UNMATCHED ici.
    expect(warnings.some((w) => w.code === 'PLAN_TITLE_UNMATCHED')).toBe(false);
  });

  it('titre du plan sans fichier correspondant → PLAN_TITLE_UNMATCHED', () => {
    const { toc, warnings } = buildToc(
      {
        documents: [{ title: 'Architecture' }, { title: 'Chapitre fantôme' }],
      },
      files,
    );
    expect(
      warnings.some(
        (w) =>
          w.code === 'PLAN_TITLE_UNMATCHED' &&
          w.message.includes('Chapitre fantôme'),
      ),
    ).toBe(true);
    expect(toc.map((t) => t.title)).not.toContain('Chapitre fantôme');
  });
});

describe('buildToc — fallback repowiki-metadata.json (sans wiki_plan.yaml)', () => {
  let tempRoot: string | undefined;
  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });
  // Arborescence synthétique imitant le layout réel de Qoder :
  //   content/Guide.md, content/Inconnu.md
  //   content/Architecture/Architecture.md (page propre) + API.md (enfant)
  //   content/Architecture/Modules/Modules.md + Sockets.md (niveau 3)
  //   content/Deploiement/Docker.md (section SANS page propre → nœud titre seul)
  const makeContentDir = async (): Promise<string> => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-toc-meta-'));
    const content = path.join(tempRoot, 'content');
    for (const rel of [
      'Guide.md',
      'Inconnu.md',
      path.join('Architecture', 'Architecture.md'),
      path.join('Architecture', 'API.md'),
      path.join('Architecture', 'Modules', 'Modules.md'),
      path.join('Architecture', 'Modules', 'Sockets.md'),
      path.join('Deploiement', 'Docker.md'),
    ]) {
      const p = path.join(content, rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, '# x\n', 'utf8');
    }
    return content;
  };
  // Ordre de création interne Qoder (non alphabétique) : Architecture=0,
  // Modules=1, Guide=2, API=3 ; Deploiement/Inconnu/Sockets/Docker absents.
  const metaTitles = ['Architecture', 'Modules', 'Guide', 'API'];

  it('hiérarchie depuis content/, ordre des catalogues, inconnus en fin', async () => {
    const content = await makeContentDir();
    const { toc, warnings } = buildToc(null, [], {
      metaTitles,
      contentDir: content,
    });
    expect(toc.map((t) => t.title)).toEqual([
      'Architecture',
      'Guide',
      'Deploiement',
      'Inconnu',
    ]);
    expect(toc.every((t) => t.level === 1)).toBe(true);
    // section avec page propre → filePath = <dir>/<dir>.md
    expect(toc[0]?.filePath).toBe(
      path.join(content, 'Architecture', 'Architecture.md'),
    );
    // enfants triés par index catalogue : Modules(1) avant API(3)
    expect(toc[0]?.children.map((c) => c.title)).toEqual(['Modules', 'API']);
    expect(toc[0]?.children.every((c) => c.level === 2)).toBe(true);
    // nesting : niveau 3 sous Modules
    expect(toc[0]?.children[0]?.children.map((c) => c.title)).toEqual([
      'Sockets',
    ]);
    expect(toc[0]?.children[0]?.children[0]?.level).toBe(3);
    // section sans page propre → nœud titre seul (filePath null)
    expect(toc[2]?.filePath).toBeNull();
    expect(toc[2]?.children.map((c) => [c.title, c.level])).toEqual([
      ['Docker', 2],
    ]);
    // avertissement dédié, PAS de PLAN_MISSING
    expect(warnings.map((w) => w.code)).toEqual(['PLAN_METADATA_USED']);
    expect(warnings[0]?.message).toBe(
      'wiki_plan.yaml absent — hiérarchie reconstruite depuis repowiki-metadata.json (ordre des catalogues Qoder).',
    );
  });

  it('ids p-0NN uniques en DFS du nouvel ordre ; fileToPageId sur les nœuds à filePath', async () => {
    const content = await makeContentDir();
    const { toc, fileToPageId } = buildToc(null, [], {
      metaTitles,
      contentDir: content,
    });
    const flat = flatten(toc);
    expect(flat.map((n) => n.id)).toEqual([
      'p-001',
      'p-002',
      'p-003',
      'p-004',
      'p-005',
      'p-006',
      'p-007',
      'p-008',
    ]);
    const ids = collectIds(toc);
    expect(new Set(ids).size).toBe(ids.length);
    // les 7 fichiers → 7 entrées ; le nœud titre seul (Deploiement) est exclu
    expect(fileToPageId.size).toBe(7);
    expect(fileToPageId.get(path.join(content, 'Guide.md'))).toBe('p-005');
    expect(fileToPageId.get(path.join(content, 'Architecture', 'API.md'))).toBe(
      'p-004',
    );
    expect([...fileToPageId.keys()]).not.toContain(
      path.join(content, 'Deploiement'),
    );
  });

  it('metaTitles ou contentDir absent → fallback PLAN_MISSING inchangé', async () => {
    const files = [F('Guide'), F('Architecture')];
    const noOpt = buildToc(null, files);
    expect(noOpt.warnings.map((w) => w.code)).toEqual(['PLAN_MISSING']);
    const emptyTitles = buildToc(null, files, {
      metaTitles: [],
      contentDir: '/x',
    });
    expect(emptyTitles.warnings.map((w) => w.code)).toEqual(['PLAN_MISSING']);
    const noDir = buildToc(null, files, { metaTitles });
    expect(noDir.warnings.map((w) => w.code)).toEqual(['PLAN_MISSING']);
    expect(noDir.toc.map((t) => t.title)).toEqual(['Guide', 'Architecture']);
  });
});

describe('parsePlan', () => {
  let tempDir: string | undefined;
  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });
  const writeTempYaml = async (content: string): Promise<string> => {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repowiki-plan-'));
    const p = path.join(tempDir, 'wiki_plan.yaml');
    await fs.writeFile(p, content, 'utf8');
    return p;
  };

  it('retourne null si illisible', async () => {
    expect(await parsePlan(null)).toBeNull();
  });

  it('retourne null si fichier absent ou yaml invalide', async () => {
    expect(await parsePlan('/nonexistent/wiki_plan.yaml')).toBeNull();
    expect(
      await parsePlan(await writeTempYaml('documents: [unclosed')),
    ).toBeNull();
  });

  it('lit repowiki.documents du fixture (fabrique)', async () => {
    // 0.1.8 : le fixture `fixtures/fake-project` vit désormais dans la
    // fabrique `createFixtureProject` — régénéré dans un tmpdir.
    const base = await fs.mkdtemp(
      path.join(os.tmpdir(), 'repowiki-plan-fixture-'),
    );
    try {
      const root = await createFixtureProject(path.join(base, 'fake-project'));
      const plan = await parsePlan(
        path.join(root, '.qoder', 'repowiki', 'wiki_plan.yaml'),
      );
      expect(plan?.documents).toEqual([
        { title: "Vue d'ensemble", goal: 'intro' },
        { title: 'Architecture', goal: 'arch' },
        { title: 'API', goal: 'api', parent: 'Architecture' },
      ]);
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it('accepte documents en racine et null si documents non-tableau', async () => {
    const plan = await parsePlan(
      await writeTempYaml('documents:\n  - title: A\n'),
    );
    expect(plan).toEqual({ documents: [{ title: 'A' }] });
    expect(await parsePlan(await writeTempYaml('documents: 42'))).toBeNull();
  });

  // Critical 2 (spec §6 « plan illisible → fallback ») : un `parent` non-string
  // (ici l'entier 42, contenu non maîtrisé) ne doit pas faire planter buildToc
  // (`(42).toLowerCase()` = TypeError → abort de l'export). parsePlan normalise
  // parent → undefined, le noeud est alors traité comme racine.
  it('parent non-string (42) normalisé → buildToc racine valide, ne lève pas', async () => {
    const plan = await parsePlan(
      await writeTempYaml(
        'documents:\n  - title: Architecture\n  - title: API\n    parent: 42\n',
      ),
    );
    const { toc } = buildToc(plan, [F('Architecture'), F('API')]);
    expect(toc.map((t) => t.title)).toEqual(['Architecture', 'API']);
    expect(toc.every((t) => t.level === 1)).toBe(true);
    expect(toc[1]?.children).toEqual([]);
  });
});
