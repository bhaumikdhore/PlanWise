import { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import MetricCard from '../../components/dashboard/MetricCard';
import ProjectAnalytics from '../../components/dashboard/ProjectAnalytics';
import TaskPanel from '../../components/dashboard/TaskPanel';
import CalendarCard from '../../components/dashboard/CalendarCard';
import RecentProjects from '../../components/dashboard/RecentProjects';
import TeamMembers from '../../components/dashboard/TeamMembers';
import UpcomingMeetings from '../../components/dashboard/UpcomingMeetings';
import QuickActions from '../../components/dashboard/QuickActions';
import {
  metricCards,
  analyticsData,
  taskItems,
  calendarDays,
  scheduleItems,
  projectList,
  teamMembers as memberList,
  meetingItems,
  quickActions,
  userProfile
} from '../../data/mock/dashboardData';

export default function DashboardPage({ onNavigate, onLogout }) {
  const [todayTasks, setTodayTasks] = useState(taskItems);

  const toggleTask = (taskId) => {
    setTodayTasks((current) => current.map((task) => task.id === taskId ? { ...task, done: !task.done } : task));
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="dashboard">
      <section className="dashboard-page">
        <div className="page-banner">
          <div className="page-banner-copy">
            <h1>Good Morning, {userProfile.name.split(' ')[0]}! 👋</h1>
            <p>Here&apos;s what&apos;s happening with your projects today.</p>
          </div>

          <div className="dashboard-date-wrap">
            <strong>Monday, 25 Aug 2026</strong>
            <span>Stay focused and keep building!</span>
            <button type="button" className="primary-inline-button">+ New Project</button>
          </div>
        </div>

        <div className="metric-grid">
          {metricCards.map((card) => (
            <MetricCard
              key={card.label}
              icon={card.label === 'Tasks Today' ? '✓' : card.label === 'Completed Tasks' ? '▣' : card.label === 'Pending Tasks' ? '◷' : '◎'}
              label={card.label}
              value={card.value}
              trend={card.trend}
              tone={card.tone}
              description={card.description}
              progress={card.progress}
            />
          ))}
        </div>

        <div className="content-grid analytics-grid">
          <ProjectAnalytics data={analyticsData} />
          <TaskPanel tasks={todayTasks} onToggleTask={toggleTask} />
        </div>

        <div className="content-grid project-grid">
          <div className="main-card-column">
            <CalendarCard days={calendarDays} items={scheduleItems} />
          </div>
          <div className="stacked-panels right-column">
            <RecentProjects projects={projectList} />
          </div>
        </div>

        <div className="bottom-grid">
          <div className="bottom-grid-panel">
            <TeamMembers members={memberList} />
          </div>
          <div className="bottom-grid-panel">
            <UpcomingMeetings meetings={meetingItems} />
          </div>
          <div className="bottom-grid-panel">
            <QuickActions actions={quickActions} />
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
