import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { ensureOffscreenAssets } from './assets.js';
import { OFFSCREEN_HTML } from './offscreen.js';

/**
 * Protocole privé `wikiapp://` (ruling n°5) : sert la page offscreen (html en
 * mémoire) et les assets copiés dans `userData/offscreen/` (mermaid UMD) —
 * rendant le pipeline 100 % hors-ligne.
 *
 * - `registerWikiappPrivileges()` DOIT être appelé AVANT `app.whenReady`
 *   (registerSchemesAsPrivileged n'est légal qu'à ce moment).
 * - `installWikiappHandler()` s'appelle APRÈS ready (protocol.handle).
 */
const SCHEME = 'wikiapp';

export function registerWikiappPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true },
    },
  ]);
}

export function installWikiappHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/offscreen.html') {
      return new Response(OFFSCREEN_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    // `basename` fige le segment servi : aucune traversée `../` possible depuis
    // une requête du page vers userData/offscreen.
    const dir = await ensureOffscreenAssets();
    const target = path.join(dir, path.basename(url.pathname));
    return net.fetch(pathToFileURL(target).toString());
  });
}
