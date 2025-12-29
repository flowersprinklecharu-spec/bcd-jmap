// Simple admin check - using the same key as App.js (jmap_isAdmin)
export const isCurrentlyAdmin = () => {
  try {
    return localStorage.getItem('jmap_isAdmin') === 'true';
  } catch (error) {
    return false;
  }
};

// Component that renders children only if admin
export const AdminOnly = ({ children }) => {
  // Direct localStorage check on every render, using the same key as App.js
  const isAdmin = localStorage.getItem('jmap_isAdmin') === 'true';
  return isAdmin ? children : null;
};