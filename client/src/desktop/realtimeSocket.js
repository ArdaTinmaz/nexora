import { getDesktopBridge, isDesktopApp } from './bridge';

const desktopBridge = getDesktopBridge();
const listenersByEvent = new Map();
let activeConsumers = 0;
let state = isDesktopApp() ? desktopBridge.realtime.getStateSync() : { connected: false, error: null };
let detachEventListener = null;
let detachStateListener = null;

const emitToListeners = (eventName, args = []) => {
  const listeners = listenersByEvent.get(eventName);
  if (!listeners) {
    return;
  }

  [...listeners].forEach((listener) => {
    listener(...args);
  });
};

const ensureRealtimeSubscriptions = () => {
  if (!isDesktopApp() || detachEventListener || detachStateListener) {
    return;
  }

  detachEventListener = desktopBridge.realtime.onEvent((payload) => {
    if (!payload?.event) {
      return;
    }

    emitToListeners(payload.event, payload.args || []);
  });

  detachStateListener = desktopBridge.realtime.onState((nextState) => {
    state = nextState || { connected: false, error: null };
  });
};

const addListener = (eventName, handler) => {
  const listeners = listenersByEvent.get(eventName) || new Set();
  listeners.add(handler);
  listenersByEvent.set(eventName, listeners);
};

const removeListener = (eventName, handler) => {
  const listeners = listenersByEvent.get(eventName);
  if (!listeners) {
    return;
  }

  listeners.delete(handler);
  if (listeners.size === 0) {
    listenersByEvent.delete(eventName);
  }
};

const desktopSocket = {
  get connected() {
    return Boolean(state?.connected);
  },
  on(eventName, handler) {
    addListener(eventName, handler);
    return desktopSocket;
  },
  off(eventName, handler) {
    removeListener(eventName, handler);
    return desktopSocket;
  },
  once(eventName, handler) {
    const wrappedHandler = (...args) => {
      removeListener(eventName, wrappedHandler);
      handler(...args);
    };
    addListener(eventName, wrappedHandler);
    return desktopSocket;
  },
  async emit(eventName, payload, callback = () => {}) {
    const response = await desktopBridge.realtime.emit(eventName, payload);
    callback(response);
    return response;
  },
  async connect() {
    ensureRealtimeSubscriptions();
    state = await desktopBridge.realtime.connect();
    return state;
  },
  async disconnect() {
    activeConsumers = Math.max(0, activeConsumers - 1);
    if (activeConsumers === 0) {
      state = await desktopBridge.realtime.disconnect();
    }
    return state;
  },
};

export const acquireDesktopSocket = () => {
  ensureRealtimeSubscriptions();
  activeConsumers += 1;
  desktopBridge.realtime.connect().catch(() => {});
  return desktopSocket;
};
