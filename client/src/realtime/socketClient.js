import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { isDesktopApp } from '../desktop/bridge';
import { acquireDesktopSocket } from '../desktop/realtimeSocket';

export const createSocket = () => {
  if (isDesktopApp()) {
    return acquireDesktopSocket();
  }

  return io(SOCKET_URL, {
    transports: ['websocket'],
    withCredentials: true,
  });
};
