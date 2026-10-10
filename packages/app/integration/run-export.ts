/**
 * Task 14 — point d'entrée Electron headless du test d'intégration.
 *
 * Lancé par `electron integration/integration-run.mjs` (bootstrap .mjs car le
 * binaire Electron charge un fichier JS ; l'entry compilé vit dans
 * dist-electron/integration/run-export.js). Ce processus exécute VRAIMENT le
 * pipeline complet `runExport` (scan → plan → render → links → compose →
 * Mermaid offscreen → printToPDF → locateSections + polish → écriture), donc
 * la fenêtre offscreen `wikiapp://` — c'est exactement l'intégration exercée.
 *
 * Contrat de sortie :
 * - succès : PDF copié à `out/integration.pdf`, warnings écrits en JSON à
 *   `out/integration-warnings.json` (Task 0.1.3, assertion #10), log
 *   `INTEGRATION_EXPORT_RESULT {json}` (outputPath, pageCount, warnings),
 *   `app.exit(0)`.
 * - échec : log de l'erreur, `app.exit(1)`.
 *
 * Garde anti-early-quit : `window-all-closed` reçoit un écouteur NO-OP — la
 * fenêtre offscreen est détruite par runExport avant les phases polish/write
 * (pdfjs + pdf-lib, pur CPU) ; sans cet écouteur, le défaut Electron
 * (non-macOS) quitterait le process en plein milieu.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtureProject } from '@repowiki-pdf/core';
import { app } from 'electron';
import { runExport } from '../electron/export-service.js';
import {
  installWikiappHandler,
  registerWikiappPrivileges,
} from '../electron/protocol.js';
import type { ExportOptions } from '../src/ipc.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// ici = packages/app/dist-electron/integration → packages/app → racine du repo.
const appRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(appRoot, '../..');

const outDir = path.join(repoRoot, 'out');
const targetPdf = path.join(outDir, 'integration.pdf');

// Le schéma privé `wikiapp://` doit être déclaré avant ready (ruling n°5,
// même contrat que electron/main.ts).
registerWikiappPrivileges();
// Headless : pas de GPU ni de fenêtre visible utile — évite les problèmes de
// contexte graphique sur les machines sans display.
app.disableHardwareAcceleration();

async function main(): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  // 0.1.8 : plus de `fixtures/fake-project/` dans l'arbre (repo public) —
  // la fabrique `createFixtureProject` régénère le contenu identique
  // octet-par-octet dans un tmpdir. Sous-dossier `fake-project` : l'assertion #1 de
  // l'intégration vérifie « fake-project » sur la couverture (projectName
  // = basename de la racine projet).
  const tempBase = await fs.mkdtemp(
    path.join(os.tmpdir(), 'repowiki-integration-'),
  );
  try {
    const fixtureRoot = await createFixtureProject(
      path.join(tempBase, 'fake-project'),
    );
    const opts: ExportOptions = {
      projectRoot: fixtureRoot,
      language: 'en',
      pageSize: 'A4',
      includeCover: true,
      outputDir: outDir,
    };
    const noopEmit = (): void => {};
    const result = await runExport(opts, noopEmit);

    // runExport écrit `<projet>-Documentation.pdf` dans outputDir ; on le
    // renomme en `integration.pdf` pour figer le nom de l'artefact du test.
    await fs.rename(result.outputPath, targetPdf);

    // Task 0.1.3 : les warnings (dont MERMAID_INVALID avec le vrai message
    // mermaid + extrait de source) sont posés en JSON pour l'assertion #10.
    await fs.writeFile(
      path.join(outDir, 'integration-warnings.json'),
      `${JSON.stringify(result.warnings, null, 2)}\n`,
      'utf8',
    );

    console.log(
      'INTEGRATION_EXPORT_RESULT',
      JSON.stringify(
        {
          outputPath: targetPdf,
          pageCount: result.pageCount,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
  } finally {
    await fs.rm(tempBase, { recursive: true, force: true });
  }
}

app
  .whenReady()
  .then(() => {
    installWikiappHandler();
    return main();
  })
  .then(() => {
    app.exit(0);
  })
  .catch((error: unknown) => {
    console.error(
      'INTEGRATION_EXPORT_FAILED',
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    app.exit(1);
  });

// Écrase le quit-par-défaut (voir en-tête) : la fenêtre offscreen peut fermer
// avant la fin des phases polish/write, le process doit rester vivant.
app.on('window-all-closed', () => {});
