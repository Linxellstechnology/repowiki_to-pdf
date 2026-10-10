/**
 * Réparation ciblée du dialecte Mermaid « toléré par Qoder » (Task 0.1.3,
 * ADR-0008).
 *
 * Le probe réel (task-mermaid-probe-report.md, 437 blocs wiki sous mermaid
 * 12.1.0) a isolé 8 échecs, tous imputables à 6 constructions non standard
 * que seul le renderer Qoder digère. Chacune de ces 6 réécritures a été
 * VALIDÉE RENDUE OK dans le harnais Electron du probe (out/probe minires /
 * fixres / fix2res) — ce module n'ajoute RIEN d'inédit : il mechanicalise
 * exactement ces formes.
 *
 * Contrat :
 * - `repairMermaidSource(source)` retourne `null` quand AUCUNE règle ne
 *   s'applique (no-op total garanti sur les sources valides — on ne touche
 *   jamais une source qui rend déjà OK) ; sinon une COPIE réparée.
 * - Chaque règle est gardée par le type de diagramme (première ligne non
 *   vide) : `sequenceDiagram` pour R1, `flowchart`/`graph` pour R2/R3,
 *   `classDiagram` pour R4/R5/R6, `erDiagram` pour R7/R8 (ajouts v0.1.9,
 *   diagnostic LinXells task-linxells-diag-report.md — réécriture
 *   proof-rendue OK sous mermaid 12.1.0 dans out/probe-linxells).
 *   R1 est étendu en v0.1.9 (report : « R9 ») : mot réservé `activate`
 *   ajouté + boundary de renommage corrigée (`(?![\w-])` → `(?!\w)(?!-\w)`)
 *   pour les ids collés à gauche d'une flèche (`Activate->>DB`).
 * - Une syntaxe réellement cassée
 *   (`X --->??? invalid`) ne correspond à aucune règle → `null` : la
 *   réparation ne ressuscite jamais un diagramme invalide, le fallback
 *   `mermaid-fallback` + warning MERMAID_INVALID restent le filet.
 */

/** Mots réservés sequenceDiagram (jison, casse-insensible) impossibles en position d'acteur. */
const SEQUENCE_RESERVED = new Set([
  'actor',
  'activate',
  'alt',
  'and',
  'autonumber',
  'break',
  'call',
  'continuous',
  'create',
  'critical',
  'deactivate',
  'else',
  'end',
  'link',
  'loop',
  'note',
  'opt',
  'over',
  'par',
  'participant',
  'properties',
  'rect',
  'return',
  'signal',
  'title',
  'unlink',
]);

/** Opérateurs de flèche séquence utilisés « en position acteur » par R1. */
const SEQ_ARROW = '(?:->>|-->>|-->|->)';

interface DiagramContext {
  header: string;
  lines: string[];
  eol: string;
}

/**
 * En-tête = première ligne non vide (trimée). Retourne null si vide.
 */
function parseHeader(source: string): DiagramContext | null {
  const lines = source.split(/\r?\n/);
  let header = '';
  for (const line of lines) {
    const t = line.trim();
    if (t !== '') {
      header = t;
      break;
    }
  }
  if (header === '') return null;
  return { header, lines, eol: /\r\n/.test(source) ? '\r\n' : '\n' };
}

function startsWithDiag(ctx: DiagramContext, ...prefixes: string[]): boolean {
  return prefixes.some((p) => ctx.header.startsWith(p));
}

/** Neutralise les segments entre guillemets doubles (remplacés par des jetons
 *  « ␟+index » — caractère graphique de symbole, absent des sources wiki —)
 *  pour ne jamais les réécrire. */
function maskQuoted(line: string): { masked: string; parts: string[] } {
  const parts: string[] = [];
  const masked = line.replace(/"[^"]*"/g, (m) => {
    parts.push(m);
    return `\u241fQ${parts.length - 1}\u241f`;
  });
  return { masked, parts };
}

function unmaskQuoted(masked: string, parts: string[]): string {
  return masked.replace(
    /\u241fQ(\d+)\u241f/g,
    (_, n) => parts[Number(n)] ?? '',
  );
}

/**
 * Partie « code » d'une ligne sequenceDiagram : tout avant le premier ` : `
 * (le texte du message après le premier deux-points n'est jamais du code).
 * Les segments guillemetés sont masqués. Retourne aussi le ré-assembleur.
 */
