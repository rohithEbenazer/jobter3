import React from 'react';
import './Navbar.css';

const Navbar = ({ role, onSwitchRole }) => {
  return (
    <header className="navbar">
      <div className="container nav-container">
        <div className="logo-group">
          <div className="logo-icon">⚡</div>
          <div className="logo-text">
            <span className="logo-title">CogForce</span>
            <span className="logo-tag">Jobs & Sync Engine</span>
          </div>
        </div>

        {/* Role Switcher */}
        <div className="role-switcher-card">
          <span className="role-label">Role:</span>
          <div className="role-toggle">
            <button
              className={`role-btn ${role === 'super_admin' ? 'active' : ''}`}
              onClick={() => onSwitchRole('super_admin')}
            >
              <span className="role-icon">🛡️</span> Super Admin
            </button>
            <button
              className={`role-btn ${role === 'user' ? 'active' : ''}`}
              onClick={() => onSwitchRole('user')}
            >
              <span className="role-icon">👤</span> Normal User
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
