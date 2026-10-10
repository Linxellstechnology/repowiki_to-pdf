import { useState } from 'react';
import type { ExportOptions } from '../../src/ipc.js';
import { bridgeErrorMessage } from '../bridge.js';
import { useI18n } from '../i18n/index.js';
import { errorText } from '../i18n/messages.js';

interface PreviewProps {
  opts: ExportOptions | null;
}

// Étape 3 : aperçu fidèle — window.api.preview rejoue le pipeline jusqu'au
// rendu Mermaid inclus (mêmes étapes a–e que le PDF, sans impression) et
// retourne le HTML final, injecté dans une iframe via srcDoc.
// Hint de gating : clé i18n commune t('gatingHint') (même texte que dans
// App.tsx) — Options/Build verrouillés tant que le check n'a pas réussi.
// Le bouton reste désactivé tant qu'aucune option valide n'est définie
// (gating : analyser d'abord un projet) ; un rejet de la passerelle
// s'affiche en erreur visible au lieu de bloquer l'état « busy » (FIX 2).
export default function Preview({ opts }: PreviewProps) {
  const { t } = useI18n();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Un changement d'options rend l'aperçu obsolète : réinitialisation « state
  // from props » pendant le rendu (pattern React documenté), sans useEffect.
  const [lastOpts, setLastOpts] = useState<ExportOptions | null>(opts);
  if (opts !== lastOpts) {
    setLastOpts(opts);
    setHtml(null);
    setError(null);
  }

  const run = async (): Promise<void> => {
    if (opts === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.preview(opts);
      if (result.ok) {
        setHtml(result.value.html);
      } else {
        setHtml(null);
        setError(errorText(result, t));
      }
    } catch (cause) {
      setHtml(null);
      setError(bridgeErrorMessage(cause, t('bridgeUnavailable')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card preview-card">
      <h2>
        <span className="step-num">3</span> {t('preview')}
      </h2>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={() => void run()}
          disabled={opts === null || busy}
          title={opts === null ? t('gatingHint') : undefined}
        >
          {busy ? t('renderingPreview') : t('preview')}
        </button>
      </div>
      {error !== null && (
        <p className="error" role="alert">
          ✘ {error}
        </p>
      )}
      {html !== null ? (
        <>
          <p className="preview-banner">{t('previewBanner')}</p>
          {/*
            sandbox="" (vide) = le plus restrictif : bloque scripts, formulaires,
            navigation top et same-origin. Le HTML composé arrive déjà entièrement
            rendu (composePreviewHtml exécute Mermaid et renvoie du HTML final en
            SVG inline) : aucun <script> n'est nécessaire à l'affichage. Une iframe
            srcDoc hériterait sinon de l'origine parent et exposerait window.api au
            contenu markdown d'un dépôt tiers (non fiable). La navigation par
            ancres internes (href="#p-00N") reste autorisée sous sandbox vide.
          */}
          <iframe
            className="preview-frame"
            title={t('previewDocumentTitle')}
            srcDoc={html}
            sandbox=""
          />
        </>
      ) : (
        <p className="muted">
          {opts === null ? t('previewGatedHint') : t('previewIdle')}
        </p>
      )}
    </section>
  );
}
