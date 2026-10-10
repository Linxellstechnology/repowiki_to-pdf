import { useI18n } from '../i18n/index.js';

// Sélecteur de langue de l'en-tête (droite) : deux pastilles verre « EN |
// 中文 », la langue active est mise en évidence (aria-pressed pour le
// lecteur d'écran). Le choix est persisté + notifié au main par le
// LanguageProvider (effet sur [lang]) — ce composant ne fait que basculer.
export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <fieldset className="lang-switch" aria-label={t('uiLanguageSwitch')}>
      <button
        type="button"
        className={lang === 'en' ? 'lang-btn lang-active' : 'lang-btn'}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <span className="lang-sep" aria-hidden="true">
        |
      </span>
      <button
        type="button"
        className={lang === 'zh' ? 'lang-btn lang-active' : 'lang-btn'}
        aria-pressed={lang === 'zh'}
        onClick={() => setLang('zh')}
      >
        中文
      </button>
    </fieldset>
  );
}
