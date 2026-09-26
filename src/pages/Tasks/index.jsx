import { useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getProjects, getTasks, saveTasks } from '../../services/projects/projectService';

const today = '2026-09-26';
const categories = ['Work', 'Personal', 'Planning', 'Study'];
const priorities = ['High', 'Medium', 'Low'];
const blankTask = { title: '', description: '', priority: 'Medium', dueDate: today, dueTime: '09:00', category: 'Work', projectId: '', done: false };

function formatDue(task) {
  if (!task.dueDate) return 'No due date';
  const date = new Date(`${task.dueDate}T${task.dueTime || '00:00'}`);
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function TasksPage({ onNavigate, onLogout }) {
  const [tasks, setTasks] = useState(() => getTasks());
  const projects = getProjects().filter((project) => !project.archived);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ priority: 'All', status: 'All', category: 'All', dueDate: 'All' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(blankTask);

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
  const saveTask = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const project = projects.find((item) => item.id === draft.projectId);
    const nextTasks = editingId
      ? tasks.map((task) => task.id === editingId ? { ...task, ...draft, project: project?.name || '', title: draft.title.trim() } : task)
      : [{ ...draft, project: project?.name || '', id: `task-${Date.now()}`, title: draft.title.trim() }, ...tasks];
    saveTasks(nextTasks);
    setTasks(nextTasks);
    setModalOpen(false);
  };
  const toggleTask = (id) => {
    const nextTasks = tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task);
    saveTasks(nextTasks);
    setTasks(nextTasks);
  };
  const deleteTask = (id) => {
    if (!window.confirm('Delete this task?')) return;
    const nextTasks = tasks.filter((task) => task.id !== id);
    saveTasks(nextTasks);
    setTasks(nextTasks);
  };

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="tasks">
      <section className="tasks-page">
        <header className="tasks-page-header"><div><span className="panel-kicker">Workspace focus</span><h1>My Tasks</h1><p>Plan the next action, keep priorities visible, and make steady progress.</p></div><Button type="button" variant="primary" onClick={openCreate}>+ Add Task</Button></header>
        <div className="tasks-toolbar"><label className="tasks-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" /></label><div className="task-tabs" role="tablist" aria-label="Task views">{['All', 'Today', 'Upcoming', 'Completed'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div></div>
        <div className="task-filters"><label>Priority<select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option>All</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option><option>Open</option><option>Completed</option></select></label><label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option>All</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<select value={filters.dueDate} onChange={(event) => setFilters({ ...filters, dueDate: event.target.value })}><option>All</option><option>Today</option><option>Upcoming</option></select></label></div>
        <div className="tasks-summary"><span>{visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} shown</span><span>{tasks.filter((task) => task.done).length} completed</span></div>
        <section className="tasks-list" aria-live="polite">{visibleTasks.length ? visibleTasks.map((task, index) => <article key={task.id} className={`task-page-card${task.done ? ' is-done' : ''}`} style={{ '--task-delay': `${index * 50}ms` }}><button type="button" className={`task-page-check${task.done ? ' checked' : ''}`} onClick={() => toggleTask(task.id)} aria-label={`${task.done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}>{task.done ? '✓' : ''}</button><div className="task-page-content"><div className="task-page-title-row"><h2>{task.title}</h2><span className={`priority-badge priority-${task.priority.toLowerCase() === 'high' ? 'danger' : task.priority.toLowerCase() === 'medium' ? 'amber' : 'green'}`}>{task.priority}</span></div><p>{task.description}</p><div className="task-page-meta"><span>◷ {formatDue(task)}</span><span>▤ {task.category}</span>{(projects.find((project) => project.id === task.projectId)?.name || task.project) && <span>◫ {projects.find((project) => project.id === task.projectId)?.name || task.project}</span>}</div></div><div className="task-page-actions"><button type="button" onClick={() => openEdit(task)}>Edit</button><button type="button" onClick={() => deleteTask(task.id)} className="delete-task">Delete</button></div></article>) : <div className="tasks-empty"><strong>No tasks match these filters.</strong><span>Try another view or add a new task.</span></div>}</section>
      </section>
      {modalOpen && <div className="task-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><form className="task-modal" onSubmit={saveTask} role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="task-modal-header"><div><span className="panel-kicker">Task details</span><h2 id="task-modal-title">{editingId ? 'Edit Task' : 'Add Task'}</h2></div><button type="button" className="task-modal-close" onClick={() => setModalOpen(false)} aria-label="Close task form">×</button></div><label>Title<input required autoFocus value={draft.title} onChange={updateDraft('title')} placeholder="What needs to be done?" /></label><label>Description<textarea value={draft.description} onChange={updateDraft('description')} placeholder="Add useful context..." rows="3" /></label><div className="task-form-grid"><label>Project<select value={draft.projectId || ''} onChange={updateDraft('projectId')}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Priority<select value={draft.priority} onChange={updateDraft('priority')}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><label>Category<select value={draft.category} onChange={updateDraft('category')}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate} onChange={updateDraft('dueDate')} /></label><label>Due time<input type="time" value={draft.dueTime} onChange={updateDraft('dueTime')} /></label></div><div className="task-modal-actions"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary">{editingId ? 'Save Changes' : 'Create Task'}</Button></div></form></div>}
    </DashboardLayout>
  );
}
