import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DashboardPage from './pages/Dashboard';
import ProfilePage from './pages/Profile';
import FeaturesPage from './pages/Features';
import SolutionsPage from './pages/Solutions';
import AboutPage from './pages/About';
import TasksPage from './pages/Tasks';
import AnalyticsPage from './pages/Analytics';
import ProjectsPage from './pages/Projects';
const CalendarPage = lazy(() => import('./pages/Calendar'));
const MeetingsPage = lazy(() => import('./pages/Meetings'));
import { supabase } from './lib/supabaseClient';
import { signOut } from './services/auth/authService';

const views = {
  home: 'home',
  login: 'login',
  register: 'register',
  dashboard: 'dashboard',
  profile: 'profile',
  features: 'features',
  solutions: 'solutions',
  about: 'about',
  tasks: 'tasks',
  calendar: 'calendar',
  meetings: 'meetings',
  analytics: 'analytics',
  projects: 'projects'
};

const pathViews = {
  '/': views.home,
  '/home': views.home,
  '/login': views.login,
  '/register': views.register,
  '/dashboard': views.dashboard,
  '/profile': views.profile,
  '/features': views.features,
  '/solutions': views.solutions,
  '/about': views.about,
  '/tasks': views.tasks,
  '/calendar': views.calendar,
  '/meetings': views.meetings,
  '/analytics': views.analytics,
  '/projects': views.projects
};

const routeForPath = (path) => pathViews[path] || (path.startsWith('/projects/') ? views.projects : views.dashboard);

export default function App() {
  const [locationPath, setLocationPath] = useState(() => window.location.pathname);
  const [activeView, setActiveView] = useState(() => routeForPath(window.location.pathname));
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const navigate = useCallback((view, replace = false) => {
    const path = view.startsWith('projects/') ? `/${view}` : view === views.dashboard ? '/dashboard' : view === views.home ? '/' : `/${view}`;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    setLocationPath(path);
    setActiveView(routeForPath(path));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setLocationPath(window.location.pathname);
      setActiveView(routeForPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setSession(null);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const currentPath = window.location.pathname;
    const currentRoute = routeForPath(currentPath);
    const protectedRoute = [views.dashboard, views.profile, views.tasks, views.analytics, views.projects, views.calendar, views.meetings].includes(currentRoute);
    const publicRoute = [views.home, views.login, views.register].includes(currentRoute);

    const confirmedSession = session?.user?.email_confirmed_at ? session : null;

    if (!confirmedSession && protectedRoute) navigate('login', true);
    if (confirmedSession && publicRoute) navigate('dashboard', true);
  }, [authLoading, navigate, session]);

  const logout = useCallback(async () => {
    await signOut();
    navigate('login', true);
  }, [navigate]);

  const currentView = useMemo(() => {
    if (activeView === views.login) return <LoginPage onNavigate={navigate} />;
    if (activeView === views.register) return <RegisterPage onNavigate={navigate} />;
    if (activeView === views.dashboard) return <DashboardPage onNavigate={navigate} onLogout={logout} session={session} />;
    if (activeView === views.profile) return <ProfilePage onNavigate={navigate} onLogout={logout} session={session} />;
    if (activeView === views.features) return <FeaturesPage onNavigate={navigate} />;
    if (activeView === views.solutions) return <SolutionsPage onNavigate={navigate} />;
    if (activeView === views.about) return <AboutPage onNavigate={navigate} />;
    if (activeView === views.tasks) return <TasksPage onNavigate={navigate} onLogout={logout} session={session} />;
    if (activeView === views.calendar) return <Suspense fallback={<main className="calendar-loading" role="status">Loading calendar…</main>}><CalendarPage onNavigate={navigate} onLogout={logout} session={session} /></Suspense>;
    if (activeView === views.meetings) return <Suspense fallback={<main className="calendar-loading" role="status">Loading meetings…</main>}><MeetingsPage onNavigate={navigate} onLogout={logout} session={session} /></Suspense>;
    if (activeView === views.analytics) return <AnalyticsPage onNavigate={navigate} onLogout={logout} session={session} />;
    if (activeView === views.projects) return <ProjectsPage onNavigate={navigate} onLogout={logout} session={session} locationPath={locationPath} />;
    if (activeView === views.home) return <HomePage onNavigate={navigate} />;
    return <DashboardPage onNavigate={navigate} />;
  }, [activeView, locationPath]);

  if (authLoading) return null;

  return currentView;
}
