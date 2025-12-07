const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Dev algısı: env ile gelirse onu kullan, yoksa paketlenmemiş durumdayken dev kabul et
const isDev = process.env.ELECTRON_START_URL || process.env.NODE_ENV === 'development' || !app.isPackaged;

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

  const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';

  if (isDev) {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // eslint-disable-next-line no-console
      console.error('Electron failed to load URL:', { errorCode, errorDescription, validatedURL });
    });

    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'client', 'build', 'index.html');
    const fileUrl = pathToFileURL(indexPath).href;
    win.loadURL(fileUrl);
  }
};

app.whenReady().then(() => {
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
