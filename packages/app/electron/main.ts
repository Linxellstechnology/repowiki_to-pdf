import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { scanProject } from '@repowiki-pdf/core';
import { BrowserWindow, Menu, app, dialog, ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { CH } from '../src/ipc.js';
import type {
  ExportOptions,
  IpcResult,
  PreviewResult,
  ProgressEvent,
  UiLang,
} from '../src/ipc.js';
import { composePreviewHtml, runExport } from './export-service.js';
import { buildAppMenu } from './menu.js';
import { buildPrintCommand } from './print-command.js';
import {
  installWikiappHandler,
  registerWikiappPrivileges,
} from './protocol.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

// Protocole privé `wikiapp://` (Task 12) : les privilèges de schéma doivent être
// déclarés AVANT app.whenReady ; le handler est installé après ready.
registerWikiappPrivileges();

// Politique d'erreur (ruling n°5) : les invokes ne rejettent jamais.
// WikiNotFoundError (message français prêt à afficher) et toute autre erreur
// sont sérialisés en { ok: false, error: string } via cette enveloppe.
async function guard<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (cause) {
    // 0.1.11 : si l'erreur porte un code machine (+ jetons `vars`), il est
    // sérialisé avec le message brut → phrase localisée côté renderer.
    const code = (cause as { code?: unknown } | undefined | null)?.code;
    const vars = (cause as { vars?: unknown } | undefined | null)?.vars;
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
      ...(typeof code === 'string' ? { errorCode: code } : {}),
      ...(typeof vars === 'object' && vars !== null
        ? { errorVars: vars as Record<string, string> }
        : {}),
    };
  }
}

