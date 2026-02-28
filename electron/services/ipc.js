const { ipcMain, Notification, dialog } = require('electron');
const { Blob, FormData } = globalThis;

const sessionStore = require('./sessionStore');
const runtime = require('./runtime');
const socketManager = require('./socketManager');
const deepLinks = require('./deepLinks');

const createFormData = (entries) => {
  const formData = new FormData();

  entries.forEach((entry) => {
    if (entry.kind === 'file') {
      const blob = new Blob([Buffer.from(entry.buffer)], {
        type: entry.mimeType || 'application/octet-stream',
      });
      formData.append(entry.name, blob, entry.fileName || 'upload.bin');
      return;
    }

    formData.append(entry.name, entry.value ?? '');
  });

  return formData;
};

const resolveRequestBody = (body) => {
  if (!body) {
    return undefined;
  }

  if (body.kind === 'form-data') {
    return createFormData(body.entries || []);
  }

  return body.value;
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : {};
};

const buildRuntimePayload = () => ({
  isDesktop: true,
  apiBaseUrl: runtime.getApiBaseUrl(),
  apiOrigin: runtime.getApiOrigin(),
  socketUrl: runtime.getSocketUrl(),
});

const registerIpcHandlers = () => {
  ipcMain.handle('runtime:get', () => buildRuntimePayload());
  ipcMain.on('runtime:get-sync', (event) => {
    event.returnValue = buildRuntimePayload();
  });

  ipcMain.handle('session:get', (_event, scope) => sessionStore.getSession(scope));
  ipcMain.on('session:get-sync', (event, scope) => {
    event.returnValue = sessionStore.getSession(scope);
  });
  ipcMain.handle('session:set', (_event, scope, value) => {
    const saved = sessionStore.setSession(scope, value);
    socketManager.handleSessionChange(scope, saved);
    return saved;
  });
  ipcMain.handle('session:clear', (_event, scope) => {
    const cleared = sessionStore.clearSession(scope);
    socketManager.handleSessionChange(scope, null);
    return cleared;
  });

  ipcMain.handle('api:request', async (_event, requestConfig) => {
    const {
      path,
      method = 'GET',
      headers = {},
      body,
      authScope = 'user',
    } = requestConfig;
    const targetUrl = `${runtime.getApiBaseUrl()}${path}`;
    const resolvedHeaders = { ...headers };

    if (authScope !== 'none') {
      const session = sessionStore.getSession(authScope);
      if (session?.token) {
        resolvedHeaders.Authorization = `Bearer ${session.token}`;
      }
    }

    if (body?.kind === 'form-data') {
      delete resolvedHeaders['Content-Type'];
      delete resolvedHeaders['content-type'];
    }

    const response = await fetch(targetUrl, {
      method,
      headers: resolvedHeaders,
      body: resolveRequestBody(body),
    });

    return {
      ok: response.ok,
      status: response.status,
      data: await parseResponse(response),
    };
  });

  ipcMain.handle('notifications:show', async (_event, payload = {}) => {
    if (!Notification.isSupported()) {
      return false;
    }

    const notification = new Notification({
      title: payload.title || 'Nexora',
      body: payload.body || '',
      silent: Boolean(payload.silent),
    });
    notification.show();
    return true;
  });

  ipcMain.handle('files:pick-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const [filePath] = result.filePaths;
    const fileBuffer = require('fs').readFileSync(filePath);
    const extension = filePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;

    return {
      kind: 'desktop-file',
      name: filePath.split(/[\\/]/).pop(),
      mimeType,
      buffer: fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ),
      dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
    };
  });

  ipcMain.handle('realtime:connect', () => socketManager.connectSocket());
  ipcMain.handle('realtime:disconnect', () => socketManager.disconnectSocket());
  ipcMain.handle('realtime:emit', (_event, eventName, payload) =>
    socketManager.emitSocketEvent(eventName, payload)
  );
  ipcMain.handle('realtime:get-state', () => socketManager.getState());
  ipcMain.on('realtime:get-state-sync', (event) => {
    event.returnValue = socketManager.getState();
  });

  ipcMain.handle('deep-link:get-pending-route', () => deepLinks.consumePendingRoute());
};

module.exports = registerIpcHandlers;
