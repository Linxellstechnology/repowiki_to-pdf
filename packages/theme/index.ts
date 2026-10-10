import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Assemble le CSS du thème en concaténant `repowiki.css` (palette RepoWiki/GitHub,
 * styles de rendu) puis `print-a4.css` (pagination A4, `@page`, `page-break-*`)
 * au runtime : aucun bundle — les fichiers sont lus comme texte.
 *
 * Le dossier du package est résolu via `fileURLToPath(import.meta.url)` (ruling
 * contrôleur n°1) : `new URL(import.meta.url).pathname` produit un chemin invalide
 * sous Windows (`/C:/...`), alors que `fileURLToPath` normalise correctement.
 *
 * Ruling contrôleur Task 12 n°3 (option a, miroir de `@repowiki-pdf/core`) : le
 * package a désormais un build (`tsconfig.build.json` → `dist/index.js`) et une
 * map `exports` (`types` → source pour TS, `default` → dist pour le runtime
 * Electron/Node ESM, qui ne sait pas charger du `.ts`). Les CSS ne sont PAS copiés
 * dans `dist` : `readCss` tente d'abord le dossier du module (`dist/` en runtime
 * compilé, racine du package en source) puis remonte d'un cran — les fichiers
 * restent donc trouvables dans les deux modes, et l'arborescence `packages/theme`
 * complète (avec les `.css`) est empaquetée telle quelle par electron-builder
 * (Task 15).
 *
 * Consommé par l'app Electron (Task 12, `export-service.ts`) — qui injecte la
 * chaîne dans `<style>` via le composeur — et par `packages/core/test/theme.test.ts`
 * (alias vitest pointant sur la source, pour que le test reste vert sans build).
 */
export async function loadThemeCss(): Promise<string> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const [repowiki, printA4] = await Promise.all([
    readCss(dir, 'repowiki.css'),
    readCss(dir, 'print-a4.css'),
  ]);
  return `${repowiki}\n${printA4}`;
}

/** CSS lu à côté du module ; à défaut, un cran plus haut (cas `dist/index.js`). */
async function readCss(dir: string, name: string): Promise<string> {
  try {
    return await fs.readFile(path.join(dir, name), 'utf8');
  } catch {
    return await fs.readFile(path.join(dir, '..', name), 'utf8');
  }
}
