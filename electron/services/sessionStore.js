const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const STORE_FILENAME = 'nexora-session-store.json';
const DEFAULT_STATE = {
  user: null,
  admin: null,
};

let state = { ...DEFAULT_STATE };
let isLoaded = false;

const getStorePath = () => path.join(app.getPath('userData'), STORE_FILENAME);

const encodeState = (nextState) => {
  const serialized = JSON.stringify(nextState);
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(serialized).toString('base64');
  }

  return serialized;
};

const decodeState = (rawValue) => {
  if (!rawValue) {
    return { ...DEFAULT_STATE };
  }

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(rawValue, 'base64'));
      return { ...DEFAULT_STATE, ...JSON.parse(decrypted) };
    }
  } catch (_) {
    return { ...DEFAULT_STATE };
  }

  try {
    return { ...DEFAULT_STATE, ...JSON.parse(rawValue) };
  } catch (_) {
    return { ...DEFAULT_STATE };
  }
};

const persistState = () => {
  fs.writeFileSync(getStorePath(), encodeState(state), 'utf8');
};

const loadState = () => {
  try {
    if (!fs.existsSync(getStorePath())) {
      state = { ...DEFAULT_STATE };
      isLoaded = true;
      return state;
    }

    state = decodeState(fs.readFileSync(getStorePath(), 'utf8'));
    isLoaded = true;
    return state;
  } catch (_) {
    state = { ...DEFAULT_STATE };
    isLoaded = true;
    return state;
  }
};

const ensureLoaded = () => {
  if (!isLoaded) {
    loadState();
  }

  return state;
};

const getSession = (scope) => {
  const currentState = ensureLoaded();
  return currentState[scope] || null;
};

const setSession = (scope, value) => {
  ensureLoaded();
  state = {
    ...state,
    [scope]: value || null,
  };
  persistState();
  return state[scope];
};

const clearSession = (scope) => {
  ensureLoaded();
  state = {
    ...state,
    [scope]: null,
  };
  persistState();
  return true;
};

module.exports = {
  loadState,
  getSession,
  setSession,
  clearSession,
};
