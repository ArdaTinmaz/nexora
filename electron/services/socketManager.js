const { BrowserWindow, Notification } = require('electron');
const { io } = require('socket.io-client');

const runtime = require('./runtime');
const sessionStore = require('./sessionStore');

let socket = null;
let connectingPromise = null;
let lastConnectionState = {
  connected: false,
  error: null,
};

const emitToRenderers = (channel, payload) => {
  BrowserWindow.getAllWindows().forEach((windowInstance) => {
    if (!windowInstance.isDestroyed()) {
      windowInstance.webContents.send(channel, payload);
    }
  });
};

const notifyIfNeeded = (eventName, payload) => {
  if (!Notification.isSupported()) {
    return;
  }

  const appIsFocused = BrowserWindow.getAllWindows().some(
    (windowInstance) => !windowInstance.isDestroyed() && windowInstance.isFocused()
  );
  if (appIsFocused) {
    return;
  }

  if (eventName === 'taskAssigned') {
    new Notification({
      title: 'New task assigned',
      body: payload?.cardTitle || payload?.cardId || 'A task was assigned to you.',
      silent: false,
    }).show();
    return;
  }

  if (eventName === 'receiveChannelMessage') {
    const senderName = payload?.sender?.name || 'Team';
    const body = payload?.message || 'You have a new channel message.';
    new Notification({
      title: senderName,
      body,
      silent: false,
    }).show();
  }
};

const getUserToken = () => sessionStore.getSession('user')?.token || null;

const teardownSocket = () => {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.close();
  socket = null;
  connectingPromise = null;
  lastConnectionState = {
    connected: false,
    error: null,
  };
  emitToRenderers('realtime:state', lastConnectionState);
};

const refreshUserSession = async () => {
  const session = sessionStore.getSession('user');
  const refreshToken = session?.refreshToken;
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  const response = await fetch(`${runtime.getApiBaseUrl()}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token || !data?.refreshToken) {
    throw new Error(data?.message || 'Unable to refresh session');
  }

  sessionStore.setSession('user', {
    token: data.token,
    refreshToken: data.refreshToken,
    user: data.user,
  });

  return data.token;
};

const registerSocketEvents = () => {
  if (!socket) {
    return;
  }

  socket.on('connect', () => {
    lastConnectionState = {
      connected: true,
      error: null,
    };
    emitToRenderers('realtime:state', lastConnectionState);
    emitToRenderers('realtime:event', { event: 'connect', args: [] });
  });

  socket.on('disconnect', (reason) => {
    lastConnectionState = {
      connected: false,
      error: reason || null,
    };
    emitToRenderers('realtime:state', lastConnectionState);
    emitToRenderers('realtime:event', { event: 'disconnect', args: [reason] });
  });

  socket.on('connect_error', async (error) => {
    const message = error?.message || 'Socket connection failed';

    if (/jwt|token|unauthorized|auth/i.test(message)) {
      try {
        const nextToken = await refreshUserSession();
        if (socket) {
          socket.auth = { token: nextToken };
          socket.connect();
          return;
        }
      } catch (refreshError) {
        lastConnectionState = {
          connected: false,
          error: refreshError.message,
        };
        emitToRenderers('realtime:state', lastConnectionState);
        emitToRenderers('realtime:event', {
          event: 'connect_error',
          args: [{ message: refreshError.message }],
        });
        return;
      }
    }

    lastConnectionState = {
      connected: false,
      error: message,
    };
    emitToRenderers('realtime:state', lastConnectionState);
    emitToRenderers('realtime:event', {
      event: 'connect_error',
      args: [{ message }],
    });
  });

  socket.onAny((event, ...args) => {
    emitToRenderers('realtime:event', { event, args });
    notifyIfNeeded(event, args[0]);
  });
};

const ensureSocket = () => {
  if (socket) {
    socket.auth = { token: getUserToken() };
    return socket;
  }

  socket = io(runtime.getSocketUrl(), {
    autoConnect: false,
    transports: ['websocket'],
    auth: {
      token: getUserToken(),
    },
  });

  registerSocketEvents();
  return socket;
};

const connectSocket = async () => {
  const token = getUserToken();
  if (!token) {
    lastConnectionState = {
      connected: false,
      error: 'No user session available',
    };
    emitToRenderers('realtime:state', lastConnectionState);
    return lastConnectionState;
  }

  const activeSocket = ensureSocket();
  if (activeSocket.connected) {
    return lastConnectionState;
  }

  if (!connectingPromise) {
    connectingPromise = new Promise((resolve) => {
      const handleConnect = () => {
        cleanup();
        connectingPromise = null;
        resolve(lastConnectionState);
      };

      const handleError = () => {
        cleanup();
        connectingPromise = null;
        resolve(lastConnectionState);
      };

      const cleanup = () => {
        activeSocket.off('connect', handleConnect);
        activeSocket.off('connect_error', handleError);
      };

      activeSocket.once('connect', handleConnect);
      activeSocket.once('connect_error', handleError);
      activeSocket.connect();
    });
  }

  return connectingPromise;
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }

  connectingPromise = null;
  lastConnectionState = {
    connected: false,
    error: null,
  };
  emitToRenderers('realtime:state', lastConnectionState);
  return lastConnectionState;
};

const emitSocketEvent = async (eventName, payload) => {
  const activeSocket = ensureSocket();
  if (!activeSocket.connected) {
    await connectSocket();
  }

  if (!activeSocket.connected) {
    return { error: lastConnectionState.error || 'Socket is not connected' };
  }

  return new Promise((resolve) => {
    activeSocket.emit(eventName, payload, (response) => {
      resolve(response);
    });
  });
};

const getState = () => lastConnectionState;

const handleSessionChange = (scope, value) => {
  if (scope !== 'user') {
    return;
  }

  if (!value?.token) {
    disconnectSocket();
    return;
  }

  const activeSocket = ensureSocket();
  activeSocket.auth = { token: value.token };
  if (activeSocket.connected) {
    activeSocket.disconnect();
    activeSocket.connect();
  }
};

module.exports = {
  connectSocket,
  disconnectSocket,
  emitSocketEvent,
  getState,
  handleSessionChange,
  teardownSocket,
};
