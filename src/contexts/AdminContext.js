import React, { createContext } from 'react';

// Create the Admin Context
export const AdminContext = createContext({
  isAdmin: false,
  onAdminToggle: () => {},
  isAuthLoading: true
});

// Create the Admin Provider component
export function AdminProvider({ children, isAdmin, onAdminToggle, isAuthLoading }) {
  return (
    <AdminContext.Provider value={{ isAdmin, onAdminToggle, isAuthLoading }}>
      {children}
    </AdminContext.Provider>
  );
}
