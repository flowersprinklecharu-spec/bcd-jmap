import React, { useState } from 'react';
import { useAdminKeyboardShortcut } from '../hooks/useAdminKeyboardShortcut';

// SVG Icons
const MapPinIcon = () => (
  <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

const AdminIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
  </svg>
);

const Navbar = ({ isAdmin, onAdminToggle, onNavigate, currentPage }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showAdminButton = useAdminKeyboardShortcut();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      // If already admin, show logout confirmation
      if (window.confirm('Are you sure you want to logout?')) {
        if (onAdminToggle) {
          onAdminToggle();
        }
      }
    } else {
      // Navigate to admin login page
      if (onNavigate) {
        onNavigate('admin');
      }
    }
  };

  const handleNavClick = (page) => {
    if (onNavigate) {
      onNavigate(page);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          {/* Logo */}
          <button 
            onClick={() => handleNavClick('home')}
            className="navbar-logo"
          >
            <MapPinIcon />
            <h1 className="navbar-brand">JeepneyMap</h1>
          </button>

          {/* Desktop Navigation */}
          <nav className="navbar-nav">
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}
            >
              Home
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'routes' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('routes'); }}
            >
              Routes
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'landmarks' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('landmarks'); }}
            >
              Landmarks
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'announcements' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('announcements'); }}
            >
              Announcements
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}
            >
              About
            </a>
          </nav>

          {/* Admin Icon Button - Only visible if showAdminButton is true or user is admin */}
          {(showAdminButton || isAdmin) && (
            <button 
              className={`navbar-admin-btn ${isAdmin ? 'active' : ''}`}
              onClick={handleAdminClick}
              title={isAdmin ? 'Logout (Admin)' : 'Admin Login'}
            >
              <AdminIcon />
              {isAdmin && <span className="admin-label">Logout</span>}
            </button>
          )}

          {/* Mobile Menu Button */}
          <button 
            className="navbar-mobile-menu-btn"
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="navbar-mobile-menu">
            <a 
              href="#" 
              className={`mobile-nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}
            >
              Home
            </a>
            <a 
              href="#" 
              className={`mobile-nav-link ${currentPage === 'routes' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('routes'); }}
            >
              Routes
            </a>
            <a 
              href="#" 
              className={`mobile-nav-link ${currentPage === 'landmarks' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('landmarks'); }}
            >
              Landmarks
            </a>
            <a 
              href="#" 
              className={`mobile-nav-link ${currentPage === 'announcements' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('announcements'); }}
            >
              Announcements
            </a>
            <a 
              href="#" 
              className={`mobile-nav-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}
            >
              About
            </a>
          </div>
        )}
      </div>



      {/* Admin Badge */}
      {isAdmin && (
        <div className="navbar-admin-badge">
          Admin Mode Active
        </div>
      )}
    </header>
  );
};

export default Navbar;