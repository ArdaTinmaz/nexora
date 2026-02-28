import { getDesktopBridge, isDesktopApp } from './bridge';

export const showNotification = async ({ title, body, silent = false }) => {
  if (isDesktopApp()) {
    return getDesktopBridge().notifications.show({ title, body, silent });
  }

  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body, silent });
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(title, { body, silent });
      return true;
    }
  }

  return false;
};
