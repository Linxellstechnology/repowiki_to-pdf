import { describe, expect, it } from 'vitest';
import { renderPageMarkdown } from '../src/markdown.js';
import { renderMermaidBlock } from '../src/mermaid.js';

describe('mermaid blocks', () => {
  it('produit placeholder + fallback échappé', () => {
    const h = renderMermaidBlock('graph TD\n  A --> B');
    expect(h).toContain('class="mermaid" data-src="graph TD&#10;  A --&gt; B"');
    expect(h).toContain('mermaid-fallback');
    expect(h).toContain('hidden');
  });
  it('le fence mermaid bypass le highlight', () => {
    const r = renderPageMarkdown('# t\n\n```mermaid\ngraph TD\n```\n', 'p-001');
    expect(r.html).toContain('id="mbrd-1"');
    expect(r.html).not.toContain('language-mermaid');
  });

  // 0.1.11 : le texte visible du repli (chrome DU PDF) suit la langue du wiki.
  it('titre de repli localisable via renderMermaidBlock', () => {
    const h = renderMermaidBlock('x', 1, 'Mermaid diagram not rendered');
    expect(h).toContain('<strong>Mermaid diagram not rendered</strong>');
  });

  it('titre de repli par défaut = français (comportement historique)', () => {
    expect(renderMermaidBlock('x')).toContain(
      '<strong>Diagramme non généré</strong>',
    );
  });

  it('renderPageMarkdown propage le titre de repli aux blocs mermaid', () => {
    const r = renderPageMarkdown(
      '# t\n\n```mermaid\ngraph TD\n```\n',
      'p-001',
      { mermaidFallbackTitle: '未能渲染 Mermaid 图表' },
    );
    expect(r.html).toContain('<strong>未能渲染 Mermaid 图表</strong>');
  });
});
