import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/index.js';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Coquille de modale glass (0.1.6) — accessible sans nouvelle dépendance :
// role="dialog" + aria-modal, fermeture par Échap, clic sur le voile
// (backdrop) et bouton ✕ ; le focus est posé sur ✕ au montage (piege
// « focus-trap-ish » minimal exigé par le brief — la modale est leaf
// focusable, le reste de la page étant sous le voile).
export default function Modal({ title, onClose, children }: ModalProps) {
  const { t } = useI18n();
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
      // Le gestionnaire clavier est déjà posé au niveau document (effect
      // ci-dessus, couvre la focus-sortie) ; celui-ci satisfait en plus la
      // règle a11y onClick/onKeyDown — idempotent, onClose est un setState.
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      {/* <dialog open> = élément sémantique (lint a11y) rendu comme bloc
          statique par notre CSS — pas de showModal natif : le voile, le
          centrage et la fermeture (Échap/backdrop/✕) sont gérés ici. */}
      <dialog className="modal" open aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            ref={closeButtonRef}
            aria-label={t('close')}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </div>
  );
}
