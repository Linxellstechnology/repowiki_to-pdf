import { describe, expect, it } from 'vitest';
import { renderPageMarkdown } from '../src/markdown.js';

describe('renderPageMarkdown', () => {
  it('ancre les titres avec préfixe pageId', () => {
    const r = renderPageMarkdown('# T\n\n## Sous titre\n', 'p-002');
    expect(r.title).toBe('T');
    expect(r.html).toContain('id="p-002--sous-titre"');
  });

  it('titre depuis frontmatter', () => {
    expect(
      renderPageMarkdown('---\ntitle: Mon Titre\n---\n# X\n', 'p-001').title,
    ).toBe('Mon Titre');
  });

  it('surligne le code', () => {
    expect(
      renderPageMarkdown('# t\n\n```ts\nconst a = 1;\n```\n', 'p-001').html,
    ).toContain('hljs');
  });

  it('rend les tableaux GFM', () => {
    expect(
      renderPageMarkdown('# t\n\n| a | b |\n|---|---|\n| 1 | 2 |\n', 'p-001')
        .html,
    ).toContain('<table>');
  });

  // Garde-fous du retrait du `# h1` : fichiers sans newline final et fichiers CRLF.
  it('retire le h1 sans newline final', () => {
    const r = renderPageMarkdown('# Titre unique', 'p-003');
    expect(r.title).toBe('Titre unique');
    expect(r.html).not.toContain('<h1');
  });

  it('retire le h1 en CRLF', () => {
    const r = renderPageMarkdown('# T\r\n\r\n## Sous titre\r\n', 'p-004');
    expect(r.html).not.toContain('<h1');
    expect(r.html).toContain('id="p-004--sous-titre"');
  });
});
