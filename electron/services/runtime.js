const path = require('path');
const { app } = require('electron');

const API_PORT = process.env.PORT || '5001';
const SOCKET_PORT = process.env.SOCKET_PORT || '5002';
const CLIENT_PORT = process.env.CLIENT_PORT || '3000';

const getApiBaseUrl = () => process.env.ELECTRON_API_URL || `http://127.0.0.1:${API_PORT}/api`;

const getApiOrigin = () => getApiBaseUrl().replace(/\/api\/?$/, '');

const getSocketUrl = () => process.env.ELECTRON_SOCKET_URL || `http://127.0.0.1:${SOCKET_PORT}`;

const getClientUrl = () => process.env.ELECTRON_START_URL || `http://localhost:${CLIENT_PORT}`;

const getProductionIndexPath = () =>
  app.isPackaged
    ? path.join(app.getAppPath(), 'client', 'build', 'index.html')
    : path.join(__dirname, '..', '..', 'client', 'build', 'index.html');

const getServerEntryPath = (relativePath) =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'server', relativePath)
    : path.join(__dirname, '..', '..', 'server', relativePath);

const getServerWorkingDirectory = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, '..', '..', 'server');

module.exports = {
  getApiBaseUrl,
  getApiOrigin,
  getSocketUrl,
  getClientUrl,
  getProductionIndexPath,
  getServerEntryPath,
  getServerWorkingDirectory,
};
