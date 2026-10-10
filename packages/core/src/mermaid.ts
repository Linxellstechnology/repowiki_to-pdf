/**
 * Échappement HTML minimal pour l'attribut `data-src` et le `<pre><code>` du
 * fallback : `&` d'abord pour ne jamais double-échapper les entités produites
 * ensuite (`<`, `>`, `"`), puis le saut de ligne en entité numérique `&#10;`
 * (le même chaîne escappée sert dans le `data-src` et dans le `<code>`).
 */
function escapeMermaidSource(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}

/**
 * Bloc Mermaid → placeholder + fallback (spec F4/N1).
 *
 * Le `<div class="mermaid" data-src="...">` est comblé par la fenêtre offscreen
 * (Task 12) qui exécute `mermaid.run` sur `.mermaid` ; en cas d'erreur elle
 * retire `hidden` du `<div class="mermaid-fallback">` de ce bloc, révélant la
 * source. `index` (compteur de fences, unique dans la page) n'est posé sur le
 * `id` du wrapper `mbrd-<n>` que lorsqu'il est fourni : un appel direct sans
 * index produit un bloc valide mais sans `id`.
 */
export function renderMermaidBlock(source: string, index?: number): string {
  const esc = escapeMermaidSource(source);
  const idAttr = index === undefined ? '' : ` id="mbrd-${index}"`;
  return `<div class="mermaid-block"${idAttr}><div class="mermaid" data-src="${esc}"></div><div class="mermaid-fallback" hidden><p>⚠ <strong>Diagramme non généré</strong> — source :</p><pre><code>${esc}</code></pre></div></div>`;
}
