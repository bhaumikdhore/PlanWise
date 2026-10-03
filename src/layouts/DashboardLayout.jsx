import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import PlanwiseAnimatedBackground from '../components/common/PlanwiseAnimatedBackground';
import { getProfile, isProfileComplete } from '../services/profiles/profileService';

export default function DashboardLayout({ children, onNavigate, onLogout, session, backgroundVariant = 'dashboard' }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const themeKey = session?.user?.id ? `planwise-auth-theme:${session.user.id}` : 'planwise-auth-theme';
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(themeKey) === 'dark');
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;
    getProfile().then((currentProfile) => {
      if (!active) return;
      setProfile(currentProfile);
      setProfileError('');
    }).catch((error) => {
      if (active) setProfileError(error.message || 'Could not load your profile.');
    });

    const handleProfileUpdate = (event) => {
      setProfile(event.detail);
      setProfileError('');
    };
    window.addEventListener('planwise-profile-updated', handleProfileUpdate);

    return () => {
      active = false;
      window.removeEventListener('planwise-profile-updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem(themeKey, darkMode ? 'dark' : 'light');
  }, [darkMode, themeKey]);

  useEffect(() => {
    setDarkMode(localStorage.getItem(themeKey) === 'dark');
  }, [themeKey]);

  const navigate = (view) => {
    setMobileSidebarOpen(false);
    onNavigate(view);
  };

  return (
    <div className={`dashboard-shell ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
      <PlanwiseAnimatedBackground variant={backgroundVariant} />
      <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} />
      <Sidebar onNavigate={navigate} onLogout={onLogout} />
      <div className="dashboard-main-panel">
        <Header
          onToggleSidebar={() => setMobileSidebarOpen((value) => !value)}
          onNavigate={navigate}
          onLogout={onLogout}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((value) => !value)}
          profile={profile}
          profileError={profileError}
          profileIncomplete={profile !== null && !isProfileComplete(profile)}
        />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
