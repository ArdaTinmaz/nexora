import { getDesktopBridge, isDesktopApp } from './bridge';

const FALLBACK_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const FALLBACK_SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002';

const bridge = getDesktopBridge();
const desktopRuntime = isDesktopApp() ? bridge.runtime.getSync() : null;

export const runtime = {
  isDesktop: Boolean(desktopRuntime?.isDesktop),
  apiBaseUrl: desktopRuntime?.apiBaseUrl || FALLBACK_API_BASE_URL,
  apiOrigin: desktopRuntime?.apiOrigin || FALLBACK_API_BASE_URL.replace(/\/api\/?$/, ''),
  socketUrl: desktopRuntime?.socketUrl || FALLBACK_SOCKET_URL,
};
