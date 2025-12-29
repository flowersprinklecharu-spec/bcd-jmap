import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './connection-status.css';

const OnlineIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"></path>
  </svg>
);

const OfflineIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM12 13v4h-2v-4H8l4-5 4 5h-4z"></path>
  </svg>
);

const ConnectionStatus = () => {
  const { isOnline, lastStatusChange } = useOnlineStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationText, setNotificationText] = useState('');

  useEffect(() => {
    if (lastStatusChange) {
      const text = lastStatusChange === 'online' ? 'Online' : 'Offline';
      setNotificationText(text);
      setShowNotification(true);

      console.log('📡 Connection status changed:', text);

      // Auto-hide notification after 4 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [lastStatusChange]);

  return showNotification ? (
    <div className={`connection-status-notification ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? <OnlineIcon /> : <OfflineIcon />}
      <span>{notificationText}</span>
    </div>
  ) : null;
};

export default ConnectionStatus;
