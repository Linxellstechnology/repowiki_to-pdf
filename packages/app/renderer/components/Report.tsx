import type { CoreWarning } from '@repowiki-pdf/core';
import { useMemo, useState } from 'react';
import type { ExportResult } from '../../src/ipc.js';
import { bridgeErrorMessage } from '../bridge.js';
import { useI18n } from '../i18n/index.js';

interface ReportProps {
  result: ExportResult | null;
}

interface WarningEntry {
  id: string;
  warning: CoreWarning;
}

function groupByCode(warnings: CoreWarning[]): [string, WarningEntry[]][] {
  const groups = new Map<string, WarningEntry[]>();
  let seq = 0;
  for (const warning of warnings) {
    // Identifiant unique et stable (les messages peuvent être dupliqués :
    // pas de key = index, interdit par le lint a11y du repo).
    const entry: WarningEntry = { id: `w-${seq}`, warning };
    seq += 1;
    const bucket = groups.get(warning.code);
    if (bucket === undefined) groups.set(warning.code, [entry]);
    else bucket.push(entry);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// Carte résultat (0.1.5) : chemin du PDF, deux actions aux libellés exacts
// du owner — « Open The File » (shell.openPath) et « Print » (canal
// print-pdf → Start-Process -Verb Print, imprimante par défaut), nombre de
// pages, puis rapport « Warnings (N) » groupé par CODE (<details> natif).
// Les codes (MERMAID_INVALID, …) sont techniques → conservés verbatim ; les
// messages viennent du core (français) → acceptés tels quels.
// Les deux actions attrapent les exceptions de passerelle (FIX 2).
export default function Report({ result }: ReportProps) {
  const { t } = useI18n();
  const [actionError, setActionError] = useState<string | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  // Un nouveau PDF (result différent) réinitialise notes et erreurs d'action
  // (« state from props » pendant le rendu, pattern React documenté — tous
  // les hooks restent au niveau supérieur, avant le `return null`).
  const [lastResult, setLastResult] = useState<ExportResult | null>(result);
  if (result !== lastResult) {
    setLastResult(result);
    setActionError(null);
    setPrintNote(null);
  }
  const groups = useMemo(
    () => (result === null ? [] : groupByCode(result.warnings)),
    [result],
  );

  if (result === null) return null;

  const openPdf = async (): Promise<void> => {
    setActionError(null);
    try {
      const response = await window.api.openPdf(result.outputPath);
      if (!response.ok) setActionError(response.error);
    } catch (cause) {
      setActionError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    }
  };

  const printPdf = async (): Promise<void> => {
    setPrinting(true);
    setActionError(null);
    setPrintNote(null);
    try {
      const response = await window.api.printPdf(result.outputPath);
      if (response.ok) {
        setPrintNote(t('printSent'));
      } else {
        setActionError(response.error);
      }
    } catch (cause) {
      setActionError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    } finally {
      setPrinting(false);
    }
  };

  // Le pilier d'état « Done » est affiché par App.tsx (carte Build PDF) ; la
  // carte résultat ne garde que le chemin, les actions et le rapport.
  return (
    <div className="report">
      <p className="report-path" title={result.outputPath}>
        {result.outputPath}
      </p>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={() => void openPdf()}
          title={t('openTheFileTitle')}
        >
          {t('openTheFile')}
        </button>
        <button
          type="button"
          onClick={() => void printPdf()}
          disabled={printing}
          title={printing ? t('printing') : t('printTitle')}
        >
          {printing ? t('printing') : t('print')}
        </button>
      </div>
      {actionError !== null && (
        <p className="error" role="alert">
          ✘ {actionError}
        </p>
      )}
      {printNote !== null && <p className="note">{printNote}</p>}
      <p>
        {t('pageWarningCount', {
          pages: result.pageCount,
          warnings: result.warnings.length,
        })}
      </p>
      {result.warnings.length > 0 && (
        <details>
          <summary>{t('warningsGroup', { n: result.warnings.length })}</summary>
          <ul className="warning-groups">
            {groups.map(([code, warnings]) => (
              <li key={code}>
                <strong>{code}</strong> ({warnings.length})
                <ul>
                  {warnings.map((entry) => (
                    <li key={entry.id}>
                      {entry.warning.message}
                      {entry.warning.page !== undefined
                        ? ` [${entry.warning.page}]`
                        : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
