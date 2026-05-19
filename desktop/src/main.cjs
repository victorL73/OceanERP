const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

const defaultSettings = {
  serverUrl: process.env.OCEANERP_WEB_URL || readPackagedServerUrl() || ''
};

let mainWindow;
let tray;
let updateCheckInProgress = false;

function readPackagedServerUrl() {
  const candidates = [
    path.join(__dirname, '..', 'config', 'default-server.json'),
    path.join(process.resourcesPath || '', 'config', 'default-server.json')
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (typeof parsed.serverUrl === 'string' && parsed.serverUrl.trim()) {
          return parsed.serverUrl.trim();
        }
      }
    } catch {
      // Ignore invalid packaged config and keep the app usable.
    }
  }

  return null;
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeServerUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL serveur invalide.');
  }

  return parsed.toString().replace(/\/$/, '');
}

function readSettings() {
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
    }
  } catch {
    // The file is user-editable; keep the app usable if it becomes invalid.
  }

  return { ...defaultSettings };
}

function writeSettings(nextSettings) {
  const settings = { ...readSettings(), ...nextSettings };
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  return settings;
}

function getIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.svg')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function loadLauncher(errorMessage = '') {
  const settings = readSettings();
  const html = `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>OceanERP</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            font-family: Segoe UI, Arial, sans-serif;
            background: #f4f7fb;
            color: #102033;
            display: grid;
            grid-template-columns: 420px 1fr;
          }
          aside {
            background: #111c2f;
            color: white;
            padding: 42px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
            font-weight: 800;
            font-size: 22px;
          }
          .mark {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            background: #0f7f73;
            display: grid;
            place-items: center;
            font-size: 17px;
          }
          aside p { color: #b7c4d9; line-height: 1.6; margin: 24px 0 0; }
          main { display: grid; place-items: center; padding: 42px; }
          form {
            width: min(560px, 100%);
            background: white;
            border: 1px solid #d9e2ef;
            border-radius: 8px;
            padding: 28px;
            box-shadow: 0 12px 32px rgba(16, 32, 51, .08);
            display: grid;
            gap: 18px;
          }
          h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
          .hint { margin: 0; color: #52627a; line-height: 1.5; }
          label { display: grid; gap: 8px; font-weight: 700; color: #26364d; }
          input {
            width: 100%;
            height: 44px;
            border: 1px solid #cdd7e5;
            border-radius: 6px;
            padding: 0 12px;
            font: inherit;
          }
          input:focus { outline: 2px solid rgba(15, 127, 115, .22); border-color: #0f7f73; }
          button {
            height: 44px;
            border: 0;
            border-radius: 6px;
            background: #0f7f73;
            color: white;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
          }
          button.secondary { background: #e8eef7; color: #102033; }
          .actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
          .error {
            min-height: 22px;
            color: #b42318;
            background: #fff0f0;
            border: 1px solid #ffd2d2;
            border-radius: 6px;
            padding: 10px 12px;
          }
          .error:empty { display: none; }
          code { color: #0f7f73; }
          @media (max-width: 860px) {
            body { grid-template-columns: 1fr; }
            aside { display: none; }
          }
        </style>
      </head>
      <body>
        <aside>
          <div>
            <div class="brand"><div class="mark">OE</div><span>OceanERP</span></div>
            <p>Choisissez le serveur ERP avant de vous connecter. Cette adresse peut etre changee sans reconstruire l'installateur Windows.</p>
          </div>
          <p>Derniere adresse connue<br><code>${escapeHtml(settings.serverUrl || 'Aucune')}</code></p>
        </aside>
        <main>
          <form id="form">
            <h1>Connexion au serveur</h1>
            <p class="hint">Entrez l'adresse du serveur OceanERP. L'ecran d'identification s'ouvrira ensuite depuis ce serveur.</p>
            <label>
              Adresse du serveur
              <input id="serverUrl" type="url" required placeholder="http://adresse-du-serveur:8080" value="${escapeHtml(settings.serverUrl)}" />
            </label>
            <div id="error" class="error">${escapeHtml(errorMessage)}</div>
            <div class="actions">
              <button type="submit">Continuer vers la connexion</button>
              <button type="button" class="secondary" id="quit">Quitter</button>
            </div>
          </form>
        </main>
        <script>
          const form = document.getElementById('form');
          const input = document.getElementById('serverUrl');
          const error = document.getElementById('error');
          document.getElementById('quit').addEventListener('click', () => window.oceanErpDesktop.quit());
          form.addEventListener('submit', async event => {
            event.preventDefault();
            error.textContent = '';
            const result = await window.oceanErpDesktop.connectServer(input.value);
            if (!result.ok) {
              error.textContent = result.error || 'URL invalide';
            }
          });
        </script>
      </body>
    </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function loadServerUrl(serverUrl) {
  mainWindow.loadURL(serverUrl || readSettings().serverUrl);
}

function isAllowedAppNavigation(targetUrl) {
  if (!targetUrl || targetUrl === 'about:blank') {
    return false;
  }

  if (targetUrl.startsWith('data:text/html')) {
    return true;
  }

  const settings = readSettings();
  if (!settings.serverUrl) {
    return true;
  }

  try {
    const target = new URL(targetUrl);
    const server = new URL(settings.serverUrl);
    const serverPath = server.pathname.replace(/\/$/, '');
    const allowedPaths = new Set([
      serverPath || '/',
      `${serverPath}/`,
      `${serverPath}/index.html`
    ]);

    return ['http:', 'https:'].includes(target.protocol)
      && target.origin === server.origin
      && allowedPaths.has(target.pathname);
  } catch {
    return false;
  }
}

function createWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'OceanERP',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1600,
          height: 980,
          minWidth: 1100,
          minHeight: 720,
          title: 'OceanERP - ONLYOFFICE',
          icon: iconPath,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
          }
        }
      };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppNavigation(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (isMainFrame !== false && errorCode !== -3) {
      loadLauncher(`Impossible de joindre le serveur ${validatedUrl}. ${errorDescription || ''}`);
    }
  });

  loadLauncher();
}

function createMenu() {
  const template = [
    {
      label: 'OceanERP',
      submenu: [
        { label: 'Changer de serveur', click: () => loadLauncher() },
        { label: 'Verifier les mises a jour', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { role: 'reload', label: 'Recharger' },
        { role: 'quit', label: 'Quitter' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) {
    return;
  }

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    return;
  }

  tray = new Tray(image);
  tray.setToolTip('OceanERP');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir OceanERP', click: () => mainWindow?.show() },
    { label: 'Changer de serveur', click: () => loadLauncher() },
    { label: 'Verifier les mises a jour', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() }
  ]));
}

function notify(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function configureAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => notify('OceanERP', 'Une mise a jour Windows est disponible. Telechargement en cours.'));
  autoUpdater.on('update-downloaded', () => notify('OceanERP', "Mise a jour telechargee. Elle sera installee a la fermeture de l'application."));
  autoUpdater.on('error', (error) => {
    log.warn('OceanERP update check failed', error);
    updateCheckInProgress = false;
  });
  autoUpdater.on('update-not-available', () => {
    updateCheckInProgress = false;
  });
}

function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) {
      notify('OceanERP', "La recherche de mises a jour est disponible dans l'application installee.");
    }
    return;
  }

  if (updateCheckInProgress) {
    return;
  }

  updateCheckInProgress = true;
  autoUpdater.checkForUpdates().catch((error) => {
    updateCheckInProgress = false;
    log.warn('OceanERP update check failed', error);
    if (manual) {
      notify('OceanERP', 'Mise a jour indisponible. Verifiez la configuration de publication Electron.');
    }
  });
}

ipcMain.handle('settings:get', () => readSettings());

ipcMain.handle('settings:connect', (_, payload) => {
  try {
    const serverUrl = normalizeServerUrl(payload?.serverUrl || '');
    writeSettings({ serverUrl });
    loadServerUrl(serverUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'URL invalide' };
  }
});

ipcMain.handle('settings:save', (_, payload) => {
  try {
    const serverUrl = normalizeServerUrl(payload?.serverUrl || '');
    writeSettings({ serverUrl });
    loadServerUrl(serverUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'URL invalide' };
  }
});

ipcMain.on('app:quit', () => app.quit());

ipcMain.on('notify', (_, payload) => {
  if (Notification.isSupported()) {
    new Notification({ title: payload?.title || 'OceanERP', body: payload?.body || '' }).show();
  }
});

app.whenReady().then(() => {
  configureAutoUpdater();
  createMenu();
  createWindow();
  createTray();

  notify('OceanERP', 'Application Windows prete.');
  setTimeout(() => checkForUpdates(false), 10_000);
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const serverUrl = readSettings().serverUrl;
    if (serverUrl && !url.startsWith(serverUrl) && !url.startsWith('data:text/html')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
