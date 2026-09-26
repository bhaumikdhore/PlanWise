import { useState } from 'react';
import Avatar from '../common/Avatar';
import { userProfile } from '../../data/mock/dashboardData';

export default function Header({ onToggleSidebar, onNavigate, onLogout, darkMode, onToggleTheme }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="dashboard-topbar">
      <div className="mobile-only topbar-mobile-menu">
        <button type="button" className="icon-button" onClick={onToggleSidebar} aria-label="Open sidebar">
          ☰
        </button>
      </div>

      <div className="topbar-search">
        <span className="search-icon">⌕</span>
        <input type="text" placeholder="Search projects, tasks, or teammates..." />
        <kbd>Ctrl K</kbd>
      </div>

      <div className="topbar-actions">
        <button type="button" className="icon-button" aria-label="Notifications">🔔</button>
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {darkMode ? '☀' : '☾'}
        </button>

        <div className="profile-menu-wrap">
        <button type="button" className="profile-box" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
          <Avatar initials={userProfile.initials} active />
          <div className="profile-meta">
            <strong>{userProfile.name}</strong>
            <span>{userProfile.role}</span>
          </div>
          <span className="profile-chevron">▾</span>
        </button>
        {profileOpen && (
          <div className="profile-dropdown">
            <div className="profile-dropdown-summary"><strong>{userProfile.name}</strong><span>{userProfile.role}</span><small>bhaumik@example.com</small></div>
            <button type="button" onClick={() => { onNavigate('profile'); setProfileOpen(false); }}>👤 My Profile</button>
            <button type="button">⚙ Account Settings</button>
            <button type="button">🔔 Notifications</button>
            <button type="button" className="profile-logout" onClick={onLogout}>🚪 Log Out</button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
