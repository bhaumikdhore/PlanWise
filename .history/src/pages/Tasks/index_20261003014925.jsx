import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getProjects } from '../../services/projects/projectService';
import { deleteTask as removeTask, getTasks, saveTask as persistTask, updateTaskStatus } from '../../services/tasks/taskService';

const today = new Date().toISOString().slice(0, 10);
const categories = ['Work', 'Personal', 'Planning', 'Study'];
const priorities = ['High', 'Medium', 'Low'];
const blankTask = { title: '', description: '', priority: 'Medium', dueDate: today, dueTime: '09:00', category: 'Work', projectId: '', done: false };

function formatDue(task) {
  if (!task.dueDate) return 'No due date';
  const date = new Date(`${task.dueDate}T${task.dueTime || '00:00'}`);
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function TasksPage({ onNavigate, onLogout, session }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
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
    const [nextProjects, nextTasks] = await Promise.all([getProjects(user), getTasks()]);
    setProjects(nextProjects.filter((project) => !project.archived));
    setTasks(nextTasks);
  };

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(user), getTasks()]).then(([nextProjects, nextTasks]) => {
      if (!active) return;
      setProjects(nextProjects.filter((project) => !project.archived));
      setTasks(nextTasks);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load tasks.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description} ${task.category} ${task.project || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || (activeTab === 'Completed' && task.done) || (activeTab === 'Today' && task.dueDate === today) || (activeTab === 'Upcoming' && !task.done && task.dueDate > today);
    const matchesPriority = filters.priority === 'All' || task.priority === filters.priority;
    const matchesStatus = filters.status === 'All' || (filters.status === 'Completed' ? task.done : !task.done);
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
      await updateTaskStatus(task, !task.done);
      await refresh();
    } catch (updateError) {
      setError(updateError.message || 'Could not update this task.');
    }
  };
  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    setError('');
    try {
      await removeTask(id);
      await refresh();
      setSuccess('Task deleted.');
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this task.');
    }
  };

  const assigneeOptions = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    return [...new Set([session.user.id, ...(project?.members || [])])].map((id) => ({
      id,
      label: id === session.user.id ? (session.user.user_metadata?.full_name || session.user.email || 'You') : id
    }));
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="tasks">
      <section className="tasks-page">
        <header className="tasks-page-header"><div><span className="panel-kicker">Workspace focus</span><h1>My Tasks</h1><p>Plan the next action, keep priorities visible, and make steady progress.</p></div><Button type="button" variant="primary" onClick={openCreate}>+ Add Task</Button></header>
        {error && <div role="alert">{error}</div>}{success && <div role="status">{success}</div>}
        <div className="tasks-toolbar"><label className="tasks-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" /></label><div className="task-tabs" role="tablist" aria-label="Task views">{['All', 'Today', 'Upcoming', 'Completed'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
        <div className="task-filters"><label>Priority<select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option>All</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option><option>Open</option><option>Completed</option></select></label><label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option>All</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<select value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })}><option>All</option><option>Today</option><option>Upcoming</option></select></label></div>
        <div className="tasks-summary"><span>{visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} shown</span><span>{tasks.filter((task) => task.done).length} completed</span></div>
        {loading ? <div className="tasks-loading" role="status">Loading tasks…</div> : <section className="tasks-list" aria-live="polite">{visibleTasks.length ? visibleTasks.map((task, index) => <article key={task.id} className={`task-page-card${task.done ? ' is-done' : ''}`} style={{ '--task-delay': `${index * 50}ms` }}><button type="button" className={`task-page-check${task.done ? ' checked' : ''}`} onClick={() => toggleTask(task)} aria-label={`${task.done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}>{task.done ? '✓' : ''}</button><div className="task-page-content"><div className="task-page-title-row"><h2>{task.title}</h2><span className={`priority-badge priority-${task.priority.toLowerCase() === 'high' ? 'danger' : task.priority.toLowerCase() === 'medium' ? 'amber' : 'green'}`}>{task.priority}</span></div><p>{task.description}</p><div className="task-page-meta"><span>◷ {formatDue(task)}</span><span>▤ {task.category}</span>{(projects.find((project) => project.id === task.projectId)?.name || task.project) && <span>◫ {projects.find((project) => project.id === task.projectId)?.name || task.project}</span>}{task.assigneeIds?.length > 0 && <span>Assigned: {task.assigneeIds.map((id) => id === session.user.id ? 'You' : id.slice(0, 8)).join(', ')}</span>}</div></div><div className="task-page-actions"><button type="button" onClick={() => openEdit(task)}>Edit</button><button type="button" onClick={() => deleteTask(task.id)} className="delete-task">Delete</button></div></article>) : <div className="tasks-empty"><strong>{tasks.length ? 'No tasks match these filters.' : 'No tasks yet'}</strong><span>{tasks.length ? 'Try another view or add a new task.' : 'Create a task to start planning. Existing browser-only tasks remain saved locally and are not imported automatically.'}</span></div>}</section>}
      </section>
      {modalOpen && <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><form className="task-modal" onSubmit={saveTask} role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="task-modal-header"><div><span className="panel-kicker">Task details</span><h2 id="task-modal-title">{editingId ? 'Edit Task' : 'Add Task'}</h2></div><button type="button" className="task-modal-close" onClick={() => setModalOpen(false)} aria-label="Close task form">×</button></div><label>Title<input required autoFocus value={draft.title} onChange={updateDraft('title')} placeholder="What needs to be done?" /></label><label>Description<textarea value={draft.description} onChange={updateDraft('description')} placeholder="Add useful context..." rows="3" /></label><div className="task-form-grid"><label>Project<select value={draft.projectId || ''} onChange={(event) => setDraft({ ...draft, projectId: event.target.value, assigneeIds: [] })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={updateDraft('priority')}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Category<select value={draft.category} onChange={updateDraft('category')}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate} onChange={updateDraft('dueDate')} /></label><label>Due time<input type="time" value={draft.dueTime} onChange={updateDraft('dueTime')} /></label><label>Assignees<select multiple value={draft.assigneeIds || []} onChange={(event) => setDraft({ ...draft, assigneeIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{assigneeOptions(draft.projectId).map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label></div><div className="task-modal-actions"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary">{editingId ? 'Save Changes' : 'Create Task'}</Button></div></form></div>}
    </DashboardLayout>
  );
}
