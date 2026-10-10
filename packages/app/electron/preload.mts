import { contextBridge, ipcRenderer } from 'electron';
import { CH } from '../src/ipc.js';
import type {
  ExportOptions,
  ExportResult,
  IpcResult,
  PreviewResult,
  ProgressEvent,
  ScanResult,
  UiLang,
} from '../src/ipc.js';

// Miroir typé des invokes main (window.api — voir src/global.d.ts).
// Les retours `ipcRenderer.invoke` (Promise<any>) sont filtrés par les
// annotations de retour explicites : aucun `as any` n'est nécessaire.
const api = {
  scan: (projectRoot: string): Promise<IpcResult<ScanResult>> =>
    ipcRenderer.invoke(CH.scan, projectRoot),

  pickFolder: (): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke(CH.pickFolder),

  runExport: (opts: ExportOptions): Promise<IpcResult<ExportResult>> =>
    ipcRenderer.invoke(CH.export, opts),

  preview: (opts: ExportOptions): Promise<IpcResult<PreviewResult>> =>
    ipcRenderer.invoke(CH.preview, opts),

  openPdf: (pdfPath: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(CH.openPdf, pdfPath),

  printPdf: (pdfPath: string): Promise<IpcResult<string>> =>
    ipcRenderer.invoke(CH.printPdf, pdfPath),

  // Task 13 : retourne une fonction de désabonnement (le renderer appelle
  // removeListener au démontage — pas de fuite du listener 'progress').
  onProgress: (cb: (event: ProgressEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: ProgressEvent): void => {
      cb(payload);
    };
    ipcRenderer.on(CH.progress, listener);
    return () => {
      ipcRenderer.removeListener(CH.progress, listener);
    };
  },

  // 0.1.6 i18n : le renderer notifie sa langue (persistée en localStorage,
  // inaccessible au main) → le main reconstruit le menu applicatif.
  setUiLanguage: (lang: UiLang): Promise<IpcResult<null>> =>
    ipcRenderer.invoke(CH.setUiLanguage, lang),

  // Événements du menu Help → fenêtres modales du renderer. Même contrat
  // d'abonnement que onProgress (désabonneur retourné, zéro fuite).
  onOpenDocs: (cb: () => void): (() => void) => {
    const listener = (): void => {
      cb();
    };
    ipcRenderer.on(CH.openDocs, listener);
    return () => {
      ipcRenderer.removeListener(CH.openDocs, listener);
    };
  },

  onOpenAbout: (cb: () => void): (() => void) => {
    const listener = (): void => {
      cb();
    };
    ipcRenderer.on(CH.openAbout, listener);
    return () => {
      ipcRenderer.removeListener(CH.openAbout, listener);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
