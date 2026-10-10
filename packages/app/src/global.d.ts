import type {
  ExportOptions,
  ExportResult,
  IpcResult,
  PreviewResult,
  ProgressEvent,
  ScanResult,
  UiLang,
} from './ipc.js';

declare global {
  interface Window {
    api: {
      scan(projectRoot: string): Promise<IpcResult<ScanResult>>;
      pickFolder(): Promise<IpcResult<string | null>>;
      runExport(opts: ExportOptions): Promise<IpcResult<ExportResult>>;
      preview(opts: ExportOptions): Promise<IpcResult<PreviewResult>>;
      openPdf(pdfPath: string): Promise<IpcResult<string>>;
      printPdf(pdfPath: string): Promise<IpcResult<string>>;
      // Retourne un désabonneur (Task 13) : à appeler au démontage du
      // composant pour ne jamais laisser de listener 'progress' orphelin.
      onProgress(cb: (event: ProgressEvent) => void): () => void;
      // 0.1.6 i18n : notifie le main de la langue d'interface (menu natif).
      setUiLanguage(lang: UiLang): Promise<IpcResult<null>>;
      // Événements menu Help → ouverture des modales renderer (désabonneurs
      // même contrat que onProgress).
      onOpenDocs(cb: () => void): () => void;
      onOpenAbout(cb: () => void): () => void;
    };
  }
}
