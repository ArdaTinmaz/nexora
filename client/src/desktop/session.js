import { getDesktopBridge, isDesktopApp } from './bridge';

export const AUTH_STORAGE_KEY = 'taskProAuth';
export const ADMIN_STORAGE_KEY = 'adminAuthToken';

const storageKeyByScope = {
  user: AUTH_STORAGE_KEY,
  admin: ADMIN_STORAGE_KEY,
};

const parseStoredValue = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const readFromWebStorage = (scope) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const key = storageKeyByScope[scope];
  return parseStoredValue(window.localStorage.getItem(key));
};

const writeToWebStorage = (scope, value) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return value;
  }

  const key = storageKeyByScope[scope];
  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
};

const clearWebStorage = (scope) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const key = storageKeyByScope[scope];
  window.localStorage.removeItem(key);
};

export const getSessionSync = (scope = 'user') => {
  if (isDesktopApp()) {
    return getDesktopBridge().session.getSync(scope);
  }

  return readFromWebStorage(scope);
};

export const getSession = async (scope = 'user') => {
  if (isDesktopApp()) {
    return getDesktopBridge().session.get(scope);
  }

  return readFromWebStorage(scope);
};

export const setSession = async (scope = 'user', value) => {
  if (isDesktopApp()) {
    return getDesktopBridge().session.set(scope, value);
  }

  return writeToWebStorage(scope, value);
};

export const clearSession = async (scope = 'user') => {
  if (isDesktopApp()) {
    return getDesktopBridge().session.clear(scope);
  }

  clearWebStorage(scope);
  return true;
};

export const getTokenSync = (scope = 'user') => getSessionSync(scope)?.token || null;
