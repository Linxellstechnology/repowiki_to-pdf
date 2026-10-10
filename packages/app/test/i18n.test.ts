import { describe, expect, it } from 'vitest';
import { bridgeErrorMessage } from '../renderer/bridge.js';
import { en } from '../renderer/i18n/en.js';
import {
  LANG_STORAGE_KEY,
  type UiStrings,
  detectInitialLang,
  makeT,
} from '../renderer/i18n/index.js';
import { zh } from '../renderer/i18n/zh.js';

// Portée « pur node » de l'i18n renderer (pas d'infra de test DOM) : les
// invariants des dictionnaires et la détection de langue sont testables sans
// React — c'est le contrat que l'UI consomme.

function tokens(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');
}

describe('dictionnaires i18n', () => {
  it('zh contient exactement les mêmes clés que en', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('aucune valeur vide ou whitespace', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim(), `zh.${key}`).not.toBe('');
    }
  });

  it('les jetons {placeholder} de zh sont identiques à ceux de en', () => {
    for (const [key, enValue] of Object.entries(en)) {
      const zhValue = zh[key as keyof UiStrings];
      expect(tokens(zhValue).sort(), key).toEqual(tokens(enValue).sort());
    }
  });

  it('le chinois simplifié couvre les libellés exigés par le owner', () => {
    expect(zh.loadWikiFolder).toBe('加载 Wiki 文件夹');
    expect(zh.check).toBe('检查');
    expect(zh.options).toBe('选项');
    expect(zh.buildPdf).toBe('生成 PDF');
    expect(zh.preview).toBe('预览');
    expect(zh.done).toBe('完成');
    expect(zh.failed).toBe('失败');
    expect(zh.warningsGroup).toContain('警告');
  });
});

describe('makeT', () => {
  it('interpolation des jetons dans la langue courante', () => {
    expect(makeT('en')('wikiFound', { n: 12, langs: 'en' })).toBe(
      'Wiki found — 12 pages · languages: en',
    );
    expect(makeT('zh')('scanTotal', { pages: 4, langs: 1 })).toBe(
      '共 4 页，1 种语言。',
    );
  });

  it('les jetons sans valeur restent littéraux (aucun undefined affiché)', () => {
    expect(makeT('en')('wikiFound')).toBe(
      'Wiki found — {n} pages · languages: {langs}',
    );
  });

  it('retourne la chaîne brute sans vars', () => {
    expect(makeT('en')('buildPdf')).toBe('Build PDF');
    expect(makeT('zh')('buildPdf')).toBe('生成 PDF');
  });
});

describe('detectInitialLang', () => {
  it('la valeur stockée (valide) prime sur navigator', () => {
    expect(detectInitialLang('zh', 'fr-FR')).toBe('zh');
    expect(detectInitialLang('en', 'zh-CN')).toBe('en');
  });

  it('sans stockage : navigator startingWith zh → zh, sinon en', () => {
    expect(detectInitialLang(null, 'zh-TW')).toBe('zh');
    expect(detectInitialLang(null, 'ZH')).toBe('zh');
    expect(detectInitialLang(null, 'fr-FR')).toBe('en');
    expect(detectInitialLang(null, '')).toBe('en');
  });

  it('stockage invalide → repli sur navigator', () => {
    expect(detectInitialLang('de', 'ja')).toBe('en');
  });

  it('la clé de persistance est rw-lang', () => {
    expect(LANG_STORAGE_KEY).toBe('rw-lang');
  });
});

describe('bridgeErrorMessage (repli localisable)', () => {
  // En node pur, `window` est indéfini → la branche « bridge absent » est
  // prise ; le fallback localisé fourni par l'appelant doit être retourné.
  it('retourne le fallback localisé quand window.api est absent', () => {
    expect(bridgeErrorMessage(new Error('x'), '无桥接')).toBe('无桥接');
  });

  it('sans fallback : message anglais historique conservé', () => {
    expect(bridgeErrorMessage(new Error('x'))).toBe(
      'Electron bridge unavailable (window.api missing) — restart the app.',
    );
  });
});
