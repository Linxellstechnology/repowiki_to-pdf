import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

/**
 * Résolution du bundle Mermaid servi à la fenêtre offscreen (ruling n°4 :
 * hors-ligne, aucun CDN). On utilise le UMD auto-suffisant
 * `node_modules/mermaid/dist/mermaid.min.js` (≈3,5 Mo, définit `globalThis.mermaid`
 * avec tous ses chunks internes) plutôt qu'un ESM à chunks dynamiques : c'est le
 * chemin le plus fiable en page offscreen Electron 33, sans bundler supplémentaire.
 *
 * Le fichier est copié (idempotent, sur différence de taille) dans
 * `userData/offscreen/` au premier run — comme le brief — et c'est ce dossier
 * que sert le protocole privé `wikiapp://`. En app packagée, electron-builder
 * (Task 15) déposera le même fichier sous `resources/mermaid/mermaid.min.js`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

const mermaidCandidates = [
  // dev : dist-electron/electron -> packages/app/dist-electron -> packages/app
  //      -> repo root/node_modules (workspaces hoistent mermaid à la racine)
  path.resolve(here, '../../../../node_modules/mermaid/dist/mermaid.min.js'),
  // dev, variante si le workspace installe mermaid sous packages/app
  path.resolve(here, '../../../node_modules/mermaid/dist/mermaid.min.js'),
  // packagé (Task 15)
  process.resourcesPath
    ? path.join(process.resourcesPath, 'mermaid', 'mermaid.min.js')
    : '',
];

async function locateMermaidUmd(): Promise<string> {
  for (const candidate of mermaidCandidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // candidate absent : on tente le suivant
    }
  }
  throw new Error(
    'Bundle Mermaid introuvable (node_modules/mermaid/dist/mermaid.min.js).',
  );
}

/** Dossier servi par `wikiapp://offscreen/…` (userData/offscreen). */
export function offscreenDir(): string {
  return path.join(app.getPath('userData'), 'offscreen');
}

let ready: Promise<string> | null = null;

/** Copie idempotente des assets offscreen ; renvoie le dossier servi. */
export function ensureOffscreenAssets(): Promise<string> {
  ready ??= doEnsureOffscreenAssets();
  return ready;
}

async function doEnsureOffscreenAssets(): Promise<string> {
  const dir = offscreenDir();
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, 'mermaid.min.js');
  const src = await locateMermaidUmd();
  const [srcStat, destStat] = await Promise.all([
    fs.stat(src),
    fs.stat(dest).catch(() => null),
  ]);
  if (!destStat || destStat.size !== srcStat.size) {
    await fs.copyFile(src, dest);
  }
  return dir;
}
