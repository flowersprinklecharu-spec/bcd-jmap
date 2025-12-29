import { useState, useEffect } from 'react';

// Simple utility to check if user is admin - checks localStorage only, using the same key as App.js
export const isUserAdmin = () => {
  const isAdmin = localStorage.getItem('jmap_isAdmin') === 'true';
  const adminUser = localStorage.getItem('jmap_adminUser');
  
  return isAdmin && adminUser;
};

// React hook to get admin status that updates when storage changes
export const useAdminStatus = () => {
  const [isAdmin, setIsAdmin] = useState(() => isUserAdmin());
  
  useEffect(() => {
    // Check storage on mount
    const currentStatus = isUserAdmin();
    setIsAdmin(currentStatus);
    
    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = () => {
      setIsAdmin(isUserAdmin());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  return isAdmin;
};