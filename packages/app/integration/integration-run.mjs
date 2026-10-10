/**
 * Task 14 — bootstrap Electron du test d'intégration.
 * Le binaire Electron charge un fichier JS ; ce .mjs (format non ambigu,
 * package "type": "module") importe simplement l'entrée compilée TypeScript
 * `dist-electron/integration/run-export.js`.
 * Lancé par : `npm -w @repowiki-pdf/app run test:integration`
 *             (script = build:electron && electron integration/integration-run.mjs
 *              && node integration/assert.mjs)
 */
await import('../dist-electron/integration/run-export.js');
