import { useState } from 'react';
import type { ScanResult } from '../../src/ipc.js';
import { bridgeErrorMessage } from '../bridge.js';
import { useI18n } from '../i18n/index.js';
import { errorText } from '../i18n/messages.js';

interface FolderPickerProps {
  // Remonte le résultat du check (ou null après un check raté) : l'App s'en
  // sert pour (re)déclencher la chaîne options → preview → export.
  onScanChange: (scan: ScanResult | null) => void;
}

// Carte 1 « Load Wiki Folder / 加载 Wiki 文件夹 » (labels owner, via les
// dictionnaires i18n) : input chemin + bouton « Browse… » (dialogue natif)
// puis bouton « Check » via window.api.scan. Machine à états VISIBLE :
// ⏳ « Checking… » pendant l'appel, pill vert « Wiki found — N pages ·
// languages: … » si ≥ 1 langue, sinon bannière rouge. 0.1.11 : les erreurs
// du moteur identifiées par code machine sont localisées (errorText) ; les
// autres restent brutes. Chaque appel window.api est entouré d'un try/catch
// (FIX 2) dont le repli localisé est t('bridgeUnavailable').
export default function FolderPicker({ onScanChange }: FolderPickerProps) {
  const { t } = useI18n();
  const [projectRoot, setProjectRoot] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickFolder = async (): Promise<void> => {
    setError(null);
    try {
      const result = await window.api.pickFolder();
      if (result.ok) {
        if (result.value !== null) setProjectRoot(result.value);
      } else {
        setError(errorText(result, t));
      }
    } catch (cause) {
      setError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    }
  };

  const check = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setScan(null);
    onScanChange(null);
    try {
      const result = await window.api.scan(projectRoot);
      if (result.ok) {
        setScan(result.value);
        onScanChange(result.value);
        if (result.value.languages.length === 0) {
          setError(t('noLanguageFound'));
        }
      } else {
        setError(errorText(result, t));
      }
    } catch (cause) {
      setError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    } finally {
      setBusy(false);
    }
  };

  const totalPages =
    scan?.languages.reduce((total, lang) => total + lang.files.length, 0) ?? 0;
  const wikiValid = !busy && scan !== null && scan.languages.length > 0;
  const languageList =
    scan?.languages.map((lang) => lang.language).join(', ') ?? '';

  return (
    <section className="card">
      <h2>
        <span className="step-num">1</span> {t('loadWikiFolder')}
      </h2>
      <div className="row">
        <label htmlFor="project-root">{t('projectFolder')}</label>
        <input
          id="project-root"
          value={projectRoot}
          onChange={(event) => setProjectRoot(event.target.value)}
          placeholder="C:\...\my-project"
          spellCheck={false}
        />
      </div>
      <div className="row">
        <button
          type="button"
          onClick={() => void pickFolder()}
          disabled={busy}
          title={busy ? t('checking') : undefined}
        >
          {t('browse')}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void check()}
          disabled={busy || projectRoot === ''}
          title={projectRoot === '' ? t('enterFolderFirst') : undefined}
        >
          {t('check')}
        </button>
      </div>

      {/* Zone d'état rendue stablement (aria-live) : le lecteur d'écran
          annonce chaque transition ⏳ → ✔/✘ sans re-monter le DOM. */}
      <div className="status-zone" aria-live="polite">
        {busy && <p className="badge badge-busy">{t('checking')}</p>}
        {wikiValid && (
          <p className="badge badge-ok">
            {t('wikiFound', { n: totalPages, langs: languageList })}
          </p>
        )}
        {!busy && error !== null && (
          <p className="error" role="alert">
            ✘ {error}
          </p>
        )}
      </div>

      {scan !== null && scan.languages.length > 0 && (
        <div className="scan-summary">
          <p className="scan-title">{scan.projectName}</p>
          <p className="muted">{scan.wikiDir}</p>
          <ul>
            {scan.languages.map((lang) => (
              <li key={lang.language}>
                {t('scanLangPages', {
                  lang: lang.language,
                  n: lang.files.length,
                })}
              </li>
            ))}
          </ul>
          <p className="muted">
            {t('scanTotal', {
              pages: totalPages,
              langs: scan.languages.length,
            })}
            {scan.planPath === null ? ` ${t('scanNoPlan')}` : ''}
          </p>
        </div>
      )}
    </section>
  );
}
