import type { RenderedPage, SectionMark, TocNode } from './types.js';

export function flattenToc(toc: TocNode[]): TocNode[] {
  const out: TocNode[] = [];
  (function dfs(ns: TocNode[]) {
    for (const n of ns) {
      out.push(n);
      dfs(n.children);
    }
  })(toc);
  return out;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface ComposeInput {
  projectName: string;
  languageLabel: string;
  dateLabel: string;
  toc: TocNode[];
  pages: Map<string, RenderedPage>;
  css: string;
}

function tocList(nodes: TocNode[]): string {
  if (!nodes.length) return '';
  return `<ul class="toc-list">${nodes
    .map(
      (n) =>
        `<li class="toc-l${n.level}"><a href="#${n.id}">${esc(
          n.title,
        )}</a>${tocList(n.children)}</li>`,
    )
    .join('')}</ul>`;
}

export function composeDocument(input: ComposeInput): {
  html: string;
  marks: SectionMark[];
} {
  const flat = flattenToc(input.toc);
  const marks: SectionMark[] = flat.map((n) => ({
    id: n.id,
    level: n.level,
    title: n.title,
  }));
  const sections = flat
    .map((n) => {
      const page = input.pages.get(n.id);
      const body = page
        ? page.html
        : '<p class="img-missing">Page indisponible.</p>';
      return `<section class="wiki-page" id="${n.id}"><h1 class="page-title">${esc(
        n.title,
      )}</h1><span class="sec-marker">§§${n.id}§§</span>${body}</section>`;
    })
    .join('\n');
  const html = `<!DOCTYPE html><html lang="${input.languageLabel}"><head><meta charset="utf-8"><title>${esc(
    input.projectName,
  )}</title><style>${input.css}</style></head><body>
<section class="cover"><p class="cover-kicker">Documentation technique</p><h1>${esc(
    input.projectName,
  )}</h1><p class="cover-meta">RepoWiki — ${esc(input.languageLabel)} — ${esc(
    input.dateLabel,
  )}</p></section>
<section class="toc-page"><h1 class="page-title">Table des matières</h1>${tocList(
    input.toc,
  )}</section>
${sections}
</body></html>`;
  return { html, marks };
}
