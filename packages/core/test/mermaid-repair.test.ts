import { describe, expect, it } from 'vitest';
import { repairMermaidSource } from '../src/mermaid-repair.js';

// Les 6 repros minimales ci-dessous sont tirées du probe réel (out/probe,
// task-mermaid-probe-report.md) : chaque source « échoue » sous mermaid 12.1.0
// et la forme réparée a été VALIDÉE RENDUE OK dans le même harnais Electron.
// La promesse de rendu est prouvée par la validation réelle (437 blocs) et
// l'intégration ; ce fichier épingle la FORME de chaque réécriture.

describe('repairMermaidSource — R1 sequenceDiagram acteur mot réservé', () => {
  it('renomme Title (collision avec le mot réservé title) en Title_ partout en position identifiant', () => {
    const src = [
      'sequenceDiagram',
      'participant A',
      'participant Title as "EditorialTitle"',
      'A->>Title : Render page heading',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('participant Title_ as "EditorialTitle"');
    expect(out).toContain('A->>Title_ : Render page heading');
    // l'alias entre guillemets n'est JAMAIS renommé
    expect(out).toContain('"EditorialTitle"');
    expect(out).not.toMatch(/participant Title\s+as/);
  });

  it('traite le bloc réel (6 participants, note over intacte, seul Title collide)', () => {
    const src = [
      'sequenceDiagram',
      'participant Page as "Public Page"',
      'participant Shell as "PublicShell"',
      'participant Container as "Container"',
      'participant Section as "Section"',
      'participant Title as "EditorialTitle"',
      'participant Action as "ActionLink"',
      'Page->>Shell : Render shell with locale and route',
      'Shell->>Container : Wrap page content',
      'Container->>Section : Provide semantic content area',
      'Section->>Title : Render page heading',
      'Section->>Action : Render back or navigation action',
      'Note over Page,Action : Layout follows tokens and accessible semantics',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('Section->>Title_ : Render page heading');
    expect(out).toContain('participant Title_ as "EditorialTitle"');
    // rien d'autre ne bouge
    expect(out).toContain('Note over Page,Action :');
    expect(out).toContain('participant Action as "ActionLink"');
  });

  it('ne répare pas : le mot réservé apparaît seulement comme alias entre guillemets', () => {
    const src = [
      'sequenceDiagram',
      'participant A as "title"',
      'participant B',
      'A->>B : ok',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });

  it('ne répare pas : participant réservé sans usage en position flèche', () => {
    const src = [
      'sequenceDiagram',
      'participant Title',
      'participant A',
      'A->>A : self',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R2 flowchart ->|label|', () => {
  it('corrige ->| en -->| (repro probe #10)', () => {
    const src = ['flowchart TD', 'A["a"] ->|label| B["b"]'].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('A["a"] -->|label| B["b"]');
    expect(out).not.toContain(' ->|');
  });

  it('ne touche pas les formes valides -->| et --> | (idem)', () => {
    const src = [
      'flowchart TD',
      'A["a"] -->|label| B["b"]',
      'B --> |Valid| C["c"]',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R3 Note over X,Y dans un flowchart', () => {
  it('convertit la note en nœud à lien pointillé (forme validée par le probe)', () => {
    const src = [
      'flowchart TD',
      'EnvStart["Process starts"] --> LoadEnv["Load env"]',
      'Note over EnvStart,LoadEnv : runtime note',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).not.toMatch(/Note over/);
    // lien pointillé depuis le PREMIER nœud listé + label stadium quotté
    expect(out).toContain('EnvStart -.- N1(["Note: runtime note"])');
  });

  it('numérote N1, N2… et évite un id N1 déjà utilisé', () => {
    const src = [
      'flowchart TD',
      'A["a"] --> B["b"]',
      'N1["exists"] --> C["c"]',
      'Note over A,B : first',
      'Note over B,C : second',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('A -.- N2(["Note: first"])');
    expect(out).toContain('B -.- N3(["Note: second"])');
    expect(out).toContain('N1["exists"]');
  });

  it('ne répare pas : Note over légitime dans un sequenceDiagram', () => {
    const src = [
      'sequenceDiagram',
      'participant A',
      'participant B',
      'A->>B : hi',
      'Note over A,B : fine',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R4 <<enum>>/<<union>> à membres quottés', () => {
  it('dé-quotte les membres dans un bloc <<enum>> (repro probe #6)', () => {
    const src = [
      'classDiagram',
      'class CmsRole {',
      '<<enum>>',
      '"editor"',
      '"admin"',
      '}',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('editor');
    expect(out).not.toContain('"editor"');
    expect(out).not.toContain('"admin"');
    expect(out).toContain('<<enum>>');
  });

  it('dé-quotte dans <<union>> et préserve l’indentation', () => {
    const src = [
      'classDiagram',
      'class CommandIconName {',
      '  <<union>>',
      '  "heading2"',
      '  "bold"',
      '}',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('  heading2');
    expect(out).toContain('  bold');
  });

  it('ne répare pas : membres hors bloc stereotype, attributs quottés elsewhere', () => {
    const src = [
      'classDiagram',
      'class IconPath {',
      '+string[] d',
      '+boolean evenOdd',
      '}',
      'class CommandIcon {',
      '+name : CommandIconName',
      '}',
      'CommandIcon --> IconPath : "lookup"',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R5 generique ~{a,b}~', () => {
  it('retire les accolades dans ~…~ (repro probe #8)', () => {
    const src = [
      'classDiagram',
      'class RpcExecutor {',
      '+rpc(functionName) PromiseLike~{data,error}~',
      '}',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('PromiseLike~data,error~');
    expect(out).not.toContain('{data,error}');
  });

  it('ne touche pas les generiques ~…~ sans accolades', () => {
    const src = [
      'classDiagram',
      'class mediaAssets {',
      '+Record~MediaId, MediaAsset~',
      '}',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R6 cible de relation en h1|h2|h3', () => {
  it('scinde les cibles séparées par | en une relation par ligne (validé harness)', () => {
    const src = [
      'classDiagram',
      'class EditorialTitle',
      'EditorialTitle --> "renders" h1|h2|h3',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).toContain('EditorialTitle --> "renders" h1');
    expect(out).toContain('EditorialTitle --> "renders" h2');
    expect(out).toContain('EditorialTitle --> "renders" h3');
    expect(out).not.toContain('h1|h2|h3');
  });

  it('laisse intactes les relations sans | et les membres type~…~|…', () => {
    const src = [
      'classDiagram',
      'class Container',
      'class div',
      'Container --> "renders" div',
      'class CmsAccessReader {',
      '+readCurrentAccess() CmsAccess|null',
      '}',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — garanties globales', () => {
  it('combine plusieurs règles dans un même bloc (R4 + R5)', () => {
    const src = [
      'classDiagram',
      'class CmsRole {',
      '<<enum>>',
      '"editor"',
      '}',
      'class RpcExecutor {',
      '+rpc(f) PromiseLike~{data,error}~',
      '}',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).not.toBeNull();
    expect(out).not.toContain('"editor"');
    expect(out).toContain('PromiseLike~data,error~');
  });

  it('retourne null (no-op) pour les diagrammes valides', () => {
    expect(repairMermaidSource('graph TD\n  A[Core] --> B[App]')).toBeNull();
    expect(
      repairMermaidSource(
        'sequenceDiagram\nparticipant A as "Alpha"\nparticipant B\nA->>B : hello',
      ),
    ).toBeNull();
    expect(
      repairMermaidSource('classDiagram\nclass CmsRole {\n<<enum>>\neditor\n}'),
    ).toBeNull();
  });

  it('ne répare PAS la syntaxe réellement cassée (X --->???) — null', () => {
    expect(repairMermaidSource('graph TD\n  X --->??? invalid')).toBeNull();
  });

  it('ignore les règles si l’en-tête ne correspond pas (Garde par type)', () => {
    // R6 (classDiagram) ne s’applique pas sous un en-tête flowchart
    expect(
      repairMermaidSource('flowchart TD\nA --> "renders" h1|h2|h3'),
    ).toBeNull();
    // R2 (flowchart/graph) ne s’applique pas sous classDiagram
    expect(repairMermaidSource('classDiagram\nA ->|label| B')).toBeNull();
  });

  it('null sur entrée vide ou sans en-tête reconnu', () => {
    expect(repairMermaidSource('')).toBeNull();
    expect(repairMermaidSource('juste du texte\nsans diagramme')).toBeNull();
  });

  it('déclare dans index.ts à côté des autres exports core', async () => {
    const core = await import('../src/index.js');
    expect(typeof core.repairMermaidSource).toBe('function');
  });
});
