const { app, BrowserWindow, dialog } = require('electron');
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
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nexora.desktop');
  }

  deepLinks.captureInitialRoute();
  deepLinks.registerDeepLinkHandlers();
  const createWindow = () => {
    const iconPath = isDev
      ? path.join(
          __dirname,
          '..',
          'client',
          'public',
          process.platform === 'win32' ? 'favicon.ico' : 'icon.PNG'
        )
      : path.join(
          process.resourcesPath,
          process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png'
        );

    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      icon: iconPath,
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
    try {
      await startManagedBackends();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Managed backend startup failed:', error);
      dialog.showErrorBox(
        'Backend baslatilamadi',
        `Sunucu servisleri acilamadi.\n\n${error.message}\n\n` +
          'server/.env dosyasinda MONGODB_URI tanimli oldugundan emin olun.'
      );
    }
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
