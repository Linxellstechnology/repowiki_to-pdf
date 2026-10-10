// 0.1.11 : localisation des lignes émises par le moteur (rapport, progression,
// erreurs). Le core/app reste AWARES des langues : il émet `code` + `vars`
// (jetons machine) ; c'est ici que la ligne affichée est composée, dans la
// langue de l'INTERFACE. Le `message` brut (diagnostic) reste le repli.
import type { CoreWarning } from '@repowiki-pdf/core';
import type { ProgressEvent } from '../../src/ipc.js';
import type { TFunc, UiStrings } from './index.js';

export function warningText(w: CoreWarning, t: TFunc): string {
  const v = w.vars ?? {};
  switch (w.code) {
    case 'PLAN_MISSING':
      return t('infoPlanMissing');
    case 'PLAN_METADATA_USED':
      return t('infoPlanMetadataUsed');
    case 'PLAN_TITLE_UNMATCHED':
      return t('infoPlanTitleUnmatched', v);
    case 'PAGE_NOT_IN_PLAN':
      return t('infoPageNotInPlan', v);
    case 'BROKEN_LINK':
      return v.kind === 'malformed'
        ? t('infoBrokenLinkMalformed', v)
        : t('infoBrokenLinkMissing', v);
    case 'LINK_FRAG_DROPPED':
      return v.kind === 'malformed'
        ? t('infoLinkFragMalformed', v)
        : t('infoLinkFragAbsent', v);
    case 'IMAGE_MISSING':
      return t('infoImageMissing', v);
    case 'MERMAID_REPAIRED':
      return t('infoMermaidRepaired', v);
    case 'MERMAID_INVALID':
      return t('infoMermaidInvalid', v);
    case 'SECTION_MARK_MISSING':
      return t('infoSectionMarkMissing', v);
    default:
      return w.message;
  }
}

const PHASE_KEYS: Record<
  'mermaid' | 'print' | 'polish' | 'write',
  keyof UiStrings
> = {
  mermaid: 'phaseMermaid',
  print: 'phasePrint',
  polish: 'phasePolish',
  write: 'phaseWrite',
};

export function progressText(event: ProgressEvent | null, t: TFunc): string {
  if (event === null) return t('preparingExport');
  if (event.phase === 'render') {
    // Eventuel legacy sans `title` : on retombe sur le libellé émis.
    if (event.title === undefined) return event.label;
    return t('phaseRender', {
      page: event.page ?? 0,
      total: event.total ?? 0,
      title: event.title,
    });
  }
  return t(PHASE_KEYS[event.phase]);
}

export interface FailureLike {
  error: string;
  errorCode?: string;
  errorVars?: Record<string, string>;
}

const ERROR_KEYS: Record<string, keyof UiStrings> = {
  WIKI_NOT_FOUND: 'errWikiNotFound',
  WRITE_FAILED: 'errWriteFailed',
  OUTPUT_NOT_DIR: 'errOutputNotDir',
  LANGUAGE_MISSING: 'errLanguageMissing',
};

export function errorText(result: FailureLike, t: TFunc): string {
  const key =
    result.errorCode !== undefined ? ERROR_KEYS[result.errorCode] : undefined;
  if (key === undefined) return result.error;
  return t(key, result.errorVars ?? {});
}
