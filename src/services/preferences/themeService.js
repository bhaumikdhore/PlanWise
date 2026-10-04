const themeEventName = 'planwise-theme-changed';

function storageKey(userId) {
  return userId ? `planwise-auth-theme:${userId}` : 'planwise-auth-theme';
}

export function getThemePreference(userId) {
  const userPreference = userId ? localStorage.getItem(storageKey(userId)) : null;
  const legacyPreference = localStorage.getItem('planwise-theme');
  const preference = userPreference || legacyPreference || 'system';
  return ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
}

export function applyThemePreference(preference, userId, { persist = false } = {}) {
  const safePreference = ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
  if (persist) localStorage.setItem(storageKey(userId), safePreference);

  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const resolvedTheme = safePreference === 'system'
    ? systemDark ? 'dark' : 'light'
    : safePreference;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = safePreference;
  window.dispatchEvent(new CustomEvent(themeEventName, { detail: { preference: safePreference } }));
  return safePreference;
}

export function subscribeToThemeChanges(onChange) {
  const handleThemeChange = (event) => onChange(event.detail.preference);
  window.addEventListener(themeEventName, handleThemeChange);

  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (document.documentElement.dataset.themePreference === 'system') {
      applyThemePreference('system');
    }
  };
  mediaQuery?.addEventListener?.('change', handleSystemThemeChange);

  return () => {
    window.removeEventListener(themeEventName, handleThemeChange);
    mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
  };
}
