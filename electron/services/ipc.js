const { ipcMain, Notification, dialog } = require('electron');
const { Blob, FormData } = globalThis;

const sessionStore = require('./sessionStore');
const runtime = require('./runtime');
const socketManager = require('./socketManager');
const deepLinks = require('./deepLinks');

const parseRequestTimeoutMs = () => {
  const value = Number.parseInt(process.env.ELECTRON_API_TIMEOUT_MS || '', 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return 15000;
};

const API_REQUEST_TIMEOUT_MS = parseRequestTimeoutMs();

const buildRequestErrorMessage = (error) => {
  if (error?.name === 'AbortError') {
    return 'Server request timed out. Please check backend connection.';
  }

  const code = error?.cause?.code || error?.code || '';
  if (code === 'ECONNREFUSED') {
    return 'Backend is not reachable on localhost. Please verify API service.';
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'DNS lookup failed while contacting backend service.';
  }

  return error?.message || 'Request failed';
};

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method,
        headers: resolvedHeaders,
        body: resolveRequestBody(body),
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        status: response.status,
        data: await parseResponse(response),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Desktop API request failed:', {
        targetUrl,
        method,
        message: error?.message,
        code: error?.cause?.code || error?.code || '',
      });

      return {
        ok: false,
        status: 0,
        data: {
          message: buildRequestErrorMessage(error),
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
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
