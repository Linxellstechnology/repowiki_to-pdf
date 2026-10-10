import { useEffect, useState } from 'react';
import type { ExportOptions, ExportResult, ScanResult } from '../src/ipc.js';
import { bridgeErrorMessage } from './bridge.js';
import AboutModal from './components/AboutModal';
import DocsModal from './components/DocsModal';
import FolderPicker from './components/FolderPicker';
import LanguageSwitch from './components/LanguageSwitch';
import Options from './components/Options';
import Preview from './components/Preview';
import ProgressBar from './components/ProgressBar';
import Report from './components/Report';
import { useI18n } from './i18n/index.js';

// Gating (inchangé) : Options/Build PDF verrouillés tant qu'aucune option
// valide n'est produite (check réussi). Hint unique sur les boutons (title)
// et les cartes vides — désormais via le dictionnaire i18n (t('gatingHint')).

// Flow 0.1.6 : les quatre cartes (labels owner, EN/中文 via i18n) +
// sélecteur de langue dans l'en-tête + modales Documentation/About ouvertes
// depuis le menu Help (événements webContents.send). L'App ne fait que câbler
// les composants ; tout passe par window.api. Les cartes sont TOUJOURS
// visibles (layout stable, numéroté).
export default function App() {
  const { t } = useI18n();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [opts, setOpts] = useState<ExportOptions | null>(null);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Menu Help → modales. Abonnements enveloppés try/catch (motif ProgressBar :
  // un pont cassé ne doit JAMAIS vider la page) ; désabonnement au démontage.
  // Échec = le menu Help ne peut pas piloter la page, l'UI reste utilisable.
  useEffect(() => {
    try {
      const offDocs = window.api.onOpenDocs(() => setDocsOpen(true));
      const offAbout = window.api.onOpenAbout(() => setAboutOpen(true));
      return () => {
        offDocs();
        offAbout();
      };
    } catch {
      // bridge absent : le menu Help ne peut pas piloter la page ; l'UI
      // reste pleinement utilisable.
      return undefined;
    }
  }, []);

  // Un nouveau scan invalide options, rapport et erreur précédents.
  const handleScanChange = (next: ScanResult | null): void => {
    setScan(next);
    setOpts(null);
    setReport(null);
    setExportError(null);
  };

  const generate = async (): Promise<void> => {
    if (opts === null) return;
    setExporting(true);
    setExportError(null);
    setReport(null);
    // FIX 2 : try/catch/finally — un rejet de la passerelle (bridge absent)
    // affiche le pilier « Failed » + bannière et libère l'état « Building… ».
    try {
      const result = await window.api.runExport(opts);
      if (result.ok) {
        setReport(result.value);
      } else {
        setExportError(result.error);
      }
    } catch (cause) {
      setExportError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>{t('brand')}</h1>
        <LanguageSwitch />
      </header>
      <div className="layout">
        <div className="col-config">
          <FolderPicker onScanChange={handleScanChange} />

          {scan === null ? (
            <section className="card">
              <h2>
                <span className="step-num">2</span> {t('options')}
              </h2>
              <p className="hint">{t('gatingHint')}</p>
            </section>
          ) : (
            <Options scan={scan} onChange={setOpts} />
          )}

          <section className="card">
            <h2>
              <span className="step-num">4</span> {t('buildPdf')}
            </h2>
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() => void generate()}
                disabled={opts === null || exporting}
                title={opts === null ? t('gatingHint') : undefined}
              >
                {exporting ? t('buildingPdf') : t('buildPdf')}
              </button>
            </div>
            {/* Pill d'état proéminent dès que le build se résout :
                « Done » (vert) + carte résultat, ou « Failed » (rouge) +
                bannière d'erreur. ProgressBar n'est montée QUE pendant
                l'export (son useEffect nettoie l'abonnement onProgress). */}
            {exporting && <ProgressBar />}
            {!exporting && report !== null && (
              // <output> = rôle implicite « status » (aria-live poli).
              <output className="badge badge-done">{t('done')}</output>
            )}
            {!exporting && exportError !== null && (
              <>
                <p className="badge badge-failed" role="alert">
                  {t('failed')}
                </p>
                <p className="error">✘ {exportError}</p>
              </>
            )}
            <Report result={report} />
            {!exporting && report === null && exportError === null && (
              <p className="muted">{t('buildDefaultNote')}</p>
            )}
          </section>
        </div>

        <div className="col-preview">
          <Preview opts={opts} />
        </div>
      </div>

      {/* Modales (menu Help) : la VERSION canonique de l'app vit dans le
          About — le footer UI a été retiré sur demande du owner. */}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </main>
  );
}