function splitSeqCode(line: string): {
  code: string;
  restore: (c: string) => string;
} {
  const { masked, parts } = maskQuoted(line);
  const idx = masked.indexOf(' :');
  const code = idx === -1 ? masked : masked.slice(0, idx);
  const rest = idx === -1 ? '' : masked.slice(idx);
  return {
    code,
    restore: (c: string) => unmaskQuoted(rest === '' ? c : c + rest, parts),
  };
}

/* ------------------------------------------------------------------ *
 * R1 — sequenceDiagram : acteur identique à un mot réservé            *
 * ------------------------------------------------------------------ */

function repairSequence(ctx: DiagramContext): string | null {
  // 1. Identifier les mots réservés utilisés en POSITION d'acteur (flèche) ;
  //    sans cet usage, on ne répare pas (le bloc rend peut-être déjà OK).
  const renames = new Map<string, string>(); // orthographe exacte -> nouveau nom
  const arrowLeft = new RegExp(`^\\s*([A-Za-z_][\\w-]*)\\s*${SEQ_ARROW}`);
  const arrowRight = new RegExp(`${SEQ_ARROW}\\s*([A-Za-z_][\\w-]*)\\s*$`);
  for (const line of ctx.lines) {
    const { code } = splitSeqCode(line);
    for (const re of [arrowLeft, arrowRight]) {
      const id = code.match(re)?.[1];
      if (id && SEQUENCE_RESERVED.has(id.toLowerCase()) && !renames.has(id)) {
        renames.set(id, `${id}_`);
      }
    }
  }
  if (renames.size === 0) return null;
  // Éviter de produire un id déjà présent dans le bloc.
  const taken = new Set<string>();
  for (const line of ctx.lines) {
    const { code } = splitSeqCode(line);
    for (const m of code.matchAll(/(?<![\w-])([A-Za-z_][\w-]*)(?![\w-])/g)) {
      if (m[1]) taken.add(m[1]);
    }
  }
  for (const [id, target] of renames) {
    let name = target;
    while (taken.has(name)) name = `${name}_`;
    renames.set(id, name);
  }
  // 2. Appliquer le renommage partout en position identifiant (hors
  //    guillemets et hors texte de message). Boundary v0.1.9 (report « R9 ») :
  //    l'ancien `(?![\w-])` refusait de renommer un id suivi du `-` d'une
  //    flèche (`Activate->>DB`) → renommage partiel toujours INVALID.
  //    `(?!\w)(?!-\w)` autorise le `-` de départ de flèche tout en
  //    protégeant les ids hyphenés (`Activate-job`) et les mots plus longs
  //    (`Activation`).
  let changed = false;
  const out = ctx.lines.map((line) => {
    const { code, restore } = splitSeqCode(line);
    let next = code;
    for (const [id, name] of renames) {
      const re = new RegExp(
        `(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)(?!-\\w)`,
        'g',
      );
      if (re.test(next)) {
        next = next.replace(re, name);
        changed = true;
      }
    }
    return restore(next);
  });
  return changed ? out.join(ctx.eol) : null;
}

/* ------------------------------------------------------------------ *
 * R2 — flowchart : flèche inexistante ` ->|label|`                    *
 * ------------------------------------------------------------------ */

function repairFlowArrow(lines: string[]): string | null {
  // ` ->|` (espace avant `->|`) n'existe pas dans la grammaire ; la forme
  // valide est ` -->|`. Les formes déjà valides `-->|` et `--> |` ne
  // contiennent jamais `espace + '-' + '>' + '|'` adjacents → aucun faux positif.
  const out = lines.map((line) => line.replace(/(\s)->\|/g, '$1-->|'));
  return out.join('\n') === lines.join('\n') ? null : out.join('\n');
}

/* ------------------------------------------------------------------ *
 * R3 — flowchart : `Note over X,Y : …` (syntaxe sequenceDiagram)      *
 * ------------------------------------------------------------------ */

