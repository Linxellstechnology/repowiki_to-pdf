import { describe, expect, it } from 'vitest';
import { repairMermaidSource } from '../src/mermaid-repair.js';

// Les 6 repros minimales ci-dessous sont tirées du probe réel (out/probe,
// task-mermaid-probe-report.md) : chaque source « échoue » sous mermaid 12.1.0
// et la forme réparée a été VALIDÉE RENDUE OK dans le même harnais Electron.
// La promesse de rendu est prouvée par la validation réelle (437 blocs) et
// l'intégration ; ce fichier épingle la FORME de chaque réécriture.

// v0.1.9 : les repros R7/R8/R1-étendu (section 9) épinglent les sorties du
// diagnostic LinXells (.superpowers/sdd/…/task-linxells-diag-report.md) —
// sources VERBATIM des 4 blocs réels p-027/p-028/p-032/p-048, formes réparées
// proof-renderées OK sous mermaid 12.1.0 dans out/probe-linxells.

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

/* ------------------------------------------------------------------ *
 * v0.1.9 — R7 / R8 erDiagram + R1 étendu (boundary + 'activate')      *
 * Sources et formes réparées VERBATIM du diagnostic LinXells          *
 * (task-linxells-diag-report.md), proof-renderées OK sous mermaid      *
 * 12.1.0 dans le harnais out/probe-linxells.                            *
 * ------------------------------------------------------------------ */

const P048_SEQ_ACTIVATE_SRC = [
  'sequenceDiagram',
  'participant Client as "Client Browser"',
  'participant Page as "Services Store Page"',
  'participant Activate as "activateModuleAction"',
  'participant DB as "Supabase"',
  'Client->>Page : "Click Activate"',
  'Page->>Activate : "Invoke with propertyId, moduleKey"',
  'Activate->>DB : "Ensure permission (modules.manage)"',
  'Activate->>DB : "Update app_definitions.active_modules"',
  'DB-->>Activate : "OK"',
  'Activate-->>Page : "{ success : true }"',
  'Page-->>Client : "Revalidated UI"',
].join('\n');

const P048_SEQ_ACTIVATE_WANTED = [
  'sequenceDiagram',
  'participant Client as "Client Browser"',
  'participant Page as "Services Store Page"',
  'participant Activate_ as "activateModuleAction"',
  'participant DB as "Supabase"',
  'Client->>Page : "Click Activate"',
  'Page->>Activate_ : "Invoke with propertyId, moduleKey"',
  'Activate_->>DB : "Ensure permission (modules.manage)"',
  'Activate_->>DB : "Update app_definitions.active_modules"',
  'DB-->>Activate_ : "OK"',
  'Activate_-->>Page : "{ success : true }"',
  'Page-->>Client : "Revalidated UI"',
].join('\n');

const P028_ER_THREEWORD_SRC = [
  'erDiagram',
  'IDENTITIES {',
  'uuid id PK',
  'enum identity_status status',
  'text phone',
  'text whatsapp',
  'text first_name',
  'text last_name',
  'text job_title',
  'timestamptz created_at',
  'timestamptz updated_at',
  '}',
  'CONTACT_CHANNELS {',
  'uuid id PK',
  'uuid identity_id FK',
  'enum channel_type type',
  'text value',
  'enum verification_status verification_status',
  'timestamptz created_at',
  '}',
  'IDENTITIES ||--o{ CONTACT_CHANNELS : "owns"',
].join('\n');

const P028_ER_THREEWORD_WANTED = [
  'erDiagram',
  'IDENTITIES {',
  'uuid id PK',
  'enum-identity_status status',
  'text phone',
  'text whatsapp',
  'text first_name',
  'text last_name',
  'text job_title',
  'timestamptz created_at',
  'timestamptz updated_at',
  '}',
  'CONTACT_CHANNELS {',
  'uuid id PK',
  'uuid identity_id FK',
  'enum-channel_type type',
  'text value',
  'enum-verification_status verification_status',
  'timestamptz created_at',
  '}',
  'IDENTITIES ||--o{ CONTACT_CHANNELS : "owns"',
].join('\n');

// Repro VERBATIM (extrait) de p-027 : lignes `enum <type> <col>` multiples +
// lignes VALIDES à ne surtout pas toucher (PK,FK virgule, text[], jsonb).
const P027_ER_SCHEMA_SRC = [
  'erDiagram',
  'IDENTITIES {',
  'uuid id PK',
  'enum identity_status status',
  'text phone',
  'text whatsapp',
  'timestamptz created_at',
  'timestamptz updated_at',
  '}',
  'PROPERTY_SETTINGS {',
  'uuid property_id PK,FK',
  'text primary_language',
  'text[] secondary_languages',
  'text currency',
  'jsonb contact_info',
  'timestamptz updated_at',
  '}',
  'IDENTITIES ||--o{ CONTACT_CHANNELS : "owns"',
  'PROPERTIES ||--o{ PROPERTY_SETTINGS : "has"',
].join('\n');

const P027_ER_SCHEMA_WANTED = [
  'erDiagram',
  'IDENTITIES {',
  'uuid id PK',
  'enum-identity_status status',
  'text phone',
  'text whatsapp',
  'timestamptz created_at',
  'timestamptz updated_at',
  '}',
  'PROPERTY_SETTINGS {',
  'uuid property_id PK,FK',
  'text primary_language',
  'text[] secondary_languages',
  'text currency',
  'jsonb contact_info',
  'timestamptz updated_at',
  '}',
  'IDENTITIES ||--o{ CONTACT_CHANNELS : "owns"',
  'PROPERTIES ||--o{ PROPERTY_SETTINGS : "has"',
].join('\n');

// Repro VERBATIM (extrait) de p-032 : clés séparées par ESPACES `PK FK` ;
// la forme corrigée joint les clés par virgule EN GARDANT le nom de colonne
// séparé (`property_id PK,FK`) — la forme collée `property_idPK,FK` rendait
// mais affichait un nom de colonne faux dans le diagramme.
const P032_ER_SPACEKEYS_SRC = [
  'erDiagram',
  'PROPERTIES {',
  'uuid id PK',
  'string name',
  '}',
  'IRD_SETTINGS {',
  'uuid property_id PK FK',
  'boolean is_enabled',
  'boolean is_manual_offline',
  'text cover_image_url',
  'jsonb shifts',
  'timestamptz updated_at',
  '}',
  'PROPERTIES ||--o{ IRD_SETTINGS : "configured_by"',
].join('\n');

const P032_ER_SPACEKEYS_WANTED = [
  'erDiagram',
  'PROPERTIES {',
  'uuid id PK',
  'string name',
  '}',
  'IRD_SETTINGS {',
  'uuid property_id PK,FK',
  'boolean is_enabled',
  'boolean is_manual_offline',
  'text cover_image_url',
  'jsonb shifts',
  'timestamptz updated_at',
  '}',
  'PROPERTIES ||--o{ IRD_SETTINGS : "configured_by"',
].join('\n');

describe('repairMermaidSource — R9 (R1 étendu) : acteur « Activate » + boundary de renommage', () => {
  it('renomme Activate→Activate_ PARTOUT, y compris collé à gauche d’une flèche (repro p-048)', () => {
    const out = repairMermaidSource(P048_SEQ_ACTIVATE_SRC);
    expect(out).toBe(P048_SEQ_ACTIVATE_WANTED);
    // le texte du message entre guillemets n’est jamais renommé
    expect(out).toContain('"Click Activate"');
  });

  it('ne renommage pas Activation (boundary : mot plus long que le réservé)', () => {
    const src = [
      'sequenceDiagram',
      'participant Activation',
      'participant DB',
      'Activation->>DB : ping',
      'DB-->>Activation : pong',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });

  it('renomme Activate sans mordre sur Activation voisin dans le même bloc', () => {
    const src = [
      'sequenceDiagram',
      'participant Activate',
      'participant Activation',
      'Activate->>Activation : ping',
    ].join('\n');
    const out = repairMermaidSource(src);
    expect(out).toBe(
      [
        'sequenceDiagram',
        'participant Activate_',
        'participant Activation',
        'Activate_->>Activation : ping',
      ].join('\n'),
    );
  });
});

describe('repairMermaidSource — R7 erDiagram type à deux mots (3 mots nus)', () => {
  it('hyphénise `enum identity_status status` → `enum-identity_status status` (repro p-028)', () => {
    const out = repairMermaidSource(P028_ER_THREEWORD_SRC);
    expect(out).toBe(P028_ER_THREEWORD_WANTED);
  });

  it('repro p-027 : toutes les lignes enum réparées, lignes valides intactes (PK,FK / text[] / jsonb)', () => {
    const out = repairMermaidSource(P027_ER_SCHEMA_SRC);
    expect(out).toBe(P027_ER_SCHEMA_WANTED);
  });

  it('ne répare pas : lignes erDiagram valides (uuid id PK, text[] name, jsonb meta, PK,FK)', () => {
    const src = [
      'erDiagram',
      'X {',
      'uuid id PK',
      'text[] name',
      'jsonb meta',
      'uuid property_id PK,FK',
      '}',
      'X ||--o{ Y : "has"',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });

  it('ne répare pas : 3e mot = PK/FK/UK seul (déjà légal)', () => {
    const src = ['erDiagram', 'X {', 'text name UK', '}'].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — R8 erDiagram clés séparées par espaces', () => {
  it('joint `PK FK` en `PK,FK` (repro p-032, forme vérifiée au rendu)', () => {
    const out = repairMermaidSource(P032_ER_SPACEKEYS_SRC);
    expect(out).toBe(P032_ER_SPACEKEYS_WANTED);
  });

  it('ne répare pas : la forme à virgule `PK,FK` est déjà valide', () => {
    const src = [
      'erDiagram',
      'IRD_SETTINGS {',
      'uuid property_id PK,FK',
      'boolean is_enabled',
      '}',
    ].join('\n');
    expect(repairMermaidSource(src)).toBeNull();
  });
});

describe('repairMermaidSource — gardes d’en-tête et idempotence v0.1.9', () => {
  it('R7/R8 ne fuient pas hors erDiagram (garde par en-tête)', () => {
    // même forme de ligne sous classDiagram → aucune règle ne s’applique
    expect(
      repairMermaidSource('classDiagram\nenum identity status'),
    ).toBeNull();
  });

  it('idempotence : repair(repair(x)) ne modifie plus rien sur les 4 repros', () => {
    for (const src of [
      P048_SEQ_ACTIVATE_SRC,
      P028_ER_THREEWORD_SRC,
      P027_ER_SCHEMA_SRC,
      P032_ER_SPACEKEYS_SRC,
    ]) {
      const once = repairMermaidSource(src);
      expect(once).not.toBeNull();
      const twice = repairMermaidSource(once as string);
      // point fixe : la seconde passe est un no-op (null) ou identique
      expect(twice === null || twice === once).toBe(true);
    }
  });
});
