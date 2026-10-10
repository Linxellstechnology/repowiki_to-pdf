import type { CoreWarning } from '@repowiki-pdf/core';
import { describe, expect, it } from 'vitest';
import { makeT } from '../renderer/i18n/index.js';
import {
  errorText,
  progressText,
  warningText,
} from '../renderer/i18n/messages.js';

// 0.1.11 : toute ligne visible du rapport / de la progression / des erreurs
// est localisée EN/中文 depuis les dictionnaires — le message brut du moteur
// (français) ne reste que comme repli et détail diagnostique.

describe('warningText', () => {
  const tEn = makeT('en');
  const tZh = makeT('zh');

  const w = (code: string, vars?: Record<string, string>): CoreWarning => ({
    code,
    message: `brut-${code}`,
    vars,
  });

  it('codes plan → phrases EN', () => {
    expect(warningText(w('PLAN_MISSING'), tEn)).toBe(
      'No wiki_plan.yaml — pages were ordered alphabetically.',
    );
    expect(
      warningText(w('PLAN_TITLE_UNMATCHED', { title: 'Ghost' }), tEn),
    ).toContain('Ghost');
    expect(warningText(w('PAGE_NOT_IN_PLAN', { file: '9. Z' }), tEn)).toContain(
      '9. Z',
    );
  });

  it('BROKEN_LINK/LINK_FRAG_DROPPED choisissent le gabarit selon vars.kind', () => {
    const missing = warningText(
      w('BROKEN_LINK', { target: './a.md', kind: 'missing' }),
      tEn,
    );
    const malformed = warningText(
      w('BROKEN_LINK', { target: './10% a.md', kind: 'malformed' }),
      tEn,
    );
    expect(missing).toContain('./a.md');
    expect(malformed).toContain('malformed');
    expect(missing).not.toBe(malformed);
    expect(
      warningText(
        w('LINK_FRAG_DROPPED', {
          frag: 'x',
          target: './b.md',
          kind: 'absent',
        }),
        tEn,
      ),
    ).toContain('#x');
  });

  it('MERMAID_REPAIRED / MERMAID_INVALID / IMAGE_MISSING / SECTION_MARK_MISSING', () => {
    expect(
      warningText(w('MERMAID_REPAIRED', { src: 'erDiagram' }), tEn),
    ).toContain('erDiagram');
    expect(
      warningText(
        w('MERMAID_INVALID', { error: 'Parse error', src: 'X-->' }),
        tEn,
      ),
    ).toContain('Parse error');
    expect(warningText(w('IMAGE_MISSING', { src: 'a.png' }), tEn)).toContain(
      'a.png',
    );
    expect(
      warningText(w('SECTION_MARK_MISSING', { id: 'p-042' }), tEn),
    ).toContain('p-042');
  });

  it('le chinois couvre les mêmes codes', () => {
    expect(warningText(w('IMAGE_MISSING', { src: 'a.png' }), tZh)).toContain(
      '未找到图片',
    );
    expect(warningText(w('PLAN_METADATA_USED'), tZh)).toContain('元数据');
  });

  it('code inconnu → message brut (repli, jamais d’UI cassée)', () => {
    expect(warningText(w('CODE_FUTUR'), tEn)).toBe('brut-CODE_FUTUR');
  });

  it('vars absentes (moteur ancien) → gabarit avec jetons littéraux, pas de crash', () => {
    expect(warningText(w('IMAGE_MISSING'), tEn)).toContain('{src}');
  });
});

describe('progressText', () => {
  const tEn = makeT('en');
  const tZh = makeT('zh');

  it('null → préparation', () => {
    expect(progressText(null, tEn)).toBe(tEn('preparingExport'));
  });

  it('phase render avec title → ligne localisée', () => {
    expect(
      progressText(
        { phase: 'render', page: 3, total: 10, title: 'API', label: 'fr' },
        tEn,
      ),
    ).toBe('Rendering 3/10: API');
    expect(
      progressText(
        { phase: 'render', page: 3, total: 10, title: 'API', label: 'fr' },
        tZh,
      ),
    ).toContain('正在渲染');
  });

  it('phase render SANS title (eventuel legacy) → label brut', () => {
    expect(progressText({ phase: 'render', label: 'Rendu legacy' }, tEn)).toBe(
      'Rendu legacy',
    );
  });

  it('phases fixes mermaid/print/polish/write → localisées', () => {
    expect(progressText({ phase: 'mermaid', label: 'fr' }, tEn)).toContain(
      'Mermaid',
    );
    expect(progressText({ phase: 'write', label: 'fr' }, tZh)).toContain(
      '写入',
    );
  });
});

describe('errorText', () => {
  const tEn = makeT('en');
  const tZh = makeT('zh');

  it('WIKI_NOT_FOUND → phrase EN avec le chemin', () => {
    expect(
      errorText(
        {
          error: 'Aucun RepoWiki trouvé…',
          errorCode: 'WIKI_NOT_FOUND',
          errorVars: { path: 'D:\\Projet' },
        },
        tEn,
      ),
    ).toBe(
      'No RepoWiki found in D:\\Projet — generate the Repo Wiki in Qoder first (Repo Wiki panel → Generate), then reload this folder.',
    );
  });

  it('WRITE_FAILED → phrase ZH avec detail', () => {
    const out = errorText(
      {
        error: 'raw',
        errorCode: 'WRITE_FAILED',
        errorVars: { path: 'D:\\x.pdf', detail: 'EPERM' },
      },
      tZh,
    );
    expect(out).toContain('无法写入');
    expect(out).toContain('EPERM');
  });

  it('code inconnu ou absent → message brut', () => {
    expect(errorText({ error: 'boom' }, tEn)).toBe('boom');
    expect(errorText({ error: 'boom', errorCode: 'INCONNU' }, tEn)).toBe(
      'boom',
    );
  });
});