function repairFlowNote(ctx: DiagramContext): string | null {
  const noteRe =
    /^\s*Note\s+over\s+([A-Za-z0-9_]+)(\s*,\s*[A-Za-z0-9_]+)*\s*:\s*(.*)$/;
  const candidates = ctx.lines.filter((l) => noteRe.test(l));
  if (candidates.length === 0) return null;
  // Ids N<n> déjà utilisés dans le bloc → on numérote au-delà (validated
  // harness form used N1; collision avoidance est de notre cru, prudent).
  const usedIds = new Set<string>();
  for (const line of ctx.lines) {
    for (const m of line.matchAll(/(?<![\w])N(\d+)(?![\w])/g)) {
      usedIds.add(`N${m[1]}`);
    }
  }
  let counter = 0;
  const nextId = (): string => {
    let id = '';
    do {
      counter += 1;
      id = `N${counter}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  let changed = false;
  const out = ctx.lines.map((line) => {
    const m = line.match(noteRe);
    if (!m) return line;
    const first = m[1] ?? '';
    const text = (m[3] ?? '').trim().replace(/"/g, "'");
    changed = true;
    return `${first} -.- ${nextId()}(["Note: ${text}"])`;
  });
  return changed ? out.join('\n') : null;
}

/* ------------------------------------------------------------------ *
 * Règles classDiagram (R4, R5, R6)                                    *
 * ------------------------------------------------------------------ */

/** R4 — membres entre guillemets dans un corps `<<enum>>`/`<<union>>` → dé-quotter. */
function repairClassQuotedMembers(lines: string[]): string | null {
  let changed = false;
  let inStruct = false;
  let inStereotype = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!inStruct && /^\s*class\s+[A-Za-z_][\w-]*\s*\{\s*$/.test(line)) {
      inStruct = true;
      return line;
    }
    if (inStruct) {
      if (trimmed === '}') {
        inStruct = false;
        inStereotype = false;
        return line;
      }
      if (/^<<\s*(enum|union)\s*>>$/.test(trimmed)) {
        inStereotype = true;
        return line;
      }
      if (inStereotype && /^"(.+)"$/.test(trimmed)) {
        changed = true;
        const indent = line.slice(0, line.length - line.trimStart().length);
        return indent + trimmed.slice(1, -1);
      }
    }
    return line;
  });
  return changed ? out.join('\n') : null;
}

/** R5 — accolades dans une générique `~…~` → strip (forme validée `PromiseLike~data,error~`). */
function repairClassGenerics(lines: string[]): string | null {
  let changed = false;
  const out = lines.map((line) => {
    if (!line.includes('~')) return line;
    const next = line.replace(/(~[^~\n]*~)/g, (span) => {
      if (!/[{}]/.test(span)) return span;
      changed = true;
      return span.replace(/[{}]/g, '');
    });
    return next;
  });
  return changed ? out.join('\n') : null;
}

/** R6 — cible de relation nue séparée par `|` (`h1|h2|h3`) → une relation par ligne. */
function repairClassPipeTargets(lines: string[]): string | null {
  let changed = false;
  let depth = 0;
  const out: string[] = [];
  const relRe = /(^|\s)(-->|<--|\.\.>|<\.\.|\*--|o--|--\|\*|--o)/;
  for (const line of lines) {
    const trimmed = line.trim();
    // À l'intérieur d'un `class X { … }`, un `Type|null` en ligne membre
    // n'est PAS une relation → on saute (cf. guard test CmsAccess|null).
    const insideStruct = depth > 0;
    depth += (line.match(/\{/g) ?? []).length;
    if (trimmed.includes('}'))
      depth = Math.max(0, depth - (line.match(/\}/g) ?? []).length);
    if (insideStruct) {
      out.push(line);
      continue;
    }
    const m = line.match(
      /^(\s*)(\S(?:.*\S)?)\s+([A-Za-z_][A-Za-z0-9_]*(?:\|[A-Za-z0-9_]+)+)\s*$/,
    );
    const relation = m?.[2] ?? '';
    const target = m?.[3] ?? '';
    if (m && target !== '' && relRe.test(relation)) {
      const indent = m[1] ?? '';
      for (const part of target.split('|')) {
        out.push(`${indent}${relation} ${part}`);
      }
      changed = true;
      continue;
    }
    out.push(line);
  }
  return changed ? out.join('\n') : null;
}

/* ------------------------------------------------------------------ *
 * Règles erDiagram (R7, R8) — ajouts v0.1.9                            *
 * ------------------------------------------------------------------ */

/** Clés de contrainte erDiagram déjà légales comme 3e mot seul. */
const ER_KEY = /^(PK|FK|UK)$/;

/**
 * R7 — erDiagram : ligne d'attribut de EXACTEMENT 3 mots nus dont le 3e
 * n'est pas PK/FK/UK (`enum identity_status status` = type à deux mots +
 * colonne, dialecte toléré par Qoder, pas par la grammaire mermaid 12).
 * Réécriture validée au rendu : hyphenation des deux mots de type →
 * `enum-identity_status status` (le trait d'union est dans ATTRIBUTE_WORD).
 * Les lignes de relation (`A ||--o{ B : "x"`) ne matchent jamais.
 */
function repairErThreeWord(lines: string[]): string | null {
  const re =
    /^([ \t]*)([A-Za-z][\w\[\]-]*) ([A-Za-z][\w-]*) ([A-Za-z][\w-]*)[ \t]*$/;
  let changed = false;
  const out = lines.map((line) => {
    const m = line.match(re);
    if (!m) return line;
    const [, ind = '', w1 = '', w2 = '', w3 = ''] = m;
    if (ER_KEY.test(w3)) return line;
    changed = true;
    return `${ind}${w1}-${w2} ${w3}`;
  });
  return changed ? out.join('\n') : null;
}

/**
 * R8 — erDiagram : plusieurs clés de contrainte séparées par ESPACES
 * (`uuid property_id PK FK`) ; mermaid 12 exige des clés jointes par
 * virgules (`PK,FK`). Ne fire que quand les mots nus de fin sont tous
 * PK/FK/UK (2 à 3). Forme proof-renderée : `uuid property_idPK,FK`.
 */
function repairErSpaceKeys(lines: string[]): string | null {
  const re =
    /^([ \t]*)([A-Za-z][\w\[\]-]*) ([A-Za-z][\w-]*)((?: (?:PK|FK|UK)){2,3})[ \t]*$/;
  let changed = false;
  const out = lines.map((line) => {
    const m = line.match(re);
    if (!m) return line;
    const [, ind = '', t = '', n = '', keys = ''] = m;
    changed = true;
    return `${ind}${t} ${n}${keys.trim().split(' ').join(',')}`;
  });
  return changed ? out.join('\n') : null;
}

/* ------------------------------------------------------------------ *
 * Entrée publique                                                     *
 * ------------------------------------------------------------------ */

/**
 * Applique les 8 réécritures validées par les probes (R1–R6 task 0.1.3,
 * R7/R8 + extension R1 v0.1.9), gardées par type de diagramme. Retourne
 * `null` si aucune règle ne s'applique (no-op), sinon la copie réparée de
 * `source`.
 */
export function repairMermaidSource(source: string): string | null {
  const ctx = parseHeader(source);
  if (!ctx) return null;
  const render = (lines: string[]): string => lines.join(ctx.eol);

  let current: string[] | null = null;
  const apply = (fn: (lines: string[]) => string | null): void => {
    const base = current ?? ctx.lines;
    const next = fn(base);
    if (next !== null) current = next.split('\n');
  };

  if (startsWithDiag(ctx, 'sequenceDiagram')) {
    // R1 uniquement (les Notes/acteurs légitimes ne sont pas touchés).
    const out = repairSequence(ctx);
    if (out !== null) return out;
    return null;
  }
  if (startsWithDiag(ctx, 'erDiagram')) {
    apply(repairErThreeWord); // R7
    apply(repairErSpaceKeys); // R8 (sur les lignes déjà passées par R7)
    return current === null ? null : render(current);
  }
  if (startsWithDiag(ctx, 'flowchart', 'graph')) {
    apply(repairFlowArrow); // R2
    const base = current ?? ctx.lines;
    // R3 travaille sur les lignes déjà éventuellement corrigées par R2.
    const r3 = repairFlowNote({ ...ctx, lines: base });
    if (r3 !== null) current = r3.split('\n');
    return current === null ? null : render(current);
  }
  if (startsWithDiag(ctx, 'classDiagram')) {
    apply(repairClassQuotedMembers); // R4
    apply(repairClassGenerics); // R5
    apply(repairClassPipeTargets); // R6
    return current === null ? null : render(current);
  }
  // Types non sondés (stateDiagram, pie, gantt…) : aucune règle validée.
  return null;
}
