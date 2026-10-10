// FIX 2 — défense en profondeur : les invokes main passent par l'enveloppe
// guard et ne rejettent normalement jamais ; mais si la passerelle est
// absente (preload non chargé — le bug historique) ou qu'un appel échoue
// avant l'enveloppe, l'exception doit devenir un message VISIBLE, jamais un
// état « busy » bloqué. Utilisé dans tous les try/catch autour de window.api.
// 0.1.6 : le message « bridge absent » est localisable — l'appelant passe le
// texte de sa dictionnaire (t('bridgeUnavailable')) ; sans fallback, le
// message anglais historique est conservé. Le guard `typeof window` rend la
// fonction utilisable/testable hors navigateur.
export function bridgeErrorMessage(cause: unknown, fallback?: string): string {
  if (typeof window === 'undefined' || typeof window.api === 'undefined') {
    return (
      fallback ??
      'Electron bridge unavailable (window.api missing) — restart the app.'
    );
  }
  return cause instanceof Error ? cause.message : String(cause);
}
