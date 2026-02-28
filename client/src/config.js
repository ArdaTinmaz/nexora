import { runtime } from './desktop/runtime';
import { ADMIN_STORAGE_KEY, AUTH_STORAGE_KEY } from './desktop/session';

export const API_BASE_URL = runtime.apiBaseUrl;
export const API_ORIGIN = runtime.apiOrigin;
export const SOCKET_URL = runtime.socketUrl;
export const IS_DESKTOP_APP = runtime.isDesktop;
export { AUTH_STORAGE_KEY, ADMIN_STORAGE_KEY };

