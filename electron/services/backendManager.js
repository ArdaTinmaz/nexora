const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { app } = require('electron');

const runtime = require('./runtime');

const managedChildren = [];

const isManagementEnabled = () =>
  process.env.ELECTRON_MANAGED_BACKEND === '1' || app.isPackaged;

const createChildEnv = () => ({
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  NEXORA_UPLOADS_DIR: app.isPackaged
    ? path.join(app.getPath('userData'), 'uploads')
    : process.env.NEXORA_UPLOADS_DIR,
  NEXORA_LEGACY_UPLOADS_DIR: app.isPackaged
    ? path.join(runtime.getServerWorkingDirectory(), 'uploads')
    : process.env.NEXORA_LEGACY_UPLOADS_DIR,
});

const spawnNodeScript = (scriptPath, label) => {
  const child = spawn(process.execPath, [scriptPath], {
    env: createChildEnv(),
    stdio: 'pipe',
    windowsHide: true,
    cwd: runtime.getServerWorkingDirectory(),
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`[${label}] exited with ${reason}\n`);
  });

  managedChildren.push(child);
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isTcpPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });

    const finalize = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.once('connect', () => finalize(true));
    socket.once('error', () => finalize(false));
    socket.setTimeout(1000, () => finalize(false));
  });

const waitForPort = async (port, label, timeoutMs = 30000) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isTcpPortOpen(port)) {
      return;
    }

    await wait(300);
  }

  throw new Error(`Timed out waiting for ${label} on port ${port}`);
};

const waitForManagedServices = async () => {
  const apiPort = process.env.PORT || '5001';
  const socketPort = process.env.SOCKET_PORT || '5002';

  await Promise.all([
    waitForPort(apiPort, 'API server'),
    waitForPort(socketPort, 'Socket server'),
  ]);
};

const startManagedBackends = async () => {
  if (!isManagementEnabled()) {
    return;
  }

  spawnNodeScript(runtime.getServerEntryPath('server.js'), 'api');
  spawnNodeScript(runtime.getServerEntryPath(path.join('realtime', 'socketServer.js')), 'socket');
  await waitForManagedServices();
};

const stopManagedBackends = () => {
  while (managedChildren.length > 0) {
    const child = managedChildren.pop();
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
};

module.exports = {
  startManagedBackends,
  stopManagedBackends,
};
