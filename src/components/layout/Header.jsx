import { useState } from 'react';
import Avatar from '../common/Avatar';
import NotificationCenter from './NotificationCenter';

function getInitials(name) {
  return (name || 'U').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function Header({ onToggleSidebar, onNavigate, onLogout, darkMode, onToggleTheme, profile, profileError, profileIncomplete }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const name = profile?.full_name || profile?.email || (profileError ? 'Profile unavailable' : 'Your account');
  const role = profile?.job_title || (profileIncomplete ? 'Complete your profile' : 'Planwise member');

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
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {darkMode ? '☀' : '☾'}
        </button>
        <NotificationCenter
          profileIncomplete={profileIncomplete}
          onCompleteProfile={() => onNavigate('profile')}
          userId={profile?.id}
          onNavigate={onNavigate}
        />

        <div className="profile-menu-wrap">
        <button type="button" className="profile-box" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
          <Avatar initials={getInitials(profile?.full_name || profile?.email)} active />
          <div className="profile-meta">
            <strong>{name}</strong>
            <span>{role}</span>
          </div>
          <span className="profile-chevron">▾</span>
        </button>
        {profileOpen && (
          <div className="profile-dropdown">
            <div className="profile-dropdown-summary"><strong>{name}</strong><span>{role}</span>{profile?.email && <small>{profile.email}</small>}{profileError && <small role="alert">{profileError}</small>}</div>
            <button type="button" onClick={() => { onNavigate('profile'); setProfileOpen(false); }}>👤 My Profile</button>
            <button type="button">⚙ Account Settings</button>
            <button type="button" className="profile-logout" onClick={onLogout}>🚪 Log Out</button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
