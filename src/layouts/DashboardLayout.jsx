import { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import PlanwiseAnimatedBackground from '../components/common/PlanwiseAnimatedBackground';

export default function DashboardLayout({ children, onNavigate, onLogout, backgroundVariant = 'dashboard' }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('planwise-theme') === 'dark');

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
        />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
