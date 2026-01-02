import { useState, useEffect } from 'react';

/**
 * Hook to detect online/offline status changes
 * Returns the current online status and notifies when it changes
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastStatusChange, setLastStatusChange] = useState(null);
  const [showInitial, setShowInitial] = useState(true);

  useEffect(() => {
    // Show initial status on first load (only once)
    if (showInitial) {
      const initialStatus = navigator.onLine ? 'online' : 'offline';
      setLastStatusChange(initialStatus);
      setShowInitial(false);
    }
  }, [showInitial]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastStatusChange('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastStatusChange('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, lastStatusChange };
};
