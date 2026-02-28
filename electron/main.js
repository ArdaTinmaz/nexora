const { app, BrowserWindow } = require('electron');
const path = require('path');
const registerIpcHandlers = require('./services/ipc');
const runtime = require('./services/runtime');
const sessionStore = require('./services/sessionStore');
const { startManagedBackends, stopManagedBackends } = require('./services/backendManager');
const deepLinks = require('./services/deepLinks');
const socketManager = require('./services/socketManager');

// Dev algısı: env ile gelirse onu kullan, yoksa paketlenmemiş durumdayken dev kabul et
const isDev =
  process.env.ELECTRON_START_URL || process.env.NODE_ENV === 'development' || !app.isPackaged;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  deepLinks.captureInitialRoute();
  deepLinks.registerDeepLinkHandlers();
  const createWindow = () => {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    deepLinks.setMainWindow(win);

    const devUrl = runtime.getClientUrl();

    if (isDev) {
      win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        // eslint-disable-next-line no-console
        console.error('Electron failed to load URL:', { errorCode, errorDescription, validatedURL });
      });

      win.loadURL(devUrl);
      win.webContents.openDevTools({ mode: 'detach' });
    } else {
      const indexPath = runtime.getProductionIndexPath();
      win.loadFile(indexPath);
    }
  };

  app.whenReady().then(async () => {
    sessionStore.loadState();
    registerIpcHandlers();
    await startManagedBackends();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    socketManager.teardownSocket();
    stopManagedBackends();
  });
}
