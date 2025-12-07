const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nexora', {
  version: () => process.version,
});
//-