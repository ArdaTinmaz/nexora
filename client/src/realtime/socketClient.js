import { io } from 'socket.io-client';
import { AUTH_STORAGE_KEY } from '../config';

const getToken = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch {
    return null;
  }
};

export const createSocket = () => {
  const token = getToken();
  const url = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5002';

  return io(url, {
    auth: { token },
    transports: ['websocket'],
  });
};
