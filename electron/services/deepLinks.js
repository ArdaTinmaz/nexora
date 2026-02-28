const path = require('path');
const { app } = require('electron');

const DESKTOP_PROTOCOL = 'nexora';

let mainWindow = null;
let pendingRoute = null;

const extractProtocolUrl = (argv = []) =>
  argv.find((value) => typeof value === 'string' && value.startsWith(`${DESKTOP_PROTOCOL}://`)) || null;

const normalizeRoute = (incomingUrl) => {
  if (!incomingUrl) {
    return null;
  }

  try {
    const parsed = new URL(incomingUrl);
    if (parsed.protocol !== `${DESKTOP_PROTOCOL}:`) {
      return null;
    }

    const host = parsed.host || '';
    const pathname = parsed.pathname || '';
    const routePath = `${host ? `/${host}` : ''}${pathname}`.replace(/\/+/g, '/');

    if (routePath === '/app/reset-password') {
      return `/reset-password${parsed.search || ''}`;
    }

    if (routePath === '/app/auth/login') {
      return '/auth/login';
    }

    if (routePath === '/app/welcome') {
      return '/welcome';
    }

    if (routePath.startsWith('/app/home')) {
      return routePath.replace(/^\/app/, '') + (parsed.search || '');
    }
  } catch (_) {
    return null;
  }

  return null;
};

const deliverRoute = (route) => {
  if (!route) {
    return;
  }

  pendingRoute = route;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deep-link:navigate', route);
  }
};

const setMainWindow = (windowInstance) => {
  mainWindow = windowInstance;
};

const registerProtocol = () => {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
};

const registerDeepLinkHandlers = () => {
  registerProtocol();

  app.on('second-instance', (_event, argv) => {
    const route = normalizeRoute(extractProtocolUrl(argv));
    if (route) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
      deliverRoute(route);
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    deliverRoute(normalizeRoute(url));
  });
};

const captureInitialRoute = (argv = process.argv) => {
  const route = normalizeRoute(extractProtocolUrl(argv));
  if (route) {
    pendingRoute = route;
  }
};

const consumePendingRoute = () => {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
};

module.exports = {
  DESKTOP_PROTOCOL,
  setMainWindow,
  registerDeepLinkHandlers,
  captureInitialRoute,
  consumePendingRoute,
};
