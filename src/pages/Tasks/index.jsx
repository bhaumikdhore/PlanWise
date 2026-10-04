import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import TaskAIPanel from '../../components/ai/TaskAIPanel';
import { getProjects } from '../../services/projects/projectService';
import { deleteTask as removeTask, getTaskActivity, getTasks, saveTask as persistTask, subscribeToTaskChanges, transitionTaskStatus } from '../../services/tasks/taskService';
import { getCollaboratorProfiles, getWorkspaceOverview } from '../../services/projects/workspaceService';

const categories = ['Work', 'Personal', 'Planning', 'Study'];
const priorities = ['Urgent', 'High', 'Medium', 'Low'];
const taskStatuses = ['todo', 'in_progress', 'completed'];
const taskStatusLabels = { todo: 'To Do', in_progress: 'In Progress', completed: 'Completed', in_review: 'In Review', blocked: 'Blocked', cancelled: 'Cancelled' };
const priorityRank = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDue(task) {
  if (!task.dueDate) return 'No due date';
  const date = new Date(`${task.dueDate}T${task.dueTime || '00:00'}`);
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function TasksPage({ onNavigate, onLogout, session }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activityByTask, setActivityByTask] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scope, setScope] = useState('personal');
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ priority: 'All', status: 'All', category: 'All', dueDate: 'All', assignee: 'All' });
  const [sortBy, setSortBy] = useState('dueDate');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'Medium', dueDate: dateKey(new Date()), dueTime: '09:00', category: 'Work', projectId: '', done: false, assigneeIds: [], reviewerId: '', status: 'todo' });
  const [saving, setSaving] = useState(false);
  const [aiTaskId, setAiTaskId] = useState(null);
  const user = { id: session.user.id, profile: { full_name: session.user.user_metadata?.full_name || '', email: session.user.email || '' } };

  const refresh = async () => {
    const [nextProjects, nextTasks, nextWorkspaces] = await Promise.all([getProjects(user), getTasks(), getWorkspaceOverview()]);
    setProjects(nextProjects.filter((project) => !project.archived));
    setTasks(nextTasks);
    setWorkspaces(nextWorkspaces);
    const profileIds = [
      session.user.id,
      ...nextProjects.flatMap((project) => [project.ownerId, ...(project.memberRoles?.map((member) => member.userId) || project.members || [])]),
      ...nextTasks.flatMap((task) => [...(task.assigneeIds || []), task.reviewerId, task.createdBy].filter(Boolean))
    ];
    setProfiles(await getCollaboratorProfiles(profileIds));
  };

  useEffect(() => {
    let active = true;
    refresh().catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load tasks.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  useEffect(() => {
    let active = true;
    try {
      const unsubscribe = subscribeToTaskChanges(() => {
        refresh().catch((loadError) => {
          if (active) setError(loadError.message || 'Could not refresh task updates.');
        });
      }, (subscriptionError) => {
        if (active) setError(subscriptionError.message);
      });
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (subscriptionError) {
      setError(subscriptionError.message || 'Live task updates are unavailable.');
      return () => { active = false; };
    }
  }, [session.user.id]);

  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get('task');
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    window.requestAnimationFrame(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [tasks]);

  const today = dateKey(new Date());
  const teamProjects = useMemo(() => projects.filter((project) => {
    if (project.ownerId === session.user.id || project.memberRoles?.some((member) => member.userId === session.user.id && member.role !== 'viewer')) return true;
    const membership = workspaces.find((workspace) => workspace.id === project.workspaceId)?.members.find((member) => member.user_id === session.user.id);
    return Boolean(membership && membership.role !== 'viewer');
  }), [projects, workspaces, session.user.id]);
  const categoryOptions = useMemo(() => [...new Set([
    ...categories,
    ...tasks.filter((task) => scope === 'personal' ? !task.projectId : Boolean(task.projectId)).map((task) => task.category).filter(Boolean)
  ])], [tasks, scope]);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (scope === 'personal' ? Boolean(task.projectId) : !task.projectId) return false;
    const assigneeNames = (task.assignees || []).map((assignee) => assignee.full_name || assignee.email || '').join(' ');
    const matchesSearch = `${task.title} ${task.description} ${task.category} ${task.project || ''} ${assigneeNames}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesTab = activeTab === 'All' || (activeTab === 'Completed' && task.done) || (activeTab === 'Today' && task.dueDate === today) || (activeTab === 'Upcoming' && !task.done && task.dueDate > today);
    const matchesPriority = filters.priority === 'All' || task.priority === filters.priority;
    const matchesStatus = filters.status === 'All' || task.status === filters.status;
    const matchesCategory = filters.category === 'All' || task.category === filters.category;
    const matchesDueDate = filters.dueDate === 'All' || (filters.dueDate === 'Today' ? task.dueDate === today : task.dueDate > today);
    const matchesAssignee = filters.assignee === 'All' || task.assigneeIds.includes(filters.assignee);
    return matchesSearch && matchesTab && matchesPriority && matchesStatus && matchesCategory && matchesDueDate && matchesAssignee;
  }).sort((left, right) => {
    if (sortBy === 'priority') return priorityRank[right.priority] - priorityRank[left.priority] || left.title.localeCompare(right.title);
    if (sortBy === 'title') return left.title.localeCompare(right.title);
    if (sortBy === 'newest') return right.createdAt.localeCompare(left.createdAt);
    return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31')
      || (left.dueTime || '').localeCompare(right.dueTime || '');
  }), [tasks, scope, activeTab, search, filters, today, sortBy]);

  const openCreate = () => {
    setError('');
    setSuccess('');
    setEditingId(null);
    setDraft({
      title: '',
      description: '',
      priority: 'Medium',
      dueDate: today,
      dueTime: '09:00',
      category: 'Work',
      projectId: scope === 'team' ? teamProjects[0]?.id || '' : '',
      done: false,
      assigneeIds: scope === 'personal' ? [session.user.id] : [],
      reviewerId: '',
      status: 'todo'
    });
    setModalOpen(true);
  };
  const openEdit = (task) => { setError(''); setSuccess(''); setEditingId(task.id); setDraft({ ...task, assigneeIds: task.projectId ? [...task.assigneeIds] : [session.user.id] }); setModalOpen(true); };
  const updateDraft = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  const saveTask = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError('Enter a task title.');
      return;
    }
    if (draft.projectId && !teamProjects.some((project) => project.id === draft.projectId)) {
      setError('Choose a team project where you can create tasks.');
      return;
    }
    if (scope === 'team' && !draft.projectId) {
      setError('Choose a team project for this task.');
      return;
    }
    const project = projects.find((item) => item.id === draft.projectId);
    const currentTask = editingId ? tasks.find((task) => task.id === editingId) : null;
    const requestedStatus = draft.status || (draft.done ? 'completed' : 'todo');
    if (currentTask?.reviewerId && requestedStatus === 'completed' && currentTask.status !== 'in_review') {
      setError('Submit this task for review before completing it.');
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const savedTask = await persistTask({
        ...draft,
        id: editingId || undefined,
        projectId: scope === 'personal' && !editingId ? '' : draft.projectId,
        assigneeIds: draft.projectId ? draft.assigneeIds : [session.user.id],
        project: project?.name || '',
        title: draft.title.trim(),
        status: currentTask?.status || requestedStatus
      }, user.id);
      if (currentTask && currentTask.status !== requestedStatus) {
        await transitionTaskStatus(savedTask, requestedStatus);
      }
      await refresh();
      setModalOpen(false);
      setSuccess(editingId ? 'Task updated.' : 'Task created.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  };
  const toggleTask = async (task) => {
    setError('');
    try {
      const nextStatus = task.done ? 'todo' : task.reviewerId ? 'in_review' : 'completed';
      if (nextStatus === 'in_review' && !task.reviewerId) throw new Error('Assign a reviewer before submitting this task.');
      await transitionTaskStatus(task, nextStatus);
      await refresh();
      if (nextStatus === 'in_review') setSuccess('Submitted for Review.');
    } catch (updateError) {
      setError(updateError.message || 'Could not update this task.');
    }
  };
  const changeStatus = async (task, status) => {
    setError('');
    setSuccess('');
    try {
      await transitionTaskStatus(task, status);
      await refresh();
      setSuccess(`Task marked ${taskStatusLabels[status] || status}.`);
    } catch (updateError) {
      setError(updateError.message || 'Could not update this task.');
    }
  };

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const membersForProject = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return [{ id: session.user.id, name: 'You', profile: profileMap.get(session.user.id) }];
    const workspace = workspaces.find((item) => item.id === project.workspaceId);
    const people = new Map();
    workspace?.members.forEach((member) => people.set(member.user_id, {
      id: member.user_id,
      name: member.profile?.full_name || member.profile?.email || member.user_id,
      profile: member.profile,
      role: member.role
    }));
    (project.memberRoles || (project.members || []).map((userId) => ({ userId, role: 'member' }))).forEach(({ userId, role }) => {
      const id = userId;
      const profile = profileMap.get(id);
      const current = people.get(id);
      const rolePriority = { viewer: 0, member: 1, admin: 2, owner: 3 };
      if (!current || (rolePriority[role] || 0) > (rolePriority[current.role] || 0)) {
        people.set(id, { id, name: profile?.full_name || profile?.email || id, profile, role });
      }
    });
    if (project.ownerId) {
      const ownerProfile = profileMap.get(project.ownerId);
      people.set(project.ownerId, {
        id: project.ownerId,
        name: ownerProfile?.full_name || ownerProfile?.email || 'Project owner',
        profile: ownerProfile,
        role: 'owner'
      });
    }
    return [...people.values()];
  };
  const canManageProject = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    if (project.ownerId === session.user.id || project.memberRoles?.some((member) => member.userId === session.user.id && ['owner', 'admin'].includes(member.role))) return true;
    const workspaceMember = workspaces.find((item) => item.id === project.workspaceId)?.members.find((member) => member.user_id === session.user.id);
    return ['owner', 'admin'].includes(workspaceMember?.role);
  };
  const loadTaskActivity = async (taskId) => {
    if (activityByTask[taskId]) return;
    try {
      setActivityByTask((current) => ({ ...current, [taskId]: { loading: true, rows: [] } }));
      const rows = await getTaskActivity(taskId);
      setActivityByTask((current) => ({ ...current, [taskId]: { loading: false, rows } }));
    } catch (activityError) {
      setError(activityError.message || 'Could not load task activity.');
      setActivityByTask((current) => ({ ...current, [taskId]: { loading: false, rows: [], error: true } }));
    }
  };
  const reviewTask = async (task, status) => {
    const feedback = status === 'in_progress' ? window.prompt('Add a note explaining the requested changes:') : '';
    if (status === 'in_progress' && feedback === null) return;
    setError('');
    setSuccess('');
    try {
      await transitionTaskStatus(task, status, feedback || '');
      await refresh();
      setSuccess(status === 'completed' ? 'Task approved and completed.' : 'Changes requested. Task returned to In Progress.');
    } catch (reviewError) {
      setError(reviewError.message || 'Could not update the review status.');
    }
  };
  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    setError('');
    try {
      await removeTask(id, session.user.id);
      await refresh();
      setSuccess('Task deleted.');
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this task.');
    }
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} session={session} backgroundVariant="tasks">
      <section className="tasks-page">
        <header className="tasks-page-header">
          <div><span className="panel-kicker">Workspace focus</span><h1>Tasks</h1><p>Keep personal priorities private and coordinate team work in one place.</p></div>
          <Button type="button" variant="primary" disabled={scope === 'team' && !teamProjects.length} onClick={openCreate}>+ Add Task</Button>
        </header>
        {error && <div className="task-notice task-notice-error" role="alert">{error}</div>}
        {success && <div className="task-notice task-notice-success" role="status">{success}</div>}
        <div className="task-scope-tabs" role="tablist" aria-label="Task space">
          <button type="button" role="tab" aria-selected={scope === 'personal'} className={scope === 'personal' ? 'active' : ''} onClick={() => { setScope('personal'); setActiveTab('All'); }}>
            <span>Personal Tasks</span><strong>{tasks.filter((task) => !task.projectId).length}</strong>
          </button>
          <button type="button" role="tab" aria-selected={scope === 'team'} className={scope === 'team' ? 'active' : ''} onClick={() => { setScope('team'); setActiveTab('All'); }}>
            <span>Team Tasks</span><strong>{tasks.filter((task) => task.projectId).length}</strong>
          </button>
        </div>
        <div className="tasks-toolbar">
          <label className="tasks-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${scope === 'personal' ? 'personal' : 'team'} tasks...`} aria-label="Search tasks" /></label>
          <div className="task-tabs" role="tablist" aria-label="Filter tasks by date and completion">{['All', 'Today', 'Upcoming', 'Completed'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
        </div>
        <div className="task-filters">
          <label>Priority<select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option>All</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option>All</option>{categoryOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Assignee<select value={filters.assignee} onChange={(event) => setFilters({ ...filters, assignee: event.target.value })}><option value="All">Everyone</option>{[...new Set(tasks.filter((task) => scope === 'personal' ? !task.projectId : Boolean(task.projectId)).flatMap((task) => task.assigneeIds))].map((id) => <option key={id} value={id}>{id === session.user.id ? 'You' : profileMap.get(id)?.full_name || profileMap.get(id)?.email || 'Teammate'}</option>)}</select></label>
          <label>Due date<select value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })}><option>All</option><option>Today</option><option>Upcoming</option></select></label>
          <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="dueDate">Due date</option><option value="priority">Priority</option><option value="newest">Newest</option><option value="title">Title A–Z</option></select></label>
        </div>
        <div className="tasks-summary"><span>{visibleTasks.length} of {tasks.filter((task) => scope === 'personal' ? !task.projectId : Boolean(task.projectId)).length} task{visibleTasks.length === 1 ? '' : 's'}</span><span>{tasks.filter((task) => (scope === 'personal' ? !task.projectId : Boolean(task.projectId)) && task.done).length} completed</span></div>
        {loading ? <div className="tasks-loading" role="status">Loading your tasks…</div> : scope === 'team' && !teamProjects.length ? <div className="tasks-empty"><strong>No team projects available</strong><span>Join a workspace or project as a contributor to create and manage team tasks.</span><Button type="button" variant="secondary" onClick={() => onNavigate('team')}>Open Team</Button></div> : <section className="tasks-list" aria-live="polite">{visibleTasks.length ? visibleTasks.map((task, index) => {
          const project = projects.find((item) => item.id === task.projectId);
          const manager = canManageProject(task.projectId);
          const reviewer = task.reviewerId === session.user.id;
          const canUpdateTask = manager || task.createdBy === session.user.id || task.assigneeIds.includes(session.user.id);
          const creator = profileMap.get(task.createdBy);
          const taskStatusLabel = taskStatusLabels[task.status] || task.status.replaceAll('_', ' ');
          return <article id={`task-${task.id}`} key={task.id} className={`task-page-card${task.done ? ' is-done' : ''}`} style={{ '--task-delay': `${index * 50}ms` }}>
            <div className="task-page-content">
              <div className="task-page-title-row"><h2>{task.title}</h2><span className={`task-status-badge status-${task.status}`}>{taskStatusLabel}</span><span className={`priority-badge priority-${task.priority.toLowerCase() === 'urgent' || task.priority.toLowerCase() === 'high' ? 'danger' : task.priority.toLowerCase() === 'medium' ? 'amber' : 'green'}`}>{task.priority}</span></div>
              <p>{task.description}</p>
              <div className="task-page-meta"><span>◷ {formatDue(task)}</span><span>▤ {task.category || 'Uncategorized'}</span>{project && <span>◫ {project.name}</span>}</div>
              <div className="task-assignee-list" aria-label="Assigned teammates">
                {(task.assignees || []).map((person) => <span className="task-assignee-chip" key={person.id} title={person.email || person.id}><Avatar initials={initialsFor(profileMap.get(person.id) || person, person.id === session.user.id ? 'You' : person.id)} />{person.id === session.user.id ? 'You' : profileMap.get(person.id)?.full_name || profileMap.get(person.id)?.email || person.id.slice(0, 8)}</span>)}
                <span className="task-creator-chip">Created by {task.createdBy === session.user.id ? 'you' : creator?.full_name || creator?.email || 'a teammate'}</span>
                {task.reviewerId && <span className="task-reviewer-chip">Reviewer: {task.reviewerId === session.user.id ? 'You' : task.reviewer?.full_name || task.reviewer?.email || task.reviewerId.slice(0, 8)}</span>}
              </div>
              <div className="task-workflow-actions">
                <button type="button" aria-expanded={aiTaskId === task.id} onClick={() => setAiTaskId((current) => current === task.id ? null : task.id)}>Ask AI</button>
                {task.status === 'todo' && canUpdateTask && <button type="button" onClick={() => changeStatus(task, 'in_progress')}>Start task</button>}
                {task.status === 'in_progress' && task.reviewerId && canUpdateTask && <button type="button" onClick={() => toggleTask(task)}>Submit for Review</button>}
                {task.status === 'in_progress' && !task.reviewerId && canUpdateTask && <button type="button" onClick={() => toggleTask(task)}>Complete</button>}
                {task.status === 'in_review' && (manager || reviewer) && <>
                  <button type="button" className="task-approve-button" onClick={() => reviewTask(task, 'completed')}>Approve</button>
                  <button type="button" onClick={() => reviewTask(task, 'in_progress')}>Request changes</button>
                </>}
                {task.status === 'in_review' && !(manager || reviewer) && <span className="task-review-waiting">Submitted for Review</span>}
                {task.status === 'blocked' && canUpdateTask && <button type="button" onClick={() => changeStatus(task, 'in_progress')}>Resume work</button>}
                {manager && ['todo', 'in_progress'].includes(task.status) && <button type="button" className="task-block-button" onClick={() => changeStatus(task, 'blocked')}>Mark blocked</button>}
                {task.status === 'completed' && <span className="task-review-waiting">Completed</span>}
                {canUpdateTask && <button type="button" onClick={() => openEdit(task)}>Edit</button>}
                {(manager || task.createdBy === session.user.id) && <button type="button" onClick={() => deleteTask(task.id)} className="delete-task">Delete</button>}
              </div>
              <details className="task-activity-details" onToggle={(event) => { if (event.currentTarget.open) loadTaskActivity(task.id); }}>
                <summary>Task activity</summary>
                {activityByTask[task.id]?.loading ? <span role="status">Loading activity…</span> : activityByTask[task.id]?.error ? <span>Activity could not be loaded.</span> : (activityByTask[task.id]?.rows || []).length ? <ol>{activityByTask[task.id].rows.map((activity) => <li key={activity.id}><strong>{activity.actor?.full_name || activity.actor?.email || 'A teammate'}</strong> {activity.action.replaceAll('_', ' ')} <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString()}</time>{activity.metadata?.review_feedback && <p>{activity.metadata.review_feedback}</p>}</li>)}</ol> : <span>No activity has been recorded yet.</span>}
              </details>
              <TaskAIPanel task={task} active={aiTaskId === task.id} onCreated={refresh} />
            </div>
          </article>;
        }) : <div className="tasks-empty"><strong>{tasks.some((task) => scope === 'personal' ? !task.projectId : Boolean(task.projectId)) ? 'No tasks match these filters.' : `No ${scope} tasks yet`}</strong><span>{tasks.some((task) => scope === 'personal' ? !task.projectId : Boolean(task.projectId)) ? 'Try another filter or search term.' : scope === 'personal' ? 'Create a private task to start planning.' : 'Create a task in a team project to start collaborating.'}</span></div>}</section>}
      </section>
      {modalOpen && <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
        <form className="task-modal" onSubmit={saveTask} role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
          <div className="task-modal-header"><div><span className="panel-kicker">Task details</span><h2 id="task-modal-title">{editingId ? 'Edit Task' : 'Add Task'}</h2></div><button type="button" className="task-modal-close" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close task form">×</button></div>
          <label>Title<input required autoFocus maxLength={160} value={draft.title} onChange={updateDraft('title')} placeholder="What needs to be done?" /></label>
          <label>Description<textarea maxLength={5000} value={draft.description} onChange={updateDraft('description')} placeholder="Add useful context..." rows="3" /></label>
          <div className="task-form-grid">
            <label>Task space<select value={draft.projectId ? 'team' : 'personal'} disabled={Boolean(editingId)} onChange={(event) => { const nextScope = event.target.value; setScope(nextScope); setDraft({ ...draft, projectId: nextScope === 'team' ? teamProjects[0]?.id || '' : '', assigneeIds: nextScope === 'team' ? [] : [session.user.id], reviewerId: '' }); }}><option value="personal">Personal · private to you</option><option value="team" disabled={!teamProjects.length}>Team · shared with project members</option></select></label>
            {draft.projectId && <label>Team project<select required value={draft.projectId} disabled={Boolean(editingId)} onChange={(event) => setDraft({ ...draft, projectId: event.target.value, assigneeIds: [], reviewerId: '' })}>{teamProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
            <label>Priority<select value={draft.priority} onChange={updateDraft('priority')}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={draft.status || (draft.done ? 'completed' : 'todo')} disabled={Boolean(editingId && !taskStatuses.includes(draft.status))} onChange={updateDraft('status')}>{!taskStatuses.includes(draft.status) && <option value={draft.status}>{taskStatusLabels[draft.status] || draft.status}</option>}{taskStatuses.filter((value) => value !== 'completed' || !tasks.find((task) => task.id === editingId)?.reviewerId || tasks.find((task) => task.id === editingId)?.status === 'in_review').map((value) => <option key={value} value={value}>{taskStatusLabels[value]}</option>)}</select>{editingId && !taskStatuses.includes(draft.status) && <small>Use the task workflow buttons to change this status.</small>}</label>
            <label>Category<input value={draft.category || ''} maxLength={80} onChange={updateDraft('category')} placeholder="e.g. Work" /></label>
            <label>Due date<input type="date" value={draft.dueDate || ''} onChange={updateDraft('dueDate')} /></label>
            <label>Due time<input type="time" value={draft.dueTime || ''} onChange={updateDraft('dueTime')} /></label>
            {draft.projectId ? <fieldset className="task-assignee-picker" disabled={!canManageProject(draft.projectId) && editingId !== null && tasks.find((task) => task.id === editingId)?.createdBy !== session.user.id}>
              <legend>Assign to team members</legend>
              <div>{membersForProject(draft.projectId).filter((person) => person.role !== 'viewer').map((person) => <label key={person.id}><input type="checkbox" checked={(draft.assigneeIds || []).includes(person.id)} onChange={(event) => setDraft((current) => ({ ...current, assigneeIds: event.target.checked ? [...new Set([...current.assigneeIds, person.id])] : current.assigneeIds.filter((id) => id !== person.id) }))} />{person.id === session.user.id ? 'You' : person.name}</label>)}</div>
              <small>Only active members of this project or workspace can be assigned.</small>
            </fieldset> : <div className="task-personal-assignee"><strong>Assigned to you</strong><span>Personal tasks are private to your account.</span></div>}
            {draft.projectId && <label>Review by<select value={draft.reviewerId || ''} disabled={!canManageProject(draft.projectId)} onChange={updateDraft('reviewerId')}><option value="">No review required</option>{membersForProject(draft.projectId).filter((person) => ['owner', 'admin'].includes(person.role)).map((person) => <option key={person.id} value={person.id}>{person.id === session.user.id ? 'You' : person.name}</option>)}</select><small>Reviewers need a manager role to approve or request changes.</small></label>}
          </div>
          {error && <div className="task-notice task-notice-error" role="alert">{error}</div>}
          <div className="task-modal-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Task'}</Button></div>
        </form>
      </div>}
    </DashboardLayout>
  );
}
