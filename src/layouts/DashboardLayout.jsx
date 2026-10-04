import { useCallback, useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import PlanwiseAnimatedBackground from '../components/common/PlanwiseAnimatedBackground';
import { getProfile, isProfileComplete, updateProfilePreferences } from '../services/profiles/profileService';
import { applyThemePreference, getThemePreference, subscribeToThemeChanges } from '../services/preferences/themeService';

export default function DashboardLayout({ children, onNavigate, onLogout, session, backgroundVariant = 'dashboard' }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const userId = session?.user?.id;
  const [themePreference, setThemePreference] = useState(() => getThemePreference(userId));
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;
    getProfile().then((currentProfile) => {
      if (!active) return;
      setProfile(currentProfile);
      setProfileError('');
      const preference = currentProfile.preferences?.theme || getThemePreference(userId);
      setThemePreference(preference);
      applyThemePreference(preference, userId, { persist: true });
    }).catch((error) => {
      if (active) setProfileError(error.message || 'Could not load your profile.');
    });

    const handleProfileUpdate = (event) => {
      setProfile(event.detail);
      setProfileError('');
      if (event.detail.preferences?.theme) setThemePreference(event.detail.preferences.theme);
    };
    window.addEventListener('planwise-profile-updated', handleProfileUpdate);

    return () => {
      active = false;
      window.removeEventListener('planwise-profile-updated', handleProfileUpdate);
    };
  }, [userId]);

  useEffect(() => subscribeToThemeChanges(setThemePreference), []);

  useEffect(() => {
    applyThemePreference(themePreference, userId);
  }, [themePreference, userId]);

  const toggleTheme = useCallback(async () => {
    const nextPreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const previousPreference = profile?.preferences?.theme || getThemePreference(userId);
    setThemePreference(nextPreference);
    applyThemePreference(nextPreference, userId, { persist: true });
    try {
      const updatedProfile = await updateProfilePreferences({ theme: nextPreference });
      setProfile(updatedProfile);
      setProfileError('');
    } catch (error) {
      setThemePreference(previousPreference);
      applyThemePreference(previousPreference, userId, { persist: true });
      setProfileError(`Theme could not be saved: ${error.message || 'Unknown error.'}`);
    }
  }, [profile, userId]);

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
          darkMode={document.documentElement.dataset.theme === 'dark'}
          onToggleTheme={toggleTheme}
          profile={profile}
          profileError={profileError}
          profileIncomplete={profile !== null && !isProfileComplete(profile)}
        />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
