import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Renderer React ; base './' pour que dist-renderer/index.html soit chargeable
// en file:// par Electron (chemins relatifs).
export default defineConfig({
  base: './',
  plugins: [react()],
  root: 'renderer',
  // Version affichée dans l'UI (distinction de builds homonymes) : invariable
  // à l'exécution, « dev » hors npm (vite lancé sans npm_package_version).
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
  },
});
