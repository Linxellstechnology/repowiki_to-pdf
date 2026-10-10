// Contrats IPC partagés main <-> preload <-> renderer (source de vérité unique).
// Noms de canaux et formes de types figés par le brief Task 11 (ruling n°2).
import type { CoreWarning, ScanResult } from '@repowiki-pdf/core';

export interface ExportOptions {
  projectRoot: string;
  language: string;
  outputDir?: string;
  pageSize: 'A4' | 'Letter';
  includeCover: boolean;
}

export interface ProgressEvent {
  phase: 'render' | 'mermaid' | 'print' | 'polish' | 'write';
  page?: number;
  total?: number;
  /** 0.1.11 : titre de la section en cours (phase render) — ligne localisée. */
  title?: string;
  label: string;
}

export interface ExportResult {
  outputPath: string;
  pageCount: number;
  warnings: CoreWarning[];
}

export interface PreviewResult {
  html: string;
}

// Enveloppe de tous les invokes (ruling n°5) : `ipcMain.handle` ne rejette
// jamais — une erreur (ex. WikiNotFoundError) est mappée en { ok: false, error }
// pour survivre à la sérialisation structured-clone côté renderer.
// 0.1.11 : `errorCode`/`errorVars` machine (si l'erreur porte `code`/`vars`)
// permettent au renderer d'afficher une phrase localisée EN/中文.
export type IpcResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      errorCode?: string;
      errorVars?: Record<string, string>;
    };

/** Erreur applicative portant un code machine + des jetons d'affichage. */
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly vars?: Record<string, string>,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

export const CH = {
  scan: 'scan',
  pickFolder: 'pickFolder',
  preview: 'preview',
  export: 'export',
  openPdf: 'open-pdf',
  printPdf: 'print-pdf',
  progress: 'progress',
  // 0.1.6 i18n : le renderer notifie sa langue (menu natif reconstruit) ;
  // le menu Help envoie l'ouverture des fenêtres Docs/About au renderer.
  setUiLanguage: 'set-ui-language',
  openDocs: 'open-docs',
  openAbout: 'open-about',
} as const;

// Langue d'interface supportée (EN + 中文 simplifié) — contrat commun
// main/preload/renderer (dictionnaires du renderer, menu de l'app).
export type UiLang = 'en' | 'zh';

export type { ScanResult };
