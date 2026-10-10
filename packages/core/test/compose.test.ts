import { describe, expect, it } from 'vitest';
import { composeDocument, flattenToc } from '../src/compose.js';
import type { RenderedPage, TocNode } from '../src/types.js';

const toc: TocNode[] = [
  { id: 'p-001', title: 'A', filePath: '/a.md', level: 1, children: [] },
  {
    id: 'p-002',
    title: 'B',
    filePath: '/b.md',
    level: 1,
    children: [
      { id: 'p-003', title: 'B1', filePath: '/b1.md', level: 2, children: [] },
    ],
  },
];

const pages = new Map<string, RenderedPage>([
  ['p-001', { id: 'p-001', title: 'A', html: '<p>ca</p>' }],
  ['p-002', { id: 'p-002', title: 'B', html: '<p>cb</p>' }],
  ['p-003', { id: 'p-003', title: 'B1', html: '<p>cb1</p>' }],
]);

describe('composeDocument', () => {
  it('ordre DFS, marks uniques, toc liens', () => {
    const { html, marks } = composeDocument({
      projectName: 'P',
      languageLabel: 'English',
      dateLabel: '09/10/2026',
      toc,
      pages,
      css: 'x{}',
    });
    expect(flattenToc(toc).map((n) => n.id)).toEqual([
      'p-001',
      'p-002',
      'p-003',
    ]);
    expect(marks.map((m) => m.id)).toEqual(['p-001', 'p-002', 'p-003']);
    expect(new Set(marks.map((m) => m.id)).size).toBe(3);
    expect(html).toContain('<section class="cover"');
    expect(html).toContain('id="p-003"');
    expect(html).toContain('§§p-002§§');
    expect(html).toContain('href="#p-003"');
    expect(html.indexOf('id="p-002"')).toBeLessThan(html.indexOf('id="p-003"'));
  });

  it('document complet : doctype, cover, toc-page, sections wiki', () => {
    const { html } = composeDocument({
      projectName: 'P',
      languageLabel: 'English',
      dateLabel: '09/10/2026',
      toc,
      pages,
      css: 'x{}',
    });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<style>x{}</style>');
    expect(html).toContain(
      '<p class="cover-kicker">Documentation technique</p>',
    );
    expect(html).toContain('RepoWiki — English — 09/10/2026');
    expect(html).toContain('<section class="toc-page">');
    expect(html).toContain('<li class="toc-l1"><a href="#p-001">A</a>');
    expect(html).toContain('<li class="toc-l2"><a href="#p-003">B1</a>');
    expect(html).toContain('<section class="wiki-page" id="p-001">');
    expect(html).toContain('<h1 class="page-title">A</h1>');
    expect(html).toContain('<span class="sec-marker">§§p-001§§</span>');
    expect(html).toContain('<p>cb1</p>');
    expect(html.endsWith('</body></html>')).toBe(true);
  });

  it('page manquante -> fallback, échappement des titres, marks niveaux', () => {
    const partial = new Map(pages);
    partial.delete('p-002');
    const tricky: TocNode[] = [
      {
        id: 'p-001',
        title: 'A & <b>',
        filePath: null,
        level: 1,
        children: [
          {
            id: 'p-002',
            title: 'B',
            filePath: '/b.md',
            level: 2,
            children: [],
          },
        ],
      },
    ];
    const { html, marks } = composeDocument({
      projectName: 'P<i>',
      languageLabel: 'Français',
      dateLabel: '09/10/2026',
      toc: tricky,
      pages: partial,
      css: '',
    });
    expect(html).toContain('A &amp; &lt;b&gt;');
    expect(html).not.toContain('A & <b>');
    expect(html).toContain('P&lt;i&gt;');
    expect(html).toContain('<p class="img-missing">Page indisponible.</p>');
    expect(marks).toEqual([
      { id: 'p-001', level: 1, title: 'A & <b>' },
      { id: 'p-002', level: 2, title: 'B' },
    ]);
  });
});
