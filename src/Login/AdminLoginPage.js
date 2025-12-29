import React, { useState } from 'react';
import { loginWithEmail } from '../firebase';
import './admin-login.css';

const AdminLoginPage = ({ onLoginSuccess, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await loginWithEmail(email, password);
      console.log('Admin login successful:', user.email);
      onLoginSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      
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

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-card">
          <h1 className="admin-login-title">Admin Login</h1>
          <p className="admin-login-subtitle">JeepneyMap Administration</p>

          <form onSubmit={handleLogin} className="admin-login-form">
            {error && (
              <div className="admin-error-message">
                <span>❌ {error}</span>
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label">Email</label>
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
              <div className="admin-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="admin-form-input"
                  required
                  disabled={isLoading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="admin-login-info">
            <p>Contact your administrator for login credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
