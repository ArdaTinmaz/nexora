import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { getDesktopBridge, isDesktopApp } from '../../desktop/bridge';

function DesktopRouteHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDesktopApp()) {
      return undefined;
    }

    let isMounted = true;
    const bridge = getDesktopBridge();

    bridge.deepLinks.getPendingRoute().then((route) => {
      if (isMounted && route) {
        navigate(route, { replace: true });
      }
    });

    const detach = bridge.deepLinks.onNavigate((route) => {
      if (route) {
        navigate(route, { replace: true });
      }
    });

    return () => {
      isMounted = false;
      detach();
    };
  }, [navigate]);

  return null;
}

export default DesktopRouteHandler;
