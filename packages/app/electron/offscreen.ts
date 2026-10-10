/**
 * Page offscreen servie par le protocole privé `wikiapp://offscreen/offscreen.html`
 * (ruling n°5) — équivalent fonctionnel du `offscreen.html` du brief, généré en
 * mémoire pour que `protocol.handle` n'ait aucun fichier physique à poser.
 *
 * Contrat Task 6/10 : le HTML composé contient des
 * `<div class="mermaid" data-src="…">` + fallback
 * `<div class="mermaid-fallback" hidden>`. `window.renderDocument(html, repairs?)`
 * rend chaque diagramme en SVG inline via `mermaid.render` ; en cas d'échec (ou de
 * SVG « Syntax error ») il retire l'attribut `hidden` du fallback du bloc et
 * supprime le placeholder, et rapporte le bloc dans `failed` (avec l'id de la
 * section/page hôte, le message d'erreur réel de mermaid et un extrait de la
 * source) pour que le main émette un warning MERMAID_INVALID diagnostiquable
 * (Task 0.1.3).
 *
 * Pass 2 « réparation » (Task 0.1.3, ADR-0008) : `repairs` est une Map
 * sérialisable `{ "<index de bloc>": sourceRéparée }` produite par le main
 * après un premier échec (règles `repairMermaidSource` du core). La promesse
 * est RE-CALÉE depuis le HTML d'origine : chaque appel commence par une
 * RÉINITIALISATION DÉTERMINISTE du `<body>` (les deux passes vivent dans la
 * même page ; sans reset, le DOM de la passe 1 — SVGs rendus aux ids `mm-N` —
 * resterait présent et pourrait capter les ids de `mermaid.render`). Le bloc
 * dont l'index est dans `repairs` est rendu avec la source réparée ; le
 * `data-src` (et donc le fallback visible) conservent la source d'origine.
 *
 * Le UMD Mermaid (UMD → `globalThis.mermaid`, voir assets.ts) est chargé via
 * `<script src="wikiapp://offscreen/mermaid.min.js">` : aucun réseau, aucun CDN.
 *
 * Note impression : `holder.innerHTML = html` injecte le document complet ;
 * les tags `<!DOCTYPE>/<html>/<head>/<body>` sont ignorés par le parseur mais
 * leurs enfants (dont le `<style>` du thème) sont bien appliqués au document —
 * `printToPDF` est ensuite exécuté sur CE DOM, SVGs inclus (ruling n°2.e).
 */

/** URL de chargement de la page offscreen. */
export const OFFSCREEN_PAGE_URL = 'wikiapp://offscreen/offscreen.html';

/** Résultat sérialisable de `window.renderDocument` (structured clone). */
export interface OffscreenRenderResult {
  html: string;
  failed: {
    index: number;
    pageId: string | null;
    /** Message d'erreur réel de mermaid (≤ 300 caractères). */
    error: string;
    /** Source ORIGINALE du bloc (data-src), remise sur une ligne, ≤ 120 car. */
    src: string;
    /** Source ORIGINALE complète, brute — carburant du `repairMermaidSource` main. */
    raw: string;
  }[];
}

/**
 * Source (non compilée — pas besoin de bundler pour du ES2020 simple) du script
 * main-world de la page. Écrite en JS classique car exécutée dans le page, jamais
 * par tsc ; elle n'utilise que `querySelectorAll`/`closest`/`dataset`, toutes
 * disponibles en Chromium 130 (Electron 33).
 */
const RENDER_DOCUMENT_SRC = String.raw`
(function () {
  window.renderDocument = async function (html, repairs) {
    var mermaid = globalThis.mermaid;
    if (!mermaid) throw new Error('mermaid UMD non charge (wikiapp://offscreen/mermaid.min.js)');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
    // Reset deterministe inter-passes (pass 2 « reparation », ADR-0008) :
    // window.renderDocument survit sur window, mais le body doit repartir de
    // ZERO pour que la seconde passe reende le document d'origine sans heurter
    // les ids mm-N deja presents (mermaid.render/select par id).
    document.body.innerHTML = '';
    var holder = document.createElement('div');
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var failed = [];
    var i = 0;
    for (var el of holder.querySelectorAll('.mermaid')) {
      i += 1;
      var src = el.dataset.src || '';
      var srcToRender = (repairs && repairs[String(i)]) || src;
      var ok = false;
      var error = '';
      var result = null;
      try {
        result = await mermaid.render('mm-' + i, srcToRender);
        ok = !!result.svg && result.svg.indexOf('Syntax error') === -1;
        if (ok) el.innerHTML = result.svg;
      } catch (err) {
        ok = false;
        // Task 0.1.3 : le message brut de mermaid (Parse error on line N…)
        // remonte jusqu'au warning MERMAID_INVALID — « lisible dans Qoder,
        // invalide ici » se diagnostique enfin sans ouvrir le code.
        error = err && err.message ? String(err.message) : String(err);
      }
      if (!ok) {
        if (!error) {
          // mermaid peut aussi RENDRE un SVG « Syntax error » sans lever :
          // le vrai motif est dans le texte visible de ce SVG.
          var raw = result && result.svg ? String(result.svg) : '';
          error = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        var section = el.closest('section');
        failed.push({
          index: i,
          pageId: section ? section.id : null,
          error: error.slice(0, 300),
          src: src.replace(/\s+/g, ' ').trim().slice(0, 120),
          raw: src,
        });
        var block = el.closest('.mermaid-block');
        if (block) {
          var fb = block.querySelector('.mermaid-fallback');
          if (fb) fb.removeAttribute('hidden');
        }
        el.remove();
      }
    }
    var out = holder.innerHTML;
    holder.remove();
    // Le DOM doit CONSERVER le document rendu : printToPDF s'exécute sur CETTE
    // fenêtre après résolution de la promesse (ruling n°5) — les SVGs Mermaid
    // doivent être en place au moment de l'impression.
    document.body.innerHTML = out;
    // Correctif d'intégration Task 12 : le thème (Task 10) rend les repères
    // §§p-00N§§ invisibles via « color: transparent », or Chromium ÉLIMINE les
    // glyphes transparents du flux de contenu PDF à l'impression — pdfjs (Task 9,
    // locateSections) ne voit alors AUCUN marqueur (vérifié empiriquement :
    // 1px opaque = extractible, transparent = perdu, quelle que soit la taille).
    // Ici on re-blanche les marqueurs en #ffffff sur fond blanc : toujours
    // invisibles à l'œil, mais présents dans le texte du PDF. Le CSS du thème
    // reste la source de vérité pour l'aperçu iframe (Task 13), où le transparent
    // fonctionne (pas d'impression).
    for (var mk of document.querySelectorAll('.sec-marker')) {
      mk.style.color = '#ffffff';
    }
    return { html: out, failed: failed };
  };
})();
`;

export const OFFSCREEN_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>RepoWiki offscreen renderer</title>
<script src="wikiapp://offscreen/mermaid.min.js"></script>
</head>
<body>
<script>${RENDER_DOCUMENT_SRC}</script>
</body>
</html>
`;
