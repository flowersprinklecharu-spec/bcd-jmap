import React, { useState, useEffect } from 'react';
import JeepneyMap from './Home/home';
import RoutesPage from './Routes/Routes';
import RouteEditor from './RouteEditor/RouteEditor';
import LandmarksPage from './Landmarks/Landmarks';
import AnnouncementsPage from './Announcements/Announcements';
import AboutPage from './About/About';
import AdminLoginPage from './Login/AdminLoginPage';
import './Home/home.css';
import './Navbar/navbar.css';
import './Routes/routes.css';
import './RouteEditor/route-editor.css';
import './Landmarks/landmarks.css';
import './Announcements/announcements.css';
import './Login/login.css';
import './About/about.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [pageParams, setPageParams] = useState({});
  const [isAdmin, setIsAdmin] = useState(() => {
    // Always trust localStorage on initial load
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false); // Start as false, only show loading when explicitly checking auth

  // Admin state controlled ONLY by localStorage - Firebase Auth disabled for admin state
  useEffect(() => {
    // Just trust localStorage completely - no Firebase auth state management
    const storedAdmin = localStorage.getItem('isAdmin') === 'true';
    const storedUser = localStorage.getItem('adminUser');
    
    console.log('App loaded - Admin state from localStorage:', storedAdmin);
    if (storedAdmin && storedUser) {
      console.log('Restoring admin session for:', storedUser);
    }
    
    // Admin state is already set from localStorage in useState initializer
    // No need to change it here unless we want to do additional verification
    setIsAuthLoading(false);
  }, []);

  const handleAdminToggle = async () => {
    if (isAdmin) {
      // Explicit logout with confirmation - ONLY way to logout
      if (window.confirm('Are you sure you want to logout?')) {
        console.log('Admin manually logging out');
        
        // Clear local state first
        setIsAdmin(false);
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
        setCurrentPage('home');
        
        // Try to logout from Firebase but don't wait for it or let it affect local state
        try {
          const { logoutUser } = await import('./firebase');
          await logoutUser();
          console.log('Firebase logout completed');
        } catch (error) {
          console.error('Firebase logout failed (but local logout succeeded):', error);
        }
      }
    } else {
      // Navigate to login page
      setCurrentPage('admin');
    }
  };

  const handleLoginSuccess = (user) => {
    console.log('Login success - setting admin state:', user?.email);
    
    // Set admin state in both React and localStorage
    setIsAdmin(true);
    localStorage.setItem('isAdmin', 'true');
    if (user?.email) {
      localStorage.setItem('adminUser', user.email);
    }
    
    console.log('Admin state saved to localStorage');
    setCurrentPage('home');
  };

  const handleNavigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
  };

  const renderPage = () => {
    // Show loading while checking auth state
    if (isAuthLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading...
        </div>
      );
    }

    // Pass isAdmin and handleAdminToggle to all pages
    const sharedProps = {
      onNavigate: handleNavigate,
      isAdmin: isAdmin,
      onAdminToggle: handleAdminToggle
    };

    switch(currentPage) {
      case 'home':
        return <JeepneyMap {...sharedProps} />;
      case 'routes':
        return <RoutesPage {...sharedProps} />;
      case 'route-editor':
        return <RouteEditor {...sharedProps} routeId={pageParams.routeId} />;
      case 'landmarks':
        return <LandmarksPage {...sharedProps} />;
      case 'announcements':
        return <AnnouncementsPage {...sharedProps} />;
      case 'about':
        return <AboutPage {...sharedProps} />;
      case 'admin':
        return <AdminLoginPage onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigate} />;
      default:
        return <JeepneyMap {...sharedProps} />;
    }
  };

  return (
    <div className="App">
      {renderPage()}
    </div>
  );
}

export default App;