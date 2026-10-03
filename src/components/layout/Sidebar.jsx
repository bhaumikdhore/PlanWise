import { useState } from 'react';
import { sidebarItems } from '../../data/mock/dashboardData';

export default function Sidebar({ onNavigate, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = window.location.pathname;
  const routes = { Dashboard: 'dashboard', Projects: 'projects', Tasks: 'tasks', Calendar: 'calendar', Meetings: 'meetings', Team: 'team', Analytics: 'analytics' };

  return (
    <aside className={`dashboard-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div>
        <div className="sidebar-header">
          <button type="button" className="brand brand-sidebar" onClick={() => onNavigate('home')} aria-label="Go to Planwise home">
            <span className="brand-mark-small">P</span>
            {!collapsed && <span>Planwise</span>}
          </button>
          <button className="sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar">
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          {sidebarItems.map((item) => (
            <button key={item.label} type="button" className={`sidebar-item ${routes[item.label] && (currentPath === `/${routes[item.label]}` || (routes[item.label] === 'projects' && currentPath.startsWith('/projects/'))) ? 'active' : item.active && !['/tasks', '/analytics', '/calendar', '/meetings'].includes(currentPath) && !currentPath.startsWith('/projects') ? 'active' : ''}`} onClick={() => routes[item.label] && onNavigate(routes[item.label])}>
              <span className="sidebar-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-meta">
            <button type="button" className="meta-link">Settings</button>
            <button type="button" className="meta-link">Help &amp; Support</button>
            <button type="button" className="meta-link logout-link" onClick={onLogout}>Logout</button>
          </div>
        )}
      </div>
    </aside>
  );
}
