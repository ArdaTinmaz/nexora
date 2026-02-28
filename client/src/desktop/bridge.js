export const getDesktopBridge = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.nexora || null;
};

export const isDesktopApp = () => Boolean(getDesktopBridge()?.runtime?.getSync);
