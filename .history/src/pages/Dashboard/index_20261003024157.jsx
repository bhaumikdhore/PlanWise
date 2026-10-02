import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import MetricCard from '../../components/dashboard/MetricCard';
import ProjectAnalytics from '../../components/dashboard/ProjectAnalytics';
import TaskPanel from '../../components/dashboard/TaskPanel';
import CalendarCard from '../../components/dashboard/CalendarCard';
import RecentProjects from '../../components/dashboard/RecentProjects';
import TeamMembers from '../../components/dashboard/TeamMembers';
import UpcomingMeetings from '../../components/dashboard/UpcomingMeetings';
import QuickActions from '../../components/dashboard/QuickActions';
import { getProjects } from '../../services/projects/projectService';
import { getTasks, updateTaskStatus } from '../../services/tasks/taskService';
import { getMeetings } from '../../services/meetings/meetingService';
import { getProjectGoals } from '../../services/goals/projectGoalService';

const quickActions = [
  { label: 'Add Task', icon: '✓' },
  { label: 'Add Event', icon: '◫' },
  { label: 'Create Goal', icon: '◎' }
];

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2020, 0, 1, hour, minute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DashboardPage({ onNavigate, onLogout, session }) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = {
    id: session.user.id,
    profile: {
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      email: session.user.email || ''
    }
  };

  const refresh = async () => {
    const [nextProjects, nextTasks, nextMeetings, nextGoals] = await Promise.all([
      getProjects(user),
      getTasks(),
      getMeetings(),
      getProjectGoals()
    ]);
    setProjects(nextProjects);
    setTasks(nextTasks);
    setMeetings(nextMeetings);
    setGoals(nextGoals);
    setError('');
  };

  useEffect(() => {
    let active = true;
    refresh().catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load your dashboard.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  const today = dateKey(new Date());
  const upcomingTasks = useMemo(() => tasks
    .filter((task) => ['todo', 'in_progress'].includes(task.status))
    .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
    .slice(0, 5), [tasks]);
  const meetingsToday = useMemo(() => meetings
    .filter((meeting) => meeting.date === today && !['Cancelled', 'Completed'].includes(meeting.status))
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [meetings, today]);
  const projectSummaries = useMemo(() => projects.filter((project) => !project.archived).map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const completed = projectTasks.filter((task) => task.status === 'completed').length;
    return {
      ...project,
      tasksLeft: projectTasks.filter((task) => ['todo', 'in_progress'].includes(task.status)).length,
      completion: projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0,
      color: project.status === 'Completed' ? 'green' : project.status === 'On Hold' ? 'amber' : project.status === 'Planning' ? 'purple' : 'blue'
    };
  }), [projects, tasks]);
  const calendarDays = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return { day: date.toLocaleDateString('en-US', { weekday: 'short' }), date: date.getDate(), muted: date.getMonth() !== monthStart.getMonth(), selected: dateKey(date) === today };
    });
  }, [today]);
  const scheduleItems = meetingsToday.slice(0, 4).map((meeting) => ({
    time: `${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`,
    title: meeting.title,
    tone: 'purple'
  }));
  const memberMap = new Map([[session.user.id, {
    name: user.profile.full_name || user.profile.email || 'You',
    initials: (user.profile.full_name || user.profile.email || 'You').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  }]]);
  projects.forEach((project) => project.members.forEach((id) => {
    if (!memberMap.has(id)) memberMap.set(id, { name: id.slice(0, 8), initials: id.slice(0, 2).toUpperCase() });
  }));
  const memberList = [...memberMap.values()].slice(0, 6);
  const pendingTasks = tasks.filter((task) => ['todo', 'in_progress'].includes(task.status));
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const activeGoals = goals.filter((goal) => goal.status !== 'Complete');
  const metricCards = [
    { label: 'Tasks Today', value: tasks.filter((task) => task.dueDate === today && task.status !== 'completed').length, trend: '', tone: 'blue', description: 'Due today', progress: tasks.length ? Math.round(tasks.filter((task) => task.dueDate === today && task.status === 'completed').length / Math.max(tasks.filter((task) => task.dueDate === today).length, 1) * 100) : 0 },
    { label: 'Completed Tasks', value: completedTasks.length, trend: '', tone: 'green', description: 'Across accessible projects', progress: tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0 },
    { label: 'Pending Tasks', value: pendingTasks.length, trend: '', tone: 'purple', description: 'To do or in progress', progress: tasks.length ? Math.round(pendingTasks.length / tasks.length * 100) : 0 },
    { label: 'Active Goals', value: activeGoals.length, trend: '', tone: 'amber', description: 'Not yet complete', progress: goals.length ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length) : 0 }
  ];
  const analyticsData = projectSummaries.slice(0, 8).map((project) => ({ label: project.name.length > 8 ? `${project.name.slice(0, 7)}…` : project.name, value: project.completion }));
  const goalSummary = {
    onTrack: goals.filter((goal) => goal.status === 'On track').length,
    inProgress: goals.filter((goal) => goal.status === 'In progress').length,
    complete: goals.filter((goal) => goal.status === 'Complete').length
  };
  const meetingItems = meetingsToday.slice(0, 3).map((meeting) => ({
    title: meeting.title,
    time: `${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`,
    status: 'Today',
    color: 'purple'
  }));

  const toggleTask = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      await updateTaskStatus(task, true, session.user.id);
      await refresh();
    } catch (updateError) {
      setError(updateError.message || 'Could not update this task.');
    }
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  const displayName = user.profile.full_name || user.profile.email || 'there';
  const monthHeading = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="dashboard">
      <section className="dashboard-page">
        {error && <div role="alert">{error}</div>}
        {loading && <div role="status">Refreshing dashboard data…</div>}
        <div className="page-banner">
          <div className="page-banner-copy">
            <h1>{greeting}, {displayName.split(' ')[0]}!</h1>
            <p>Here&apos;s what&apos;s happening with your projects today.</p>
          </div>

          <div className="dashboard-date-wrap">
            <strong>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
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
          <ProjectAnalytics data={analyticsData} goals={goalSummary} />
          <TaskPanel tasks={upcomingTasks} onToggleTask={toggleTask} />
        </div>

        <div className="content-grid project-grid">
          <div className="main-card-column">
            <CalendarCard days={calendarDays} items={scheduleItems} monthLabel={monthHeading} />
          </div>
          <div className="stacked-panels right-column">
            <RecentProjects projects={projectSummaries.slice(0, 4)} />
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
