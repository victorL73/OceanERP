const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    serverUrl: process.env.OCEANERP_WEB_URL || 'http://localhost:5173'
  }
});

let mainWindow;
let tray;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'OceanERP',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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

  mainWindow.loadURL(store.get('serverUrl'));
}

function createMenu() {
  const template = [
    {
      label: 'OceanERP',
      submenu: [
        {
          label: 'Configurer le serveur',
          click: async () => {
            const url = process.env.OCEANERP_WEB_URL || store.get('serverUrl');
            store.set('serverUrl', url);
            mainWindow?.loadURL(url);
          }
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recharger' },
        { role: 'quit', label: 'Quitter' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
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
    { label: 'Quitter', click: () => app.quit() }
  ]));
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
  createTray();

  if (Notification.isSupported()) {
    new Notification({ title: 'OceanERP', body: 'Application Windows prête.' }).show();
  }
});

ipcMain.on('notify', (_, payload) => {
  if (Notification.isSupported()) {
    new Notification({ title: payload?.title || 'OceanERP', body: payload?.body || '' }).show();
  }
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(store.get('serverUrl'))) {
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
