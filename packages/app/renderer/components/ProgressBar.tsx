import { useEffect, useState } from 'react';
import type { ProgressEvent } from '../../src/ipc.js';
import { bridgeErrorMessage } from '../bridge.js';
import { useI18n } from '../i18n/index.js';

// Mapping déterministe des poids (brief Task 13, étape 2) :
// - render  : 0 → 50 %   (progressif, page/total émis par le pipeline)
// - mermaid : palier 50 % (le bloc mermaid vaut 25 % ; atteint à 100 % en fin
//             d'événement suivant — on affiche le plancher de phase débutée)
// - print   : palier 75 % (= 50 + 25)
// - polish  : palier 90 % — write : palier 95 % : polish+write partagent les
//             10 % finaux (polish à mi-bucket, write en fin de bucket) ;
//             l'App remonte à 100 % quand runExport se résout (via Report).
const PHASE_FLOOR: Record<ProgressEvent['phase'], number> = {
  render: 0,
  mermaid: 50,
  print: 75,
  polish: 90,
  write: 95,
};

function percentOf(event: ProgressEvent | null): number {
  if (event === null) return 0;
  if (event.phase === 'render') {
    const total = event.total ?? 0;
    const page = event.page ?? 0;
    return total > 0 ? Math.round((50 * page) / total) : 0;
  }
  return PHASE_FLOOR[event.phase];
}

// Étape 2 : barre de progression. Montée uniquement pendant un export ;
// s'abonne à window.api.onProgress à son montage et se désabonne à son
// démontage (unsubscribe fourni par le preload — correction du point différé
// Task 11 : aucun listener ne survit à l'export).
// FIX (revue, Finding 2 IMPORTANT) : l'abonnement est ENVELOPPÉ dans un
// try/catch. `window.api.onProgress` peut jeter (passerelle absente / pont
// cassé) ; sans enveloppe l'exception remonte dans l'effet React et VIDAGE
// toute l'application (page blanche). Le désabonneur d'origine reste renvoyé
// tel quel (aucune sémantique de désabonnement perdue).
export default function ProgressBar() {
  const { t } = useI18n();
  const [event, setEvent] = useState<ProgressEvent | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = window.api.onProgress(setEvent);
      return unsubscribe;
    } catch (cause) {
      setBridgeError(bridgeErrorMessage(cause));
      return undefined;
    }
  }, []);

  const percent = percentOf(event);

  return (
    <div className="progress" aria-live="polite">
      {/* Message principal (reformulation owner, une ligne, via i18n) +
          libellé de phase existant en dessous (émis par le pipeline, en
          français — données core, pas du chrome UI). */}
      <p className="progress-message">{t('progressMessage')}</p>
      {/* Barre purement visuelle : le pourcentage et le libellé courant sont
          rendus dans le texte (aria-live de la zone) ; role=progressbar est
          volontairement omis (élément non interactif, non focusable). */}
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="muted">
        {event?.label ?? t('preparingExport')} — {percent} %
      </p>
      {/* Bannière cohérente avec le motif bridgeErrorMessage (Report.tsx) :
          un échec d'abonnement devient un message VISIBLE, jamais une page
          blanche. */}
      {bridgeError !== null && (
        <p className="error" role="alert">
          ✘ {bridgeError}
        </p>
      )}
    </div>
  );
}
