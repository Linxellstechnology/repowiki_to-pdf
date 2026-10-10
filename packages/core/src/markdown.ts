import matter from 'gray-matter';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { renderMermaidBlock } from './mermaid.js';
import type { CoreWarning } from './types.js';

/**
 * Ancre de titre : minuscules, lettres/chiffres Unicode conservés (accents inclus),
 * ponctuation retirée, espaces → `-`. Aucune encodage percent-encoded.
 */
export function slugifyHeading(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value;
  }
  return hljs.highlightAuto(code).value;
}

/**
 * Fabrique UNE instance markdown-it par page (jamais de singleton de module) :
 * l'ancre dépend du `pageId` et le compteur de blocs Mermaid (Task 6) doit être
 * réinitialisé à chaque rendu.
 *
 * Point de branchement Task 6 : surcharger `instance.renderer.rules.fence` ici,
 * juste après `instance.use(...)`, pour router les fences ```mermaid vers
 * `renderMermaidBlock(token.content, n)` — aucun refactor nécessaire, l'instance
 * est déjà locale à l'appel.
 */
function createAnchoredMarkdownIt(pageId: string): MarkdownIt {
  const instance = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: highlightCode,
  });
  instance.use(anchor, {
    level: [1, 2, 3, 4],
    slugify: (s: string) => `${pageId}--${slugifyHeading(s)}`,
    uniqueSlugStartIndex: 1,
  });

  // Task 6 — branchement de la règle de fence. L'instance étant locale à
  // l'appel, `mermaidIndex` est un compteur par page : les `id="mbrd-<n>"`
  // produits sont donc uniques dans la page rendue.
  const defaultFence = instance.renderer.rules.fence;
  let mermaidIndex = 0;
  instance.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token?.info.trim() === 'mermaid') {
      mermaidIndex += 1;
      return renderMermaidBlock(token.content, mermaidIndex);
    }
    // Tout autre langage retombe sur le renderer de fence par défaut
    // (surlignage hljs de la Task 5) — aucune régression pour `ts`, etc.
    return defaultFence ? defaultFence(tokens, idx, options, env, self) : '';
  };

  return instance;
}

/**
 * Markdown d'une page du wiki → HTML surligné dont chaque titre porte l'id
 * `${pageId}--${slug}`. Le `# h1` initial est retiré du corps : c'est le composeur
 * (Task 8) qui rend le titre comme en-tête de section du document PDF.
 */
export function renderPageMarkdown(
  md: string,
  pageId: string,
): { html: string; title: string; warnings: CoreWarning[] } {
  const { data, content } = matter(md);
  const h1 = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
  const instance = createAnchoredMarkdownIt(pageId);
  // le h1 est porté par l'en-tête de section du document (composeur, Task 8) ;
  // `(?:\r?\n|$)` couvre les fichiers sans saut de ligne final et les fins de ligne CRLF.
  const body = instance.render(content.replace(/^#\s+.+(?:\r?\n|$)/, ''));
  const frontmatterTitle =
    typeof data.title === 'string' ? data.title : undefined;
  return { html: body, title: frontmatterTitle ?? h1 ?? pageId, warnings: [] };
}
