import { useEffect, useState } from 'react';
import type { ExportOptions, ScanResult } from '../../src/ipc.js';
import { bridgeErrorMessage } from '../bridge.js';
import { useI18n } from '../i18n/index.js';
import { errorText } from '../i18n/messages.js';

interface OptionsDraft {
  language: string;
  pageSize: 'A4' | 'Letter';
  includeCover: boolean;
  outputDir: string; // '' = défaut (racine du projet scanné)
}

interface OptionsProps {
  scan: ScanResult;
  // Rend l'ExportOptions courant (ou null si aucune langue exploitable) ;
  // l'App s'en sert pour activer « Prévisualiser » / « Générer le PDF ».
  onChange: (opts: ExportOptions | null) => void;
}

const initialDraft = (scan: ScanResult): OptionsDraft => ({
  language: scan.languages[0]?.language ?? '',
  pageSize: 'A4',
  includeCover: true,
  outputDir: '',
});

function buildExportOptions(
  scan: ScanResult,
  draft: OptionsDraft,
): ExportOptions | null {
  if (
    draft.language === '' ||
    !scan.languages.some((l) => l.language === draft.language)
  ) {
    return null;
  }
  const outputDir = draft.outputDir.trim();
  return {
    projectRoot: scan.projectRoot,
    language: draft.language,
    pageSize: draft.pageSize,
    includeCover: draft.includeCover,
    ...(outputDir !== '' ? { outputDir } : {}),
  };
}

// Étape 1 : options d'export. La langue n'est proposée (et donc requise) que
// si le scan en contient ; format A4 par défaut ; page de garde cochée par
// défaut ; dossier de sortie optionnel (défaut = racine du projet).
export default function Options({ scan, onChange }: OptionsProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<OptionsDraft>(() => initialDraft(scan));
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Un nouveau scan (changement de projet/langues) réinitialise la sélection.
  useEffect(() => {
    setDraft(initialDraft(scan));
  }, [scan]);

  useEffect(() => {
    onChange(buildExportOptions(scan, draft));
  }, [scan, draft, onChange]);

  const browseOutput = async (): Promise<void> => {
    setBrowseError(null);
    // FIX 2 : une passerelle absente doit afficher une erreur, pas bloquer.
    try {
      const result = await window.api.pickFolder();
      if (result.ok) {
        if (result.value !== null) {
          setDraft((prev) => ({ ...prev, outputDir: result.value ?? '' }));
        }
      } else {
        setBrowseError(errorText(result, t));
      }
    } catch (cause) {
      setBrowseError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    }
  };

  if (scan.languages.length === 0) {
    return (
      <section className="card">
        <h2>
          <span className="step-num">2</span> {t('options')}
        </h2>
        <p className="muted">{t('noLangAvailable')}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>
        <span className="step-num">2</span> {t('options')}
      </h2>

      <div className="row">
        <label htmlFor="opt-language">{t('language')}</label>
        <select
          id="opt-language"
          value={draft.language}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, language: event.target.value }))
          }
        >
          {scan.languages.map((lang) => (
            <option key={lang.language} value={lang.language}>
              {t('languageOptionPages', {
                lang: lang.language,
                n: lang.files.length,
              })}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="row">
        <legend>{t('format')}</legend>
        <label>
          <input
            type="radio"
            name="page-size"
            checked={draft.pageSize === 'A4'}
            onChange={() => setDraft((prev) => ({ ...prev, pageSize: 'A4' }))}
          />
          A4
        </label>
        <label>
          <input
            type="radio"
            name="page-size"
            checked={draft.pageSize === 'Letter'}
            onChange={() =>
              setDraft((prev) => ({ ...prev, pageSize: 'Letter' }))
            }
          />
          Letter
        </label>
      </fieldset>

      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={draft.includeCover}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                includeCover: event.target.checked,
              }))
            }
          />
          {t('coverPage')}
        </label>
      </div>

      <div className="row">
        <label htmlFor="opt-output">{t('outputFolder')}</label>
        <input
          id="opt-output"
          value={draft.outputDir}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, outputDir: event.target.value }))
          }
          placeholder={scan.projectRoot}
          spellCheck={false}
        />
        <button type="button" onClick={() => void browseOutput()}>
          {t('browse')}
        </button>
      </div>
      {browseError !== null && <p className="error">{browseError}</p>}
      <p className="muted">{t('leaveEmptyOutput')}</p>
    </section>
  );
}
