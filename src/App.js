import React, { useState, useEffect } from 'react';
import JeepneyMap from './Home/home';
import RoutesPage from './Routes/Routes';
import RouteEditor from './RouteEditor/RouteEditor';
import LandmarksPage from './Landmarks/Landmarks';
import AnnouncementsPage from './Announcements/Announcements';
import AboutPage from './About/About';
import AdminLoginPage from './Login/AdminLoginPage';
import ConnectionStatus from './components/ConnectionStatus';
import { auth, isAdminByEmail } from './firebase';
import { AdminProvider } from './contexts/AdminContext';
import './App.css';
import './Home/home.css';
import './Navbar/navbar.css';
import './Routes/routes.css';
import './RouteEditor/route-editor.css';
import './Landmarks/landmarks.css';
import './Announcements/announcements.css';
import './About/about.css';
import Navbar from './Navbar/Navbar';

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    // Check if URL path is /admin-login
    if (window.location.pathname === '/admin-login') {
      return 'admin';
    }
    return 'home';
  });
  const [pageParams, setPageParams] = useState({});
  
  // Initialize isAdmin - will be set after checking Firebase Auth and Firestore
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // On mount: Use onAuthStateChanged to wait for Firebase to restore session, then verify admin status
  useEffect(() => {
    // Subscribe to auth state changes - this waits for Firebase to fully initialize
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (currentUser && currentUser.email) {
          console.log('👤 Firebase Auth session restored:', currentUser.email);
          
          // Verify if this email is in the admins collection
          const isAuthorizedAdmin = await isAdminByEmail(currentUser.email);
          setIsAdmin(isAuthorizedAdmin);
          
          if (isAuthorizedAdmin) {
            console.log('✅ Admin verified via Firestore - user can access admin features');
            // Store for consistency
            localStorage.setItem('jmap_isAdmin', 'true');
            localStorage.setItem('jmap_adminUser', currentUser.email);
          } else {
            console.log('❌ User logged in but not admin - clearing admin state');
            localStorage.removeItem('jmap_isAdmin');
            localStorage.removeItem('jmap_adminUser');
            setIsAdmin(false);
          }
        } else {
          console.log('❌ No Firebase Auth session - user is not logged in');
          localStorage.removeItem('jmap_isAdmin');
          localStorage.removeItem('jmap_adminUser');
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setIsAuthLoading(false);
      }
    });

    // Handle /admin-login URL navigation
    if (window.location.pathname === '/admin-login') {
      setCurrentPage('admin');
    }

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleAdminToggle = async () => {
    if (isAdmin) {
      // Explicit logout with confirmation
      if (window.confirm('Are you sure you want to logout?')) {
        // Clear everything from localStorage (both our keys and backup keys)
        localStorage.removeItem('jmap_isAdmin');
        localStorage.removeItem('jmap_adminUser');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
        setIsAdmin(false);
        setCurrentPage('home');
        console.log('✅ Admin logged out and localStorage cleared');
        
        // Firebase logout
        try {
          const { logoutUser } = await import('./firebase');
          await logoutUser();
        } catch (error) {
          console.log('Firebase logout error (safe to ignore):', error);
        }
      }
    } else {
      // Not admin, go to login
      setCurrentPage('admin');
    }
  };

  const handleLoginSuccess = (user) => {
    // Store with unique keys to avoid conflicts
    localStorage.setItem('jmap_isAdmin', 'true');
    localStorage.setItem('jmap_adminUser', user.email);
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('adminUser', user.email);
    
    setIsAdmin(true);
    setCurrentPage('home');
  };

  const handleNavigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
  };

  const AdminModeIndicator = () => {
    console.log('🔍 AdminModeIndicator render:', { isAdmin, isAdminEditing });
    if (isAdmin && isAdminEditing) {
      return (
        <div className="admin-mode-indicator">
          Admin Mode Active
        </div>
      );
    }
    return null;
  };

  const renderPage = () => {
    const handleRequestLogin = () => setCurrentPage('admin');

    const sharedProps = {
      onNavigate: handleNavigate,
      onRequestLogin: handleRequestLogin,
      onAdminEditingChange: setIsAdminEditing
    };

    switch(currentPage) {
      case 'home':
        return <JeepneyMap {...sharedProps} />;
      case 'routes':
        return <RoutesPage {...sharedProps} />;
      case 'route-editor':
        return <RouteEditor {...sharedProps} routeId={pageParams.routeId} isAdmin={isAdmin} onAdminToggle={handleAdminToggle} />;
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
      <ConnectionStatus />
      <AdminProvider isAdmin={isAdmin} onAdminToggle={handleAdminToggle} isAuthLoading={isAuthLoading}>
        {currentPage !== 'admin' && (
          <Navbar isAdmin={isAdmin} onAdminToggle={handleAdminToggle} onNavigate={handleNavigate} currentPage={currentPage} />
        )}
        {renderPage()}
      </AdminProvider>
      <AdminModeIndicator />
    </div>
  );
}

export default App;