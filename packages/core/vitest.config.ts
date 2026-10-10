import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Ruling Task 12 n°3 : `@repowiki-pdf/theme` a un map `exports` dont `default`
  // pointe vers `dist/index.js` (runtime Electron). Les tests vitest consomment la
  // SOURCE TS via cet alias — `npm test` reste vert sans build préalable du thème.
  resolve: {
    alias: {
      '@repowiki-pdf/theme': fileURLToPath(
        new URL('../../packages/theme/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    // Runner UNIQUE du repo (script racine `npm test`). Historiquement
    // core-only ; on y ajoute `packages/app/test/**` pour les tests PURS du
    // côté app (ex. print-command.ts, sans import Electron) — le host ne peut
    // pas dépendre de core, et ces helpers sont testables en node pur.
    include: [
      'packages/core/test/**/*.test.ts',
      'packages/app/test/**/*.test.ts',
    ],
    root: fileURLToPath(new URL('../../', import.meta.url)),
  },
});
