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
});
