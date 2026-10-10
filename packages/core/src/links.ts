import fs from 'node:fs/promises';
import path from 'node:path';
import { slugifyHeading } from './markdown.js';
import type { CoreWarning } from './types.js';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Remplace, pour chaque occurrence de `rx` (un groupe capturant l'URL),
 * l'URL par la valeur renvoyée par `fn` ; `null` laisse le match intact.
 */
function replaceAttrs(
  html: string,
  rx: RegExp,
  fn: (url: string) => string | null,
): string {
  return html.replace(rx, (match: string, url: string) => {
    const rewritten = fn(url);
    return rewritten === null ? match : match.replace(url, rewritten);
  });
}

/**
 * `decodeURIComponent` sûr : le contenu du wiki est observable par un tiers
 * (contenu de dépôt source), donc un `%` malformé (ex. `./10% Something.md`)
 * lève URIError. La spec N1 impose qu'aucun défaut local n'abort l'export :
 * on renvoie `null` au lieu de lever, et l'appelant dégrade proprement.
 */
function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

/**
 * Réécrit les liens internes `.md` en ancres du document fusionné.
 *
 * - `href` externe (`http(s):`, `mailto:`, ancre `#` déjà relative) : intact.
 * - cible hors wiki : warning `BROKEN_LINK`, `href` conservé.
 * - cible `.md` connue : `#<pageId>` ; avec fragment, `#<pageId>--<slug>`
 *   (fragment DECODÉ en Unicode brut puis slugifié, cohérent avec Task 5).
 * - fragment et `knownAnchors` fourni mais ancre absente : on retombe sur
 *   `#<pageId>` et on émet `LINK_FRAG_DROPPED`.
 */
export function rewriteLinks(
  html: string,
  pageDir: string,
  fileToPageId: Map<string, string>,
  warnings: CoreWarning[],
  knownAnchors?: Set<string>,
): string {
  return replaceAttrs(html, /<a [^>]*href="([^"]+)"/g, (href) => {
    if (/^(https?:|mailto:|#)/i.test(href)) return null;
    const [rel, frag] = href.split('#');
    if (!rel || !rel.toLowerCase().endsWith('.md')) return null;
    const decodedRel = safeDecode(rel);
    if (decodedRel === null) {
      // `%` malformé dans l'`href` (URIError) : on laisse le <a> intact et on
      // signale (message avec l'`href` brut) plutôt qu'abandonner l'export (N1).
      warnings.push({
        code: 'BROKEN_LINK',
        message: `Lien vers ${href} malformé (encodage % invalide).`,
      });
      return null;
    }
    const abs = path.resolve(pageDir, decodedRel);
    const pageId = fileToPageId.get(abs);
    if (!pageId) {
      warnings.push({
        code: 'BROKEN_LINK',
        message: `Lien vers ${rel} introuvable dans le wiki.`,
      });
      return null;
    }
    if (frag) {
      const decodedFrag = safeDecode(frag);
      if (decodedFrag === null) {
        // Fragment avec `%` malformé : inutilisable → on le droppe et le lien
        // reste valable vers la page (pas de throw, N1).
        warnings.push({
          code: 'LINK_FRAG_DROPPED',
          message: `Ancre #${frag} malformée dans ${rel} ; lien ramené à la page.`,
        });
        return `#${pageId}`;
      }
      const anchor = `${pageId}--${slugifyHeading(decodedFrag)}`;
      if (knownAnchors && !knownAnchors.has(anchor)) {
        warnings.push({
          code: 'LINK_FRAG_DROPPED',
          message: `Ancre #${frag} absente de ${rel} ; lien ramené à la page.`,
        });
        return `#${pageId}`;
      }
      return `#${anchor}`;
    }
    return `#${pageId}`;
  });
}

/**
 * Embarque les images relatives en data-URI. Les URLs `http(s)`/`data:` sont
 * laissées telles quelles ; un fichier manquant déclenche `IMAGE_MISSING` et
 * un placeholder `<span class="img-missing">…</span>` (texte échappé).
 */
export async function embedImages(
  html: string,
  pageDir: string,
  warnings: CoreWarning[],
): Promise<string> {
  let out = html;
  // Cache src → data-URI (`null` = absente/malformée). On réécrit CHAQUE balise
  // <img> (Important 3) : l'ancienne dédup par `seen` sautait les balises
  // suivantes ayant le même src, laissant un `src` relatif survivre dans la page
  // offscreen → image silencieusement cassée dans le PDF, sans warning. Le cache
  // évite simplement de relire deux fois le même fichier.
  const cache = new Map<string, string | null>();
  const warned = new Set<string>(); // une warning par src distinct (dédup)
  for (const match of html.matchAll(/<img [^>]*src="([^"]+)"[^>]*>/g)) {
    const tag = match[0];
    const src = match[1];
    if (src === undefined) continue;
    if (/^(https?:|data:)/i.test(src)) continue;

    if (!cache.has(src)) {
      const decoded = safeDecode(src);
      if (decoded === null) {
        // `%` malformé dans le `src` (URIError) : traité comme image absente
        // (placeholder + warning), jamais de throw (spec N1).
        cache.set(src, null);
      } else {
        const abs = path.resolve(pageDir, decoded);
        const buf = await fs.readFile(abs).catch(() => null);
        cache.set(
          src,
          buf
            ? `data:${MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`
            : null,
        );
      }
    }

    const dataUri = cache.get(src) ?? null;
    if (dataUri === null) {
      if (!warned.has(src)) {
        warned.add(src);
        warnings.push({
          code: 'IMAGE_MISSING',
          message: `Image absente : ${src}.`,
        });
      }
      const placeholder = `<span class="img-missing">🖼 ${src.replace(/</g, '&lt;')}</span>`;
      out = out.split(tag).join(placeholder);
      continue;
    }
    out = out.split(tag).join(tag.replace(src, dataUri));
  }
  return out;
}
