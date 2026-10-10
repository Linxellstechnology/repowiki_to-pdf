import { loadThemeCss } from '@repowiki-pdf/theme';
import { describe, expect, it } from 'vitest';

// Le test vit du runner core (vitest.config.ts n'inclut que packages/core/test/**) :
// le package thème est sans build (CSS lu comme texte au runtime), il est donc
// consommé ici via l'import workspace `@repowiki-pdf/theme`.
describe('theme CSS hooks', () => {
  it('expose les hooks load-bearing attendus par le composeur et pdfjs', async () => {
    const css = await loadThemeCss();

    // Substrings REQUISES du brief Step 4 (verbatim).
    expect(css).toContain('.wiki-page');
    expect(css).toContain('page-break-before');
    expect(css).toContain('.sec-marker');
    expect(css).toContain('hljs-keyword');
  });

  it('rend le marqueur §§ invisible (color:transparent + font-size minuscule)', async () => {
    const css = await loadThemeCss();
    // Le bloc `.sec-marker` doit rendre le §§ transparent ET diminuer sa taille :
    // c'est ce qui garde les ancres pdfjs (Task 9) présentes mais invisibles dans le PDF.
    const block = css.match(/\.sec-marker\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/color:\s*transparent/);
    expect(block).toMatch(/font-size:/);
    expect(block).toMatch(/user-select:\s*none/);
  });

  it('fait démarrer chaque page wiki sur une nouvelle page (page-break-before)', async () => {
    const css = await loadThemeCss();
    // La règle qui cible `.wiki-page` doit déclarer `page-break-before: always`
    // pour que chaque section/signet commence sur une page A4 dédiée.
    // On retire les commentaires pour ne matcher que de vraies règles, et on exige
    // qu'au moins UNE règle `.wiki-page { … page-break-before: always … }` existe.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...code.matchAll(/\.wiki-page[^{]*\{[^}]*\}/g)].map(
      (m) => m[0] ?? '',
    );
    expect(rules.some((r) => /page-break-before:\s*always/.test(r))).toBe(true);
  });

  it('assemble les deux fichiers (palette + pagination A4)', async () => {
    const css = await loadThemeCss();
    // `@page` et `.mermaid-block.very-wide` n'existent que dans print-a4.css ;
    // `.hljs-keyword` que dans repowiki.css (test 1) : les retrouver dans la chaîne
    // assemblée prouve que loadThemeCss concatène bien les deux fichiers.
    expect(css).toContain('@page');
    expect(css).toContain('A4');
    expect(css).toContain('.mermaid-block.very-wide');
  });

  it('plafonne la hauteur des SVG Mermaid à l’impression (fit page, Task 0.1.3)', async () => {
    const css = await loadThemeCss();
    // Un diagramme plus haut que la zone imprimable fragmentait sur 2-3 pages :
    // print-a4.css doit imposer (règles print-only, @media print) une hauteur
    // max sûre pour A4 ET Letter (210 mm) et laisser l’aspect viewBox réduire
    // le SVG proportionnellement (width/height auto + !important pour écraser
    // les attributs posés par mermaid).
    // On ignore les commentaires pour ne tester que de vraies règles.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...code.matchAll(/\.mermaid\s+svg\s*\{[^}]*\}/g)].map(
      (m) => m[0] ?? '',
    );
    expect(rules.length).toBeGreaterThan(0);
    const capped = rules.some(
      (r) =>
        /max-height:\s*210mm/.test(r) &&
        /height:\s*auto\s*!important/.test(r) &&
        /width:\s*auto\s*!important/.test(r) &&
        /max-width:\s*100%\s*!important/.test(r),
    );
    expect(capped).toBe(true);
    // La règle doit vivre dans un bloc @media print (l’écran garde le
    // max-width:100% brut de repowiki.css, sans plafond de hauteur).
    expect(css).toMatch(/@media print\s*\{[\s\S]*?\.mermaid\s+svg[\s\S]*?\}/);
  });
});
