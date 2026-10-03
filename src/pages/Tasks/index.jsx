import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getProjects } from '../../services/projects/projectService';
import { deleteTask as removeTask, getTaskActivity, getTasks, saveTask as persistTask, transitionTaskStatus } from '../../services/tasks/taskService';
import { getCollaboratorProfiles, getWorkspaceOverview } from '../../services/projects/workspaceService';

const today = new Date().toISOString().slice(0, 10);
const categories = ['Work', 'Personal', 'Planning', 'Study'];
const priorities = ['High', 'Medium', 'Low'];
const blankTask = { title: '', description: '', priority: 'Medium', dueDate: today, dueTime: '09:00', category: 'Work', projectId: '', done: false, assigneeIds: [], reviewerId: '' };

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
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ priority: 'All', status: 'All', category: 'All', dueDate: 'All' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(blankTask);
  const user = { id: session.user.id, profile: { full_name: session.user.user_metadata?.full_name || '', email: session.user.email || '' } };

  const refresh = async () => {
    const [nextProjects, nextTasks, nextWorkspaces] = await Promise.all([getProjects(user), getTasks(), getWorkspaceOverview()]);
    setProjects(nextProjects.filter((project) => !project.archived));
    setTasks(nextTasks);
    setWorkspaces(nextWorkspaces);
    const profileIds = [
      session.user.id,
      ...nextProjects.flatMap((project) => project.memberRoles?.map((member) => member.userId) || project.members || []),
      ...nextTasks.flatMap((task) => [...(task.assigneeIds || []), task.reviewerId].filter(Boolean))
    ];
    setProfiles(await getCollaboratorProfiles(profileIds));
  };

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(user), getTasks(), getWorkspaceOverview()]).then(async ([nextProjects, nextTasks, nextWorkspaces]) => {
      if (!active) return;
      setProjects(nextProjects.filter((project) => !project.archived));
      setTasks(nextTasks);
      setWorkspaces(nextWorkspaces);
      const profileIds = [
        session.user.id,
        ...nextProjects.flatMap((project) => project.memberRoles?.map((member) => member.userId) || project.members || []),
        ...nextTasks.flatMap((task) => [...(task.assigneeIds || []), task.reviewerId].filter(Boolean))
      ];
      const nextProfiles = await getCollaboratorProfiles(profileIds);
      if (active) setProfiles(nextProfiles);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load tasks.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get('task');
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    window.requestAnimationFrame(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [tasks]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description} ${task.category} ${task.project || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || (activeTab === 'Completed' && task.done) || (activeTab === 'Today' && task.dueDate === today) || (activeTab === 'Upcoming' && !task.done && task.dueDate > today);
    const matchesPriority = filters.priority === 'All' || task.priority === filters.priority;
    const matchesStatus = filters.status === 'All' || task.status === filters.status;
    const matchesCategory = filters.category === 'All' || task.category === filters.category;
    const matchesDueDate = filters.dueDate === 'All' || (filters.dueDate === 'Today' ? task.dueDate === today : task.dueDate > today);
    return matchesSearch && matchesTab && matchesPriority && matchesStatus && matchesCategory && matchesDueDate;
  }), [tasks, activeTab, search, filters]);

  const openCreate = () => { setEditingId(null); setDraft({ ...blankTask }); setModalOpen(true); };
  const openEdit = (task) => { setEditingId(task.id); setDraft({ ...task }); setModalOpen(true); };
  const updateDraft = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  const saveTask = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const project = projects.find((item) => item.id === draft.projectId);
    setError('');
    setSuccess('');
    try {
      await persistTask({ ...draft, id: editingId || undefined, project: project?.name || '', title: draft.title.trim() }, user.id);
      await refresh();
      setModalOpen(false);
      setSuccess(editingId ? 'Task updated.' : 'Task created.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save this task.');
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
        <header className="tasks-page-header"><div><span className="panel-kicker">Workspace focus</span><h1>My Tasks</h1><p>Plan the next action, keep priorities visible, and make steady progress.</p></div><Button type="button" variant="primary" onClick={openCreate}>+ Add Task</Button></header>
        {error && <div role="alert">{error}</div>}{success && <div role="status">{success}</div>}
        <div className="tasks-toolbar"><label className="tasks-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" /></label><div className="task-tabs" role="tablist" aria-label="Task views">{['All', 'Today', 'Upcoming', 'Completed'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
        <div className="task-filters"><label>Priority<select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option>All</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option>{['todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option>All</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<select value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })}><option>All</option><option>Today</option><option>Upcoming</option></select></label></div>
        <div className="tasks-summary"><span>{visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} shown</span><span>{tasks.filter((task) => task.done).length} completed</span></div>
        {loading ? <div className="tasks-loading" role="status">Loading tasks…</div> : <section className="tasks-list" aria-live="polite">{visibleTasks.length ? visibleTasks.map((task, index) => {
          const project = projects.find((item) => item.id === task.projectId);
          const manager = canManageProject(task.projectId);
          const reviewer = task.reviewerId === session.user.id;
          const canUpdateTask = manager || task.createdBy === session.user.id || task.assigneeIds.includes(session.user.id);
          const people = membersForProject(task.projectId);
          const taskStatusLabel = task.status.replaceAll('_', ' ');
          return <article id={`task-${task.id}`} key={task.id} className={`task-page-card${task.done ? ' is-done' : ''}`} style={{ '--task-delay': `${index * 50}ms` }}>
            <div className="task-page-content">
              <div className="task-page-title-row"><h2>{task.title}</h2><span className={`task-status-badge status-${task.status}`}>{taskStatusLabel}</span><span className={`priority-badge priority-${task.priority.toLowerCase() === 'high' ? 'danger' : task.priority.toLowerCase() === 'medium' ? 'amber' : 'green'}`}>{task.priority}</span></div>
              <p>{task.description}</p>
              <div className="task-page-meta"><span>◷ {formatDue(task)}</span><span>▤ {task.category}</span>{project && <span>◫ {project.name}</span>}</div>
              <div className="task-assignee-list" aria-label="Assigned teammates">
                {(task.assignees || []).map((person) => <span className="task-assignee-chip" key={person.id} title={person.email || person.id}><Avatar initials={initialsFor(profileMap.get(person.id) || person, person.id === session.user.id ? 'You' : person.id)} />{person.id === session.user.id ? 'You' : profileMap.get(person.id)?.full_name || profileMap.get(person.id)?.email || person.id.slice(0, 8)}</span>)}
                {task.reviewerId && <span className="task-reviewer-chip">Reviewer: {task.reviewerId === session.user.id ? 'You' : task.reviewer?.full_name || task.reviewer?.email || task.reviewerId.slice(0, 8)}</span>}
              </div>
              <div className="task-workflow-actions">
                {task.status === 'todo' && canUpdateTask && <button type="button" onClick={() => transitionTaskStatus(task, 'in_progress').then(refresh).catch((e) => setError(e.message))}>Start task</button>}
                {task.status === 'in_progress' && task.reviewerId && canUpdateTask && <button type="button" onClick={() => toggleTask(task)}>Submit for Review</button>}
                {task.status === 'in_progress' && !task.reviewerId && canUpdateTask && <button type="button" onClick={() => toggleTask(task)}>Complete</button>}
                {task.status === 'in_review' && (manager || reviewer) && <>
                  <button type="button" className="task-approve-button" onClick={() => reviewTask(task, 'completed')}>Approve</button>
                  <button type="button" onClick={() => reviewTask(task, 'in_progress')}>Request changes</button>
                </>}
                {task.status === 'in_review' && !(manager || reviewer) && <span className="task-review-waiting">Submitted for Review</span>}
                {task.status === 'blocked' && canUpdateTask && <button type="button" onClick={() => transitionTaskStatus(task, 'in_progress').then(refresh).catch((e) => setError(e.message))}>Resume work</button>}
                {manager && ['todo', 'in_progress'].includes(task.status) && <button type="button" className="task-block-button" onClick={() => transitionTaskStatus(task, 'blocked').then(refresh).catch((e) => setError(e.message))}>Mark blocked</button>}
                {task.status === 'completed' && <span className="task-review-waiting">Completed</span>}
                {canUpdateTask && <button type="button" onClick={() => openEdit(task)}>Edit</button>}
                {(manager || (!task.projectId && task.createdBy === session.user.id)) && <button type="button" onClick={() => deleteTask(task.id)} className="delete-task">Delete</button>}
              </div>
              <details className="task-activity-details" onToggle={(event) => { if (event.currentTarget.open) loadTaskActivity(task.id); }}>
                <summary>Task activity</summary>
                {activityByTask[task.id]?.loading ? <span role="status">Loading activity…</span> : activityByTask[task.id]?.error ? <span>Activity could not be loaded.</span> : (activityByTask[task.id]?.rows || []).length ? <ol>{activityByTask[task.id].rows.map((activity) => <li key={activity.id}><strong>{activity.actor?.full_name || activity.actor?.email || 'A teammate'}</strong> {activity.action.replaceAll('_', ' ')} <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString()}</time>{activity.metadata?.review_feedback && <p>{activity.metadata.review_feedback}</p>}</li>)}</ol> : <span>No activity has been recorded yet.</span>}
              </details>
            </div>
          </article>;
        }) : <div className="tasks-empty"><strong>{tasks.length ? 'No tasks match these filters.' : 'No tasks yet'}</strong><span>{tasks.length ? 'Try another view or add a new task.' : 'Create a task to start planning. Existing browser-only tasks remain saved locally and are not imported automatically.'}</span></div>}</section>}
      </section>
      {modalOpen && <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><form className="task-modal" onSubmit={saveTask} role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="task-modal-header"><div><span className="panel-kicker">Task details</span><h2 id="task-modal-title">{editingId ? 'Edit Task' : 'Add Task'}</h2></div><button type="button" className="task-modal-close" onClick={() => setModalOpen(false)} aria-label="Close task form">×</button></div><label>Title<input required autoFocus value={draft.title} onChange={updateDraft('title')} placeholder="What needs to be done?" /></label><label>Description<textarea value={draft.description} onChange={updateDraft('description')} placeholder="Add useful context..." rows="3" /></label><div className="task-form-grid"><label>Project<select value={draft.projectId || ''} onChange={(event) => setDraft({ ...draft, projectId: event.target.value, assigneeIds: [], reviewerId: '' })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={updateDraft('priority')}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Category<select value={draft.category} onChange={updateDraft('category')}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate} onChange={updateDraft('dueDate')} /></label><label>Due time<input type="time" value={draft.dueTime} onChange={updateDraft('dueTime')} /></label><label>Assignees<select multiple value={draft.assigneeIds || []} disabled={!canManageProject(draft.projectId)} onChange={(event) => setDraft({ ...draft, assigneeIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{membersForProject(draft.projectId).map((person) => <option key={person.id} value={person.id}>{person.id === session.user.id ? 'You' : person.name}</option>)}</select><small>Only current project members can be assigned.</small></label><label>Review by<select value={draft.reviewerId || ''} disabled={!canManageProject(draft.projectId)} onChange={updateDraft('reviewerId')}><option value="">No review required</option>{membersForProject(draft.projectId).filter((person) => ['owner', 'admin'].includes(person.role)).map((person) => <option key={person.id} value={person.id}>{person.id === session.user.id ? 'You' : person.name}</option>)}</select><small>Reviewers need a manager role to approve or request changes.</small></label></div><div className="task-modal-actions"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary">{editingId ? 'Save Changes' : 'Create Task'}</Button></div></form></div>}
    </DashboardLayout>
  );
}
