import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { UiLang } from '../../src/ipc.js';
import { en } from './en.js';
import { zh } from './zh.js';

export type { UiLang };

// Source de vérité structurelle : le dictionnaire anglais définit le contrat
// (mêmes clés, mêmes jetons {name}) ; zh est vérifié par le compilateur.
// `as const` est volontairement ABSENT sur en — les literals rendraient
// toute traduction non-assignable.
export type UiStrings = typeof en;
export type TFunc = (key: keyof UiStrings, vars?: TVars) => string;
export type TVars = Readonly<Record<string, string | number>>;

export const LANG_STORAGE_KEY = 'rw-lang';

function interpolate(template: string, vars?: TVars): string {
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

// Fabrique du lookup `t(key, vars?)` pour une langue. La langue courante
// n'existe jamais en dehors des deux dictionnaires : repli sur en.
export function makeT(lang: UiLang): TFunc {
  const dict: UiStrings = lang === 'zh' ? zh : en;
  return (key, vars) => interpolate(dict[key], vars);
}

// Fonction PURE (testée sans DOM) : stockage valide > navigator ('zh*' → zh)
// > en. Appelé par le provider avec les valeurs localStorage/navigator lues
// côté navigateur.
export function detectInitialLang(
  stored: string | null,
  navigatorLanguage: string,
): UiLang {
  if (stored === 'zh' || stored === 'en') return stored;
  return navigatorLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function readStoredLang(): string | null {
  try {
    return typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readNavigatorLang(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.language ?? '';
}

interface I18nValue {
  lang: UiLang;
  setLang: (next: UiLang) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nValue | null>(null);

// Provider sans dépendance nouvelle : état React + persistance localStorage
// + notification du main (menu natif) à chaque changement — et AU MONTAGE
// (le main ne lit pas localStorage ; son menu démarre en EN).
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<UiLang>(() =>
    detectInitialLang(readStoredLang(), readNavigatorLang()),
  );

  const t = useMemo(() => makeT(lang), [lang]);
  const changeLang = useCallback((next: UiLang) => {
    setLang(next);
  }, []);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      }
    } catch {
      // stockage indisponible (mode privé…) : la langue reste en mémoire.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
    // jamais de rejet visible : le pont peut être absent (préload cassé).
    try {
      if (typeof window !== 'undefined' && typeof window.api !== 'undefined') {
        void window.api.setUiLanguage(lang).catch(() => undefined);
      }
    } catch {
      // idem : échec d'invoke non bloquant pour l'UI.
    }
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang: changeLang, t }),
    [lang, changeLang, t],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error('useI18n must be used inside <LanguageProvider>.');
  }
  return ctx;
}
