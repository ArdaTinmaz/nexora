const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexora', {
  version: () => process.version,
  runtime: {
    get: () => ipcRenderer.invoke('runtime:get'),
    getSync: () => ipcRenderer.sendSync('runtime:get-sync'),
  },
  session: {
    get: (scope) => ipcRenderer.invoke('session:get', scope),
    getSync: (scope) => ipcRenderer.sendSync('session:get-sync', scope),
    set: (scope, value) => ipcRenderer.invoke('session:set', scope, value),
    clear: (scope) => ipcRenderer.invoke('session:clear', scope),
  },
  api: {
    request: (requestConfig) => ipcRenderer.invoke('api:request', requestConfig),
  },
  notifications: {
    show: (payload) => ipcRenderer.invoke('notifications:show', payload),
  },
  files: {
    pickImage: () => ipcRenderer.invoke('files:pick-image'),
  },
  realtime: {
    connect: () => ipcRenderer.invoke('realtime:connect'),
    disconnect: () => ipcRenderer.invoke('realtime:disconnect'),
    emit: (eventName, payload) => ipcRenderer.invoke('realtime:emit', eventName, payload),
    getState: () => ipcRenderer.invoke('realtime:get-state'),
    getStateSync: () => ipcRenderer.sendSync('realtime:get-state-sync'),
    onEvent: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on('realtime:event', handler);
      return () => ipcRenderer.removeListener('realtime:event', handler);
    },
    onState: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on('realtime:state', handler);
      return () => ipcRenderer.removeListener('realtime:state', handler);
    },
  },
  deepLinks: {
    getPendingRoute: () => ipcRenderer.invoke('deep-link:get-pending-route'),
    onNavigate: (listener) => {
      const handler = (_event, route) => listener(route);
      ipcRenderer.on('deep-link:navigate', handler);
      return () => ipcRenderer.removeListener('deep-link:navigate', handler);
    },
  },
});
