import React, { useState } from 'react';
import { loginWithEmail } from '../firebase';
import './admin-login.css';

// SVG Icons
const LogoIcon = () => (
  <svg width="40" height="40" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
  </svg>
);

const AdminLoginPage = ({ onLoginSuccess, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Use Firebase authentication
      const user = await loginWithEmail(email, password);
      console.log('Admin login successful:', user.email);
      onLoginSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      
      // User-friendly error messages
      if (err.code === 'auth/user-not-found') {
        setError('Email not found. Contact administrator to create an account.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError('Login failed: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackHome = () => {
    if (onNavigate) {
      onNavigate('home');
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-logo">
              <LogoIcon />
            </div>
            <h1 className="admin-login-title">JeepneyMap Admin</h1>
            <p className="admin-login-subtitle">Administration Portal</p>
          </div>

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="admin-form-group">
              <label className="admin-form-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="admin-form-input"
                required
                disabled={isLoading}
                autoComplete="off"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="admin-form-input"
                required
                disabled={isLoading}
                autoComplete="off"
              />
            </div>

            {error && <div className="admin-error-message">{error}</div>}

            <button 
              type="submit" 
              className="admin-login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="admin-login-footer">
            <p className="admin-footer-text">
              Don't have an account? <br />
              <a href="mailto:admin@jmap.com" className="admin-contact-link">Contact administrator</a>
            </p>
            <button 
              onClick={handleBackHome}
              className="admin-back-button"
              type="button"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        <div className="admin-login-background">
          <div className="admin-bg-decoration"></div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
