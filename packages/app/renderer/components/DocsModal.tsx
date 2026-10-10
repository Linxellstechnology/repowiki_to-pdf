import type { UiStrings } from '../i18n/index.js';
import { useI18n } from '../i18n/index.js';
import Modal from './Modal.js';

interface DocsModalProps {
  onClose: () => void;
}

// Contenu figé par le brief owner : les 10 codes émis par le core/le
// pipeline (grep véridique), chacun avec une explication courte EN/中文 ;
// les codes restent VERBATIM (techniques), seule l'explication est traduite.
const WARNING_ROWS: { code: string; key: keyof UiStrings }[] = [
  { code: 'PLAN_MISSING', key: 'warnPlanMissing' },
  { code: 'PLAN_METADATA_USED', key: 'warnPlanMetadataUsed' },
  { code: 'PLAN_TITLE_UNMATCHED', key: 'warnPlanTitleUnmatched' },
  { code: 'PAGE_NOT_IN_PLAN', key: 'warnPageNotInPlan' },
  { code: 'MERMAID_INVALID', key: 'warnMermaidInvalid' },
  { code: 'MERMAID_REPAIRED', key: 'warnMermaidRepaired' },
  { code: 'BROKEN_LINK', key: 'warnBrokenLink' },
  { code: 'IMAGE_MISSING', key: 'warnImageMissing' },
  { code: 'LINK_FRAG_DROPPED', key: 'warnLinkFragDropped' },
  { code: 'SECTION_MARK_MISSING', key: 'warnSectionMarkMissing' },
];

const STEPS: (keyof UiStrings)[] = [
  'docsStep1',
  'docsStep2',
  'docsStep3',
  'docsStep4',
];

const TIPS: (keyof UiStrings)[] = [
  'docsTipTall',
  'docsTipRepair',
  'docsTipOutput',
];

// Fenêtre Documentation (0.1.6) — contenu localisé EN/中文, défilante,
// ouverte depuis le menu Help. Quatre sections : ce que fait l'app, mode
// d'emploi, lecture du rapport (table des codes de warning), astuces.
export default function DocsModal({ onClose }: DocsModalProps) {
  const { t } = useI18n();
  return (
    <Modal title={t('docsTitle')} onClose={onClose}>
      <div className="docs">
        <section>
          <h3>{t('docsWhatTitle')}</h3>
          <p>{t('docsWhatBody')}</p>
        </section>
        <section>
          <h3>{t('docsHowTitle')}</h3>
          <ol>
            {STEPS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </section>
        <section>
          <h3>{t('docsReportTitle')}</h3>
          <p>{t('docsReportIntro')}</p>
          <table className="docs-table">
            <thead>
              <tr>
                <th>{t('warnTableCode')}</th>
                <th>{t('warnTableMeaning')}</th>
              </tr>
            </thead>
            <tbody>
              {WARNING_ROWS.map((row) => (
                <tr key={row.code}>
                  <td>
                    <code>{row.code}</code>
                  </td>
                  <td>{t(row.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>{t('docsTipsTitle')}</h3>
          <ul>
            {TIPS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