function registerIpc(): void {
  ipcMain.handle(CH.scan, (_event, projectRoot: string) =>
    guard(() => scanProject(projectRoot)),
  );

  ipcMain.handle(CH.pickFolder, (_event) =>
    guard(async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    }),
  );

  // Task 12 : export/preview délèguent au pipeline réel (electron/export-service.ts).
  ipcMain.handle(CH.export, (event: IpcMainInvokeEvent, opts: ExportOptions) =>
    guard(() =>
      runExport(opts, (progress: ProgressEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(CH.progress, progress);
        }
      }),
    ),
  );

  ipcMain.handle(CH.preview, (_event, opts: ExportOptions) =>
    guard<PreviewResult>(async () => ({
      html: await composePreviewHtml(opts),
    })),
  );

  // shell.openPath renvoie '' quand OK, sinon le message d'erreur système.
  ipcMain.handle(CH.openPdf, (_event, pdfPath: string) =>
    guard(async () => {
      const failure = await shell.openPath(pdfPath);
      if (failure !== '') throw new Error(failure);
      return pdfPath;
    }),
  );

  // Impression : l'association Windows du type « print » (imprimante par
  // défaut) via PowerShell Start-Process -Verb Print. SÉCURITÉ (revue, Finding
  // 1 CRITICAL) : `-Command` recaténaterait le tableau en un SCRIPT relu par
  // PowerShell — un chemin `$(…)`/backtick (NTFS-légal, dérivé du projectName)
  // deviendrait de l'exécution arbitraire. On délègue donc à `buildPrintCommand`
  // qui passe le script complet en `-EncodedCommand` (UN seul token base64,
  // insensible au shell ET à l'espace de script PS). Le chemin est d'abord
  // validé (.pdf + existence), l'exécutable est codé en dur, et toute erreur
  // remonte en { ok: false } via guard (ruling n°5).
  ipcMain.handle(CH.printPdf, (_event, pdfPath: string) =>
    guard(async () => {
      if (!pdfPath.toLowerCase().endsWith('.pdf')) {
        throw new Error('Invalid export path: .pdf extension required.');
      }
      if (!existsSync(pdfPath)) {
        throw new Error(`File not found: ${pdfPath}`);
      }
      await execFileAsync('powershell.exe', buildPrintCommand(pdfPath));
      return pdfPath;
    }),
  );

  // 0.1.6 i18n : le renderer envoie sa langue (persistée en localStorage,
  // inaccessible au main) à chaque changement ET au montage. Le menu
  // applicatif est reconstruit dans cette langue. Validation stricte :
  // toute valeur autre que 'zh' retombe sur 'en' (jamais de label
  // undefined dans le template).
  ipcMain.handle(CH.setUiLanguage, (_event, lang: UiLang) =>
    guard(async () => {
      Menu.setApplicationMenu(buildAppMenu(lang === 'zh' ? 'zh' : 'en'));
      return null;
    }),
  );
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    // Branding 0.1.5 : titre de fenêtre (barre de titre Windows) en
    // majuscules, identique au h1 du renderer et au <title> de index.html.
    title: 'REPOWIKI TO PDF',
    // Icône runtime (barre de titre + taskbar). Le fichier est expédié DANS
    // l'asar via electron-builder `files` (build/icon.png) — le chemin
    // résout donc en tous lieux, dev comme packagé, sans rcedit.
    icon: path.join(here, '../../build/icon.png'),
    webPreferences: {
      // Le preload est émis en `.mjs` (source `preload.mts`) : Electron 33 ne
      // charge un preload comme module ESM que si l'EXTENSION du fichier est
      // `.mjs` — avec `.js` il force CJS et le `import` échoue en silence
      // (window.api absent). sandbox:false reste requis pour un preload ESM ;
      // l'isolation vient de contextIsolation + de l'API explicite du preload
      // (aucune exposition d'objets Node).
      preload: path.join(here, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Smoke test du conteneur principal (`--smoke-window`, script test:window) :
  // prouve que la fenêtre SE CHARGE réellement (chemin renderer, preload) —
  // une régression de chemin rendait la fenêtre blanche sans aucun test rouge.
  if (process.argv.includes('--smoke-window')) {
    const wc = win.webContents;
    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedUrl) => {
      console.error(
        `SMOKE FAIL did-fail-load ${errorCode} ${errorDescription} ${validatedUrl}`,
      );
      app.exit(1);
    });
    // Le preload s'exécute AVANT les scripts de la page : à la fin du chargement,
    // window.api doit être exposé par contextBridge. S'il manque, le preload n'a
    // PAS été chargé (ex. mauvais format de module) — la page paraît saine mais
    // tous les boutons échouent en silence : c'est LA régression à bloquer.
    wc.on('did-finish-load', () => {
      void (async () => {
        const apiReady: unknown = await wc.executeJavaScript(
          'typeof window.api === "object" && typeof window.api.scan === "function" && typeof window.api.pickFolder === "function" && typeof window.api.printPdf === "function"',
        );
        if (apiReady !== true) {
          console.error('SMOKE FAIL window.api absent (preload non chargé)');
          app.exit(3);
          return;
        }
        console.log('SMOKE OK window loaded');
        app.exit(0);
      })().catch((error: unknown) => {
        console.error(
          'SMOKE FAIL évaluation de window.api impossible :',
          error instanceof Error ? error.message : String(error),
        );
        app.exit(3);
      });
    });
    setTimeout(() => {
      console.error(
        'SMOKE FAIL timeout (15s) — la page ne finit pas de charger',
      );
      app.exit(2);
    }, 15000);
  }

  const devServerUrl = process.env.VITE_DEV_SERVER;
  if (devServerUrl) {
    // Dev : le renderer est servi par Vite (`npm -w @repowiki-pdf/app run dev`).
    void win.loadURL(devServerUrl);
  } else {
    // Layout de build : dist-renderer est FRÈRE de dist-electron (racine du
    // package, et racine de l'asar une fois packagé). main.js vit dans
    // dist-electron/electron/ → il faut remonter de deux niveaux.
    void win.loadFile(path.join(here, '../../dist-renderer/index.html'));
  }
}

app.whenReady().then(() => {
  installWikiappHandler();
  registerIpc();
  // Menu par défaut EN au démarrage : le main ne lit pas localStorage ; la
  // langue réelle arrive par setUiLanguage dès le montage du renderer.
  Menu.setApplicationMenu(buildAppMenu('en'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
