import React, { useState } from 'react';
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
  const [isAdmin, setIsAdmin] = useState(false); // Shared admin state

  const handleAdminToggle = () => {
    setIsAdmin(!isAdmin);
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    setCurrentPage('home');
  };

  const handleNavigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
  };

  const renderPage = () => {
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