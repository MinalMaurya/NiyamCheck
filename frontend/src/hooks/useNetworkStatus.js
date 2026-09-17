import { useState, useEffect } from 'react';
import { checkSystemHealth } from '../api/inspections';

export function useNetworkStatus() {
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isBackendReachable, setIsBackendReachable] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsBrowserOnline(true);
      pingBackend();
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
      setIsBackendReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let isMounted = true;
    async function pingBackend() {
      if (!navigator.onLine) {
        if (isMounted) setIsBackendReachable(false);
        return;
      }
      try {
        const res = await checkSystemHealth();
        if (isMounted) {
          setIsBackendReachable(res && res.status === 'healthy');
        }
      } catch {
        if (isMounted) {
          setIsBackendReachable(false);
        }
      }
    }

    pingBackend();
    const interval = setInterval(pingBackend, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const isFullyConnected = isBrowserOnline && isBackendReachable;

  return {
    isBrowserOnline,
    isBackendReachable,
    isFullyConnected,
  };
}
