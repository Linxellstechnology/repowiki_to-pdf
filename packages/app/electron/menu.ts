import { BrowserWindow, Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { CH } from '../src/ipc.js';
import type { UiLang } from '../src/ipc.js';

// Menu applicatif minimal (0.1.6) : Edit + View (rôles natifs — copier/coller,
// recharger, devtools conservés pour le support) + Help avec les deux
// entrées métier qui pilotent les modales RENDERER via webContents.send.
// Chaînes EN + 中文 uniquement (français hors périmètre i18n). Les libellés
// des items à RÔLE (Copy, Reload…) restent localisés par Electron lui-même
// selon la locale de l'app — seule la couche native sait faire ; les labels
// de premier niveau et le sous-menu Help suivent la langue choisie.
interface MenuLabels {
  edit: string;
  view: string;
  help: string;
  documentation: string;
  about: string;
}

const MENU_LABELS: Record<UiLang, MenuLabels> = {
  en: {
    edit: 'Edit',
    view: 'View',
    help: 'Help',
    documentation: 'Documentation…',
    about: 'About REPOWIKI TO PDF',
  },
  zh: {
    edit: '编辑',
    view: '查看',
    help: '帮助',
    documentation: '使用文档…',
    about: '关于 REPOWIKI TO PDF',
  },
};

// L'event part vers la fenêtre focalisée (défaut : la première fenêtre
// vivante) ; jamais de rejet — fenêtre détruite = nothing to do.
function sendToFocusedWindow(channel: string): void {
  const win =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win !== undefined && !win.isDestroyed()) {
    win.webContents.send(channel);
  }
}

export function buildAppMenu(lang: UiLang): Menu {
  const labels = MENU_LABELS[lang];
  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.edit,
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: labels.view,
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: labels.help,
      submenu: [
        {
          label: labels.documentation,
          click: () => {
            sendToFocusedWindow(CH.openDocs);
          },
        },
        {
          label: labels.about,
          click: () => {
            sendToFocusedWindow(CH.openAbout);
          },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
