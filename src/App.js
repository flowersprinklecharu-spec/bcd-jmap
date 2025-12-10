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
    // Initialize from localStorage, but auth state will override this
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', user ? 'signed in' : 'signed out');
      
      if (user) {
        // User is signed in
        console.log('User authenticated:', user.email);
        setIsAdmin(true);
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminUser', user.email);
      } else {
        // User is signed out
        console.log('User not authenticated');
        // Only set to false if we've actually checked auth state
        if (authChecked) {
          setIsAdmin(false);
          localStorage.removeItem('isAdmin');
          localStorage.removeItem('adminUser');
        }
      }
      
      setAuthChecked(true);
      setIsAuthLoading(false);
    });

    // Set a timeout to stop loading if Firebase doesn't respond
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('Auth check timeout, using localStorage state');
        setIsAuthLoading(false);
        setAuthChecked(true);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [authChecked]);

  const handleAdminToggle = async () => {
    if (isAdmin) {
      // Logging out
      try {
        const { logoutUser } = await import('./firebase');
        await logoutUser();
        console.log('Admin logged out successfully');
        // State will be updated by onAuthStateChanged
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback: manually update state
        setIsAdmin(false);
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
      }
    } else {
      // Redirect to login
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