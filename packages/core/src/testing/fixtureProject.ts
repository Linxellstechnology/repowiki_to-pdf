/**
 * Fabrique de projet fixture (0.1.8 — pré-publication).
 *
 * L'ancien `fixtures/fake-project/` vivait dans l'arbre du dépôt ; le repo
 * devenant PUBLIC, le contenu de test est désormais EMBARQUÉ ici (chaînes
 * template + logo PNG en base64) et régénéré à la volée dans un répertoire
 * temporaires par `createFixtureProject(root)`.
 *
 * Parité OCTET-PAR-OCTET avec l'ancien fixture (vérifiée par
 * `test/domain-types-fixture.test.ts` + diff externe avant suppression) :
 * les checks d'intégration #9 (enum canary), #10 (diagramme invalide),
 * #11 (CmsEnvMode non indenté) et #12 (chaîne A0→A30 haute) dépendent de
 * ce contenu exact.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** PNG 1×1 transparent (70 octets) — l'ancien `en/content/assets/logo.png`. */
const LOGO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const WIKI_PLAN = `version: 1
repowiki:
  documents:
    - title: "Vue d'ensemble"
      goal: "intro"
    - title: "Architecture"
      goal: "arch"
    - title: "API"
      goal: "api"
      parent: "Architecture"
`;

const OVERVIEW = `# Vue d'ensemble

Texte d'introduction avec un [lien vers l'architecture](./2.%20Architecture.md) et un lien web https://example.com.
`;

// Trois diagrammes : graphe valide, classDiagram « enum canary » mermaid 12
// (ADR-0006), classDiagram non standard adapté par R4 (ADR-0008) — voir
// intégration #9/#11.
const ARCHITECTURE = `# Architecture

![logo](./assets/logo.png)

\`\`\`mermaid
graph TD
  A[Core] --> B[App]
\`\`\`

Voir l'[API](./3.%20Sous-systemes/3.1%20API.md#d%C3%A9tails).

\`\`\`mermaid
classDiagram
  class CmsRole {
    <<enum>>
    "editor"
    "admin"
  }
  class CmsAccessReader {
    +readCurrentAccess() CmsAccess|null
  }
  CmsAccessReader --> CmsRole : checks
\`\`\`

\`\`\`mermaid
classDiagram
class CmsEnvMode {
<<enum>>
"staging"
"production"
}
\`\`\`
`;

// Diagramme VOLONTAIREMENT invalide (MERMAID_INVALID, intégration #10) +
// table markdown ; l'ancre `#Détails` est la cible du lien de Architecture.
const API = `# API

## Détails

\`\`\`mermaid
graph TD
  X --->??? invalid
\`\`\`

| Col1 | Col2 |
|------|------|
| a    | b    |
`;

const ORPHAN = `# Orpheline

Page absente du plan.
`;

// Chaîne A0→A30 : diagramme plus haut que la page → réduit pour tenir sur
// une seule page imprimée (intégration #12).
const GRAND_SCHEMA = `# Grand Schema

\`\`\`mermaid
graph TD
  A0-->A1
  A1-->A2
  A2-->A3
  A3-->A4
  A4-->A5
  A5-->A6
  A6-->A7
  A7-->A8
  A8-->A9
  A9-->A10
  A10-->A11
  A11-->A12
  A12-->A13
  A13-->A14
  A14-->A15
  A15-->A16
  A16-->A17
  A17-->A18
  A18-->A19
  A19-->A20
  A20-->A21
  A21-->A22
  A22-->A23
  A23-->A24
  A24-->A25
  A25-->A26
  A26-->A27
  A27-->A28
  A28-->A29
  A29-->A30
\`\`\`

Ce schéma volontairement démesuré vérifie qu’un diagramme plus haut que la page est réduit pour tenir sur une seule page imprimée.
`;

type FixtureEntry =
  | { kind: 'text'; content: string }
  | { kind: 'binary'; base64: string };

/**
 * Arbre complet sous `<racine du wiki>` (= `<root>/.qoder/repowiki`),
 * chemins relatifs POSIX. Source de vérité unique de la fabrique.
 */
const FILES: Record<string, FixtureEntry> = {
  'wiki_plan.yaml': { kind: 'text', content: WIKI_PLAN },
  "en/content/1. Vue d'ensemble.md": { kind: 'text', content: OVERVIEW },
  'en/content/2. Architecture.md': { kind: 'text', content: ARCHITECTURE },
  'en/content/3. Sous-systemes/3.1 API.md': { kind: 'text', content: API },
  'en/content/5. Orpheline.md': { kind: 'text', content: ORPHAN },
  'en/content/6. Grand Schema.md': { kind: 'text', content: GRAND_SCHEMA },
  'en/content/assets/logo.png': { kind: 'binary', base64: LOGO_PNG_BASE64 },
};

/**
 * Chemins (relatifs à `<root>/.qoder/repowiki`) de tous les fichiers écrits
 * par `createFixtureProject` — triés. Utile pour Assert d’arborescence.
 */
export function fixtureProjectFiles(): string[] {
  return Object.keys(FILES).sort();
}

/**
 * Écrit l’arbre fixture (identique à l’ancien `fixtures/fake-project`) sous
 * `root/.qoder/repowiki/...` et retourne `root` (la racine « projet »).
 */
export async function createFixtureProject(root: string): Promise<string> {
  const wikiDir = path.join(root, '.qoder', 'repowiki');
  for (const [rel, entry] of Object.entries(FILES)) {
    const target = path.join(wikiDir, ...rel.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (entry.kind === 'text') {
      await fs.writeFile(target, entry.content, 'utf8');
    } else {
      await fs.writeFile(target, Buffer.from(entry.base64, 'base64'));
    }
  }
  return root;
}
