import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
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

  // Simplified auth check - trust localStorage more, Firebase less aggressive
  useEffect(() => {
    let mounted = true;
    
    // If localStorage says admin, try to verify with Firebase but don't immediately clear on failure
    const storedAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (storedAdmin && auth) {
      setIsAuthLoading(true);
      
      // Check current auth state
      const checkAuth = async () => {
        try {
          // If there's a current user, we're good
          if (auth.currentUser) {
            console.log('Admin verified with current user:', auth.currentUser.email);
            if (mounted) {
              setIsAdmin(true);
              localStorage.setItem('adminUser', auth.currentUser.email);
              setIsAuthLoading(false);
            }
            return;
          }

          // Set up auth state listener
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!mounted) return;
            
            if (user) {
              console.log('Admin verified with auth state:', user.email);
              setIsAdmin(true);
              localStorage.setItem('isAdmin', 'true');
              localStorage.setItem('adminUser', user.email);
            }
            // Don't automatically logout on no user - could be temporary
            
            setIsAuthLoading(false);
            unsubscribe();
          });

          // Timeout to stop loading if Firebase doesn't respond
          setTimeout(() => {
            if (mounted) {
              console.log('Auth check timeout - keeping localStorage state');
              setIsAuthLoading(false);
            }
          }, 2000);

        } catch (error) {
          console.error('Auth check error:', error);
          if (mounted) {
            setIsAuthLoading(false);
            // Keep existing admin state from localStorage
          }
        }
      };

      checkAuth();
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleAdminToggle = async () => {
    if (isAdmin) {
      // Explicit logout with confirmation
      if (window.confirm('Are you sure you want to logout?')) {
        try {
          const { logoutUser } = await import('./firebase');
          await logoutUser();
        } catch (error) {
          console.error('Firebase logout failed:', error);
        }
        
        // Always clear local state
        setIsAdmin(false);
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
        setCurrentPage('home');
      }
    } else {
      // Navigate to login page
      setCurrentPage('admin');
    }
  };

  const handleLoginSuccess = (user) => {
    console.log('Login success callback:', user?.email);
    setIsAdmin(true);
    localStorage.setItem('isAdmin', 'true');
    if (user?.email) {
      localStorage.setItem('adminUser', user.email);
    }
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