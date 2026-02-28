import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { getTokenSync } from '../desktop/session';
import { isDesktopApp } from '../desktop/bridge';
import { acquireDesktopSocket } from '../desktop/realtimeSocket';

export const createSocket = () => {
  if (isDesktopApp()) {
    return acquireDesktopSocket();
  }

  const token = getTokenSync('user');

  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });
};
