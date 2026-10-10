// Asset importé par Vite : hashé et copié dans dist-renderer/assets — le
// seul chemin qui survit au packaging file:// (base './'), dev/runtime.
import iconUrl from '../assets/icon.png';
import { useI18n } from '../i18n/index.js';
import Modal from './Modal.js';

interface AboutModalProps {
  onClose: () => void;
}

// Fenêtre À propos (0.1.6) — LA version canonique de l'app (le footer UI est
// supprimé). Marque + tagline localisés, credits owner (Hello Dati, mailto,
// Nizar HAMDI), icône de l'app.
export default function AboutModal({ onClose }: AboutModalProps) {
  const { t } = useI18n();
  return (
    <Modal title={t('aboutTitle')} onClose={onClose}>
      <div className="about">
        <img
          className="about-icon"
          src={iconUrl}
          alt=""
          width={96}
          height={96}
        />
        <p className="about-brand">{t('brand')}</p>
        <p className="about-tagline">{t('tagline')}</p>
        {/* Description produit (0.1.8) — le « vrai » pitch sous la marque. */}
        <p className="about-description">{t('aboutDescription')}</p>
        <p className="about-credits">{t('developedBy')}</p>
        <p className="about-credits">
          <a href="mailto:contact@hellodati.com">contact@hellodati.com</a>
        </p>
        <p className="about-credits">{t('authorBy')}</p>
        <p className="about-version">v{__APP_VERSION__}</p>
      </div>
    </Modal>
  );
}
