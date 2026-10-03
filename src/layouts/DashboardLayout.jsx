import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import PlanwiseAnimatedBackground from '../components/common/PlanwiseAnimatedBackground';
import { getProfile, isProfileComplete } from '../services/profiles/profileService';

export default function DashboardLayout({ children, onNavigate, onLogout, backgroundVariant = 'dashboard' }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('planwise-theme') === 'dark');
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
    localStorage.setItem('planwise-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <div className={`dashboard-shell ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
      <PlanwiseAnimatedBackground variant={backgroundVariant} />
      <Sidebar onNavigate={onNavigate} onLogout={onLogout} />
      <div className="dashboard-main-panel">
        <Header
          onToggleSidebar={() => setMobileSidebarOpen((value) => !value)}
          onNavigate={onNavigate}
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
