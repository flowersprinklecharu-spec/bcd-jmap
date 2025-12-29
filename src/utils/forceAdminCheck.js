import { useState, useEffect } from 'react';

// Hook that forces admin check after page load
export const useForceAdminCheck = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Check immediately, using the same key as App.js
    const checkAdmin = () => {
      const adminFlag = localStorage.getItem('jmap_isAdmin') === 'true';
      console.log('🔄 Force admin check:', adminFlag);
      setIsAdmin(adminFlag);
      setHasChecked(true);
    };

    checkAdmin();

    // Also check after a small delay in case something clears it
    const timer = setTimeout(checkAdmin, 100);

    return () => clearTimeout(timer);
  }, []);

  return { isAdmin, hasChecked };
};