const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const defaultSettings = {
  serverUrl: process.env.OCEANERP_WEB_URL || readPackagedServerUrl() || 'http://localhost:5173'
};

let mainWindow;
let settingsWindow;
let tray;

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
      // Ignore invalid packaged config and fall back to localhost.
    }
  }

  return null;
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeServerUrl(value) {
  const parsed = new URL(value.trim());
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

function loadServerUrl() {
  const settings = readSettings();
  mainWindow.loadURL(settings.serverUrl);
}

function showConnectionError(url, errorDescription) {
  const message = `Impossible de joindre le serveur OceanERP.\n\n${url}\n\n${errorDescription || ''}`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>OceanERP</title>
        <style>
          body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #f4f7fb; color: #102033; display: grid; min-height: 100vh; place-items: center; }
          main { width: min(560px, calc(100vw - 48px)); background: white; border: 1px solid #d9e2ef; border-radius: 8px; padding: 28px; box-shadow: 0 12px 32px rgba(16, 32, 51, .08); }
          h1 { margin: 0 0 12px; font-size: 22px; }
          p { line-height: 1.5; color: #52627a; white-space: pre-line; }
        </style>
      </head>
      <body><main><h1>Connexion impossible</h1><p>${escapeHtml(message)}</p><p>Utilisez le menu OceanERP > Configurer le serveur, puis rechargez l'application.</p></main></body>
    </html>
  `)}`);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedUrl) => {
    if (errorCode !== -3) {
      showConnectionError(validatedUrl, errorDescription);
    }
  });

  loadServerUrl();
}

function createMenu() {
  const template = [
    {
      label: 'OceanERP',
      submenu: [
        {
          label: 'Configurer le serveur',
          click: openSettingsWindow
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recharger' },
        { role: 'quit', label: 'Quitter' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 260,
    parent: mainWindow,
    modal: true,
    resizable: false,
    title: 'Configurer OceanERP',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Configurer OceanERP</title>
        <style>
          body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #f7f9fc; color: #102033; }
          form { display: grid; gap: 14px; padding: 24px; }
          label { display: grid; gap: 8px; font-weight: 600; }
          input { height: 38px; border: 1px solid #cdd7e5; border-radius: 6px; padding: 0 10px; font: inherit; }
          footer { display: flex; justify-content: flex-end; gap: 10px; }
          button { border: 0; border-radius: 6px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
          .primary { background: #0f7f73; color: white; }
          .secondary { background: #e8eef7; color: #102033; }
          .error { color: #b42318; min-height: 20px; }
        </style>
      </head>
      <body>
        <form id="form">
          <label>URL du serveur ERP<input id="serverUrl" type="url" required /></label>
          <div class="error" id="error"></div>
          <footer>
            <button type="button" class="secondary" id="cancel">Annuler</button>
            <button type="submit" class="primary">Enregistrer</button>
          </footer>
        </form>
        <script>
          const { ipcRenderer } = require('electron');
          const input = document.getElementById('serverUrl');
          const error = document.getElementById('error');
          ipcRenderer.invoke('settings:get').then(settings => { input.value = settings.serverUrl || ''; });
          document.getElementById('cancel').addEventListener('click', () => window.close());
          document.getElementById('form').addEventListener('submit', event => {
            event.preventDefault();
            error.textContent = '';
            ipcRenderer.invoke('settings:save', { serverUrl: input.value }).then(result => {
              if (!result.ok) {
                error.textContent = result.error || 'URL invalide';
                return;
              }
              window.close();
            });
          });
        </script>
      </body>
    </html>
  `)}`);
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
    { label: 'Configurer le serveur', click: openSettingsWindow },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() }
  ]));
}

ipcMain.handle('settings:get', () => readSettings());

ipcMain.handle('settings:save', (_, payload) => {
  try {
    const serverUrl = normalizeServerUrl(payload?.serverUrl || '');
    const settings = writeSettings({ serverUrl });
    mainWindow?.loadURL(settings.serverUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'URL invalide' };
  }
});

ipcMain.on('notify', (_, payload) => {
  if (Notification.isSupported()) {
    new Notification({ title: payload?.title || 'OceanERP', body: payload?.body || '' }).show();
  }
});

app.whenReady().then(() => {
  createMenu();
  createWindow();
  createTray();

  if (Notification.isSupported()) {
    new Notification({ title: 'OceanERP', body: 'Application Windows prete.' }).show();
  }
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const serverUrl = readSettings().serverUrl;
    if (!url.startsWith(serverUrl) && !url.startsWith('data:text/html')) {
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
