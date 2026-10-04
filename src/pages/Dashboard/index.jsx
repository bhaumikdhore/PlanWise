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
import AIAssistant from '../../components/dashboard/AIAssistant';
import MyAIPlan from '../../components/dashboard/MyAIPlan';
import { getProjects } from '../../services/projects/projectService';
import { getTasks, subscribeToTaskChanges, transitionTaskStatus } from '../../services/tasks/taskService';
import { getMeetings } from '../../services/meetings/meetingService';
import { getProjectGoals } from '../../services/goals/projectGoalService';
import { getProfile, isProfileComplete } from '../../services/profiles/profileService';
import { getCollaboratorProfiles, getWorkspaceOverview } from '../../services/projects/workspaceService';
import { createDeadlineNotifications } from '../../services/notifications/notificationService';

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
  const [collaborationWorkspaces, setCollaborationWorkspaces] = useState([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const user = {
    id: session.user.id,
    profile: {
      full_name: profile?.full_name || '',
      email: profile?.email || ''
    }
  };

  const refresh = async () => {
    const nextProfile = await getProfile();
    const nextUser = {
      ...user,
      profile: {
        full_name: nextProfile.full_name || '',
        email: nextProfile.email || ''
      }
    };
    const [nextProjects, nextTasks, nextMeetings, nextGoals, nextWorkspaces] = await Promise.all([
      getProjects(nextUser),
      getTasks(),
      getMeetings(),
      getProjectGoals(),
      getWorkspaceOverview()
    ]);
    const nextCollaboratorProfiles = await getCollaboratorProfiles([
      session.user.id,
      ...nextProjects.flatMap((project) => project.memberRoles?.map((member) => member.userId) || project.members || [])
    ]);
    setProfile(nextProfile);
    setProjects(nextProjects);
    setTasks(nextTasks);
    setMeetings(nextMeetings);
    setGoals(nextGoals);
    setCollaborationWorkspaces(nextWorkspaces);
    setCollaboratorProfiles(nextCollaboratorProfiles);
    await createDeadlineNotifications();
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

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToTaskChanges(() => {
        getTasks().then((nextTasks) => {
          if (active) setTasks(nextTasks);
        }).catch((taskError) => {
          if (active) setError(taskError.message || 'Could not refresh task updates.');
        });
      }, (subscriptionError) => {
        if (active) setError(subscriptionError.message);
      });
    } catch (subscriptionError) {
      setError(subscriptionError.message || 'Live task updates are unavailable.');
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [session.user.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      createDeadlineNotifications().catch((deadlineError) => setError(deadlineError.message || 'Could not check upcoming task deadlines.'));
    }, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [session.user.id]);

  const today = dateKey(new Date());
  const myTasks = useMemo(() => tasks.filter((task) => task.assigneeIds?.includes(session.user.id)
    || (!task.projectId && task.createdBy === session.user.id)), [tasks, session.user.id]);
  const upcomingTasks = useMemo(() => myTasks
    .filter((task) => ['todo', 'in_progress'].includes(task.status))
    .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
    .slice(0, 5)
    .map((task) => ({ ...task, project: projects.find((project) => project.id === task.projectId)?.name || 'Personal', dueTime: formatTime(task.dueTime) })), [myTasks, projects]);
  const now = new Date();
  const meetingsToday = useMemo(() => meetings
    .filter((meeting) => meeting.date === today && new Date(`${meeting.date}T${meeting.startTime}:00`) >= now && !['Cancelled', 'Completed'].includes(meeting.status))
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [meetings, today]);
  const upcomingMeetings = useMemo(() => meetings
    .filter((meeting) => new Date(`${meeting.date}T${meeting.startTime}:00`) >= now && !['Cancelled', 'Completed'].includes(meeting.status))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .slice(0, 3), [meetings, today]);
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
  const primaryWorkspace = collaborationWorkspaces[0];
  const aiCreatableProjects = projects.filter((project) => project.ownerId === session.user.id
    || project.memberRoles?.some((member) => member.userId === session.user.id && member.role !== 'viewer')
    || collaborationWorkspaces.some((workspace) => workspace.id === project.workspaceId
      && workspace.members.some((member) => member.user_id === session.user.id && member.role !== 'viewer')));
  const profileMap = new Map(collaboratorProfiles.map((member) => [member.id, member]));
  const memberMap = new Map([[session.user.id, {
    id: session.user.id,
    name: user.profile.full_name || user.profile.email || 'You',
    initials: (user.profile.full_name || user.profile.email || 'You').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  }]]);
  projects.forEach((project) => (project.memberRoles || (project.members || []).map((userId) => ({ userId }))).forEach(({ userId }) => {
    const member = profileMap.get(userId);
    if (!memberMap.has(userId)) {
      const name = member?.full_name || member?.email || 'Teammate';
      memberMap.set(userId, { id: userId, name, initials: name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'T' });
    }
  }));
  primaryWorkspace?.members.forEach((workspaceMember) => {
    const profile = workspaceMember.profile;
    const name = profile?.full_name || profile?.email || 'Teammate';
    memberMap.set(workspaceMember.user_id, { id: workspaceMember.user_id, name, initials: name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'T' });
  });
  const memberList = [...memberMap.values()].slice(0, 6);
  const pendingTasks = tasks.filter((task) => ['todo', 'in_progress'].includes(task.status));
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const myReviewTasks = myTasks.filter((task) => task.status === 'in_review');
  const activeGoals = goals.filter((goal) => goal.status !== 'Complete');
  const metricCards = [
    { label: 'Tasks Today', value: tasks.filter((task) => task.dueDate === today && ['todo', 'in_progress'].includes(task.status)).length, trend: '', tone: 'blue', description: 'Due today', progress: tasks.length ? Math.round(tasks.filter((task) => task.dueDate === today && task.status === 'completed').length / Math.max(tasks.filter((task) => task.dueDate === today).length, 1) * 100) : 0 },
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
  const meetingItems = upcomingMeetings.map((meeting) => ({
    title: meeting.title,
    time: `${meeting.date === today ? 'Today' : new Date(`${meeting.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`,
    status: meeting.date === today ? 'Today' : 'Soon',
    color: 'purple'
  }));

  const toggleTask = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      const status = task.reviewerId ? 'in_review' : 'completed';
      await transitionTaskStatus(task, status);
      await refresh();
      setSuccess(status === 'in_review' ? 'Submitted for Review.' : 'Task completed.');
    } catch (updateError) {
      setError(updateError.message || 'Could not update this task.');
    }
  };
  const refreshTasksAfterAiCreate = async () => {
    try {
      setTasks(await getTasks());
      setSuccess('Selected AI-planned tasks are ready in your task list.');
    } catch (taskError) {
      setError(taskError.message || 'Tasks were created, but the dashboard could not refresh.');
    }
  };

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  const displayName = user.profile.full_name || user.profile.email || 'there';
  const monthHeading = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} session={session} backgroundVariant="dashboard">
      <section className="dashboard-page">
        {error && <div role="alert">{error}</div>}
        {success && <div role="status">{success}</div>}
        {loading && <div role="status">Refreshing dashboard data…</div>}
        {profile && !isProfileComplete(profile) && <section className="profile-completion-banner" role="status">
          <div><strong>Complete your profile to get started</strong><span>Add your name, job title, and organization to finish setting up your account.</span></div>
          <button type="button" onClick={() => onNavigate('profile')}>Complete profile</button>
        </section>}
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

        {primaryWorkspace && <section className="collaboration-dashboard">
          <div className="collaboration-dashboard-heading">
            <div><span className="panel-kicker">Team overview</span><h2>{primaryWorkspace.name}</h2></div>
            <button type="button" onClick={() => onNavigate('team')}>Open team</button>
          </div>
          <div className="collaboration-dashboard-grid">
            <button type="button" onClick={() => onNavigate('tasks')}><span>My assigned tasks</span><strong>{myTasks.length}</strong></button>
            <button type="button" onClick={() => onNavigate('tasks')}><span>In progress</span><strong>{myTasks.filter((task) => task.status === 'in_progress').length}</strong></button>
            <button type="button" onClick={() => onNavigate('tasks')}><span>Awaiting review</span><strong>{myReviewTasks.length}</strong></button>
            <button type="button" onClick={() => onNavigate('tasks')}><span>Completed</span><strong>{myTasks.filter((task) => task.status === 'completed').length}</strong></button>
            <button type="button" onClick={() => onNavigate('team')}><span>Team members</span><strong>{primaryWorkspace.members.length}</strong></button>
            <button type="button" onClick={() => onNavigate('team')}><span>Overdue tasks</span><strong>{myTasks.filter((task) => task.dueDate && task.dueDate < today && !['completed', 'cancelled'].includes(task.status)).length}</strong></button>
          </div>
        </section>}

        <div className="content-grid analytics-grid">
          <ProjectAnalytics data={analyticsData} goals={goalSummary} />
          <TaskPanel tasks={upcomingTasks} onToggleTask={toggleTask} onViewAll={() => onNavigate('tasks')} />
        </div>

        <div className="content-grid project-grid">
          <div className="main-card-column">
            <CalendarCard days={calendarDays} items={scheduleItems} monthLabel={monthHeading} />
          </div>
          <div className="stacked-panels right-column">
            <RecentProjects projects={projectSummaries.slice(0, 4)} totalCount={projectSummaries.length} />
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
        <MyAIPlan onNavigate={onNavigate} />
        <AIAssistant session={session} projects={aiCreatableProjects} onTasksCreated={refreshTasksAfterAiCreate} />
      </section>
    </DashboardLayout>
  );
}
