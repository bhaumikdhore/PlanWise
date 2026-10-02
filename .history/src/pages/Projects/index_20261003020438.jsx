import { useEffect, useMemo, useState } from 'react';
import Avatar from '../../components/common/Avatar';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { deleteProject, getProjects, saveProject } from '../../services/projects/projectService';
import { getTasks, saveTask, updateTaskStatus } from '../../services/tasks/taskService';
import { getFiles, getGoals, saveFile, saveGoal } from '../../services/projects/localWorkspaceService';
import { getMeetings, saveMeeting } from '../../services/meetings/meetingService';

const projectStatuses = ['Planning', 'Active', 'On Hold', 'Completed'];
const sortOptions = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'progress', label: 'Progress' },
  { value: 'name', label: 'Name' }
];
const today = new Date().toISOString().slice(0, 10);
const blankProject = { name: '', description: '', status: 'Planning', startDate: today, deadline: '', members: '' };

const formatDate = (value) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : 'Not set';
const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

function ProjectForm({ project, onClose, onSave }) {
  const [draft, setDraft] = useState(project || blankProject);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.description.trim()) {
      setError('Add a project name and description to continue.');
      return;
    }
    if (draft.deadline && draft.startDate && draft.deadline < draft.startDate) {
      setError('The deadline must be on or after the start date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        members: typeof draft.members === 'string'
          ? draft.members.split(',').map((member) => member.trim()).filter(Boolean)
          : draft.members
      });
    } catch (saveError) {
      setError(saveError.message || 'Could not save this project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="project-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="project-form-title">
        <div className="project-modal-heading"><div><span className="panel-kicker">Project details</span><h2 id="project-form-title">{project ? 'Edit project' : 'Create a project'}</h2></div><button type="button" onClick={onClose} aria-label="Close project form">×</button></div>
        <label>Project name<input autoFocus required value={draft.name} onChange={change('name')} placeholder="e.g. Website redesign" /></label>
        <label>Description<textarea required rows="3" value={draft.description} onChange={change('description')} placeholder="What are you working towards?" /></label>
        <div className="project-form-grid">
          <label>Status<select value={draft.status} onChange={change('status')}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Project owner<input value={project?.owner || 'You'} disabled /></label>
          <label>Start date<input type="date" value={draft.startDate} onChange={change('startDate')} /></label>
          <label>Deadline<input type="date" value={draft.deadline} onChange={change('deadline')} /></label>
        </div>
        <label>Team member profile IDs <span>(comma-separated UUIDs)</span><input value={Array.isArray(draft.members) ? draft.members.join(', ') : draft.members} onChange={change('members')} placeholder="Paste existing Planwise user IDs" /></label>
        {error && <p className="project-form-error" role="alert">{error}</p>}
        <div className="project-modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button></div>
      </form>
    </div>
  );
}

function ProjectCard({ project, onOpen, onEdit, onDelete, onArchive, tasks, meetings }) {
  const completedTasks = tasks.filter((task) => task.done).length;
  const upcomingMeetings = meetings.filter((meeting) => meeting.date >= today).length;
  return (
    <article className="project-page-card">
      <div className="project-card-heading">
        <div><span className={`project-status project-status-${statusClass(project.status)}`}>{project.status}</span><h2>{project.name}</h2></div>
        <button type="button" className="project-card-menu" aria-label={`Open ${project.name}`} onClick={onOpen}>↗</button>
      </div>
      <p>{project.description}</p>
      <div className="project-progress-label"><span>Project progress</span><b>{project.progress}%</b></div>
      <div className="project-progress-track" aria-label={`Project ${project.progress}% complete`}><i style={{ width: `${project.progress}%` }} /></div>
      <div className="project-card-meta">
        <span>Start date<strong>{formatDate(project.startDate)}</strong></span>
        <span>Deadline<strong>{formatDate(project.deadline)}</strong></span>
        <span>Owner<strong>{project.owner}</strong></span>
        <span>Tasks<strong>{tasks.length} total · {completedTasks} done</strong></span>
        <span>Upcoming meetings<strong>{upcomingMeetings}</strong></span>
        <span>Team<strong>{project.members.length} members</strong></span>
      </div>
      <div className="project-card-footer">
        <div className="project-member-stack" aria-label={`Team members: ${project.members.join(', ')}`}>
          {project.members.slice(0, 4).map((member) => <span key={member} title={member}>{initials(member)}</span>)}
          {project.members.length > 4 && <span>+{project.members.length - 4}</span>}
          {!project.members.length && <small>No team members yet</small>}
        </div>
        <div className="project-card-actions">
          <button type="button" onClick={onOpen}>Open</button><button type="button" onClick={onEdit}>Edit</button>
          <button type="button" onClick={onArchive}>{project.archived ? 'Restore' : 'Archive'}</button>
          <button type="button" className="project-delete" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </article>
  );
}

function ProjectDetails({ project, tasks, meetings, user, onBack, onEdit, refresh }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [taskModal, setTaskModal] = useState(false);
  const [meetingModal, setMeetingModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ title: '', dueDate: '', priority: 'Medium' });
  const [meetingDraft, setMeetingDraft] = useState({ title: '', date: '', time: '10:00', duration: 30 });
  const [goalDraft, setGoalDraft] = useState({ title: '', targetDate: '' });
  const [formError, setFormError] = useState('');
  meetings = meetings.filter((meeting) => meeting.projectId === project.id).sort((a, b) => `${a.date} ${a.time || a.startTime}`.localeCompare(`${b.date} ${b.time || b.startTime}`));
  const files = getFiles(project.id);
  const goals = getGoals(project.id);
  const upcomingMeetings = meetings.filter((meeting) => meeting.date >= today);
  const completedTasks = tasks.filter((task) => task.done).length;
  const tabs = ['Overview', 'Project Tasks', 'Project Calendar', 'Project Meetings', 'Project Files', 'Team Members', 'Project Progress'];

  const toggleTask = async (task) => {
    try {
      await updateTaskStatus(task, !task.done);
      await refresh();
    } catch (error) {
      setFormError(error.message || 'Could not update this task.');
    }
  };
  const addTask = async (event) => {
    event.preventDefault();
    if (!taskDraft.title.trim()) { setFormError('Task title is required.'); return; }
    try {
      await saveTask({ ...taskDraft, description: '', dueTime: '09:00', category: 'Work', done: false, projectId: project.id }, user.id);
      setTaskDraft({ title: '', dueDate: '', priority: 'Medium' });
      setTaskModal(false);
      setFormError('');
      await refresh();
    } catch (error) {
      setFormError(error.message || 'Could not create this task.');
    }
  };
  const addMeeting = async (event) => {
    event.preventDefault();
    if (!meetingDraft.title.trim() || !meetingDraft.date || !meetingDraft.time) { setFormError('Add a meeting name, date, and time.'); return; }
    const startMinutes = Number(meetingDraft.time.slice(0, 2)) * 60 + Number(meetingDraft.time.slice(3));
    const endMinutes = startMinutes + Number(meetingDraft.duration || 30);
    if (endMinutes >= 24 * 60) { setFormError('The meeting must end before midnight.'); return; }
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    try {
      await saveMeeting({
        title: meetingDraft.title.trim(),
        description: '',
        date: meetingDraft.date,
        startTime: meetingDraft.time,
        endTime,
        projectId: project.id,
        participants: [...new Set([project.ownerId, ...project.members].filter(Boolean))],
        location: '',
        meetingLink: '',
        reminder: 10,
        meetingType: 'Team meeting',
        status: 'Upcoming',
        notes: '',
        actionItems: []
      }, user.id);
      setMeetingDraft({ title: '', date: '', time: '10:00', duration: 30 });
      setMeetingModal(false);
      setFormError('');
      await refresh();
    } catch (error) {
      setFormError(error.message || 'Could not schedule this meeting.');
    }
  };
  const addGoal = (event) => {
    event.preventDefault();
    if (!goalDraft.title.trim()) { setFormError('Goal name is required.'); return; }
    saveGoal({ ...goalDraft, title: goalDraft.title.trim(), projectId: project.id, progress: 0, status: 'On track' });
    setGoalDraft({ title: '', targetDate: '' });
    setGoalModal(false);
    setFormError('');
    refresh();
  };
  const addFiles = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    selectedFiles.forEach((file) => saveFile({
      projectId: project.id,
      name: file.name,
      size: file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      addedAt: today,
      kind: file.name.split('.').pop().slice(0, 4).toUpperCase()
    }));
    event.target.value = '';
    refresh();
  };

  const taskList = (
    <div className="project-task-list">
      {tasks.map((task) => <div className={`project-task-row${task.done ? ' is-done' : ''}`} key={task.id}>
        <button type="button" className={`task-page-check${task.done ? ' checked' : ''}`} onClick={() => toggleTask(task)} aria-label={`${task.done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}>{task.done ? '✓' : ''}</button>
        <div><strong>{task.title}</strong><span>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'} · {task.priority || 'Medium'} priority</span></div>
      </div>)}
      {!tasks.length && <div className="project-detail-empty">No tasks yet. Add one to keep this project moving.</div>}
    </div>
  );
  const meetingList = (
    <div className="project-resource-list">
      {meetings.map((meeting) => <article className="project-resource-row" key={meeting.id}><span className="project-resource-icon">◷</span><div><strong>{meeting.title}</strong><span>{formatDate(meeting.date)} · {meeting.startTime}–{meeting.endTime}</span></div><span className="project-resource-note">{meeting.participants.length} attendees</span></article>)}
      {!meetings.length && <div className="project-detail-empty">No meetings scheduled yet.</div>}
    </div>
  );
  const fileList = (
    <div className="project-resource-list">
      {files.map((file) => <article className="project-resource-row" key={file.id}><span className="project-resource-icon project-file-icon">{file.kind}</span><div><strong>{file.name}</strong><span>Added {formatDate(file.addedAt)}</span></div><span className="project-resource-note">{file.size}</span></article>)}
      {!files.length && <div className="project-detail-empty">No files attached yet. Upload a file to share it with this project.</div>}
    </div>
  );

  return (
    <section className="projects-page page-transition">
      <button type="button" className="project-back" onClick={onBack}>← All projects</button>
      <header className="project-details-header">
        <div><span className={`project-status project-status-${statusClass(project.status)}`}>{project.status}</span><h1>{project.name}</h1><p>{project.description}</p></div>
        <div className="project-detail-header-actions"><Button variant="secondary" onClick={onEdit}>Edit project</Button><Button onClick={() => onBack()}>Done</Button></div>
      </header>
      <nav className="project-detail-tabs" aria-label="Project sections">
        {tabs.map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>
      <section className="project-detail-panel" aria-live="polite">
        {activeTab === 'Overview' && <>
          <div className="project-detail-panel-heading"><div><span className="panel-kicker">At a glance</span><h2>Project overview</h2></div><span>Owned by {project.owner}</span></div>
          <div className="project-overview-grid">
            <span>Progress<strong>{project.progress}%</strong></span><span>Tasks complete<strong>{completedTasks} / {tasks.length}</strong></span>
            <span>Upcoming meetings<strong>{upcomingMeetings.length}</strong></span><span>Project deadline<strong>{formatDate(project.deadline)}</strong></span>
          </div>
          <div className="project-detail-progress"><i style={{ width: `${project.progress}%` }} /></div>
          <div className="project-goals-section">
            <div className="project-section-heading"><div><h3>Project goals</h3><span>Keep the outcomes that matter in view.</span></div><button type="button" onClick={() => { setFormError(''); setGoalModal(true); }}>+ Add goal</button></div>
            {goals.length ? <div className="project-goals-list">{goals.map((goal) => <article className="project-goal-card" key={goal.id}><div><strong>{goal.title}</strong><span>{goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : 'No target date'} · {goal.progress === 100 ? 'Complete' : goal.status}</span></div><label><span>{goal.progress}%</span><input type="range" min="0" max="100" step="5" value={goal.progress} aria-label={`Progress for ${goal.title}`} onChange={(event) => { const progress = Number(event.target.value); saveGoal({ ...goal, progress, status: progress === 100 ? 'Complete' : 'On track' }); refresh(); }} /></label></article>)}</div> : <div className="project-detail-empty">Set a goal to give this project a clear outcome.</div>}
          </div>
          <div className="project-overview-columns"><div><div className="project-section-heading"><h3>Recent tasks</h3><button type="button" onClick={() => setActiveTab('Project Tasks')}>View all</button></div>{taskList}</div><div><div className="project-section-heading"><h3>Next up</h3><button type="button" onClick={() => setActiveTab('Project Meetings')}>View meetings</button></div>{upcomingMeetings.length ? upcomingMeetings.slice(0, 2).map((meeting) => <div className="project-upcoming-meeting" key={meeting.id}><strong>{meeting.title}</strong><span>{formatDate(meeting.date)} · {meeting.time}</span></div>) : <div className="project-detail-empty">No upcoming meetings.</div>}</div></div>
        </>}
        {activeTab === 'Project Tasks' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">Stay on track</span><h2>Project tasks</h2></div><Button onClick={() => { setFormError(''); setTaskModal(true); }}>+ Add task</Button></div>{taskList}</>}
        {activeTab === 'Project Calendar' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">Key dates</span><h2>Project calendar</h2></div><Button onClick={() => { setFormError(''); setMeetingModal(true); }}>+ Add meeting</Button></div><div className="project-calendar-grid">{[...tasks.filter((task) => task.dueDate).map((task) => ({ id: task.id, title: task.title, date: task.dueDate, type: 'Task' })), ...meetings.map((meeting) => ({ id: meeting.id, title: meeting.title, date: meeting.date, type: 'Meeting' }))].sort((a, b) => a.date.localeCompare(b.date)).map((item) => <article key={`${item.type}-${item.id}`}><span>{item.type}</span><strong>{item.title}</strong><time>{formatDate(item.date)}</time></article>)}</div>{!tasks.some((task) => task.dueDate) && !meetings.length && <div className="project-detail-empty">Dates and meetings will appear here as your project grows.</div>}</>}
        {activeTab === 'Project Meetings' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">Bring everyone together</span><h2>Project meetings</h2></div><Button onClick={() => { setFormError(''); setMeetingModal(true); }}>+ Add meeting</Button></div>{meetingList}</>}
        {activeTab === 'Project Files' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">Shared resources</span><h2>Project files</h2></div><label className="project-upload-button">+ Attach files<input type="file" multiple onChange={addFiles} aria-label="Attach project files" /></label></div>{fileList}</>}
        {activeTab === 'Team Members' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">Working together</span><h2>Team members</h2></div><Button variant="secondary" onClick={onEdit}>Manage team</Button></div><div className="project-team-grid">{[project.owner, ...project.members.filter((member) => member !== project.owner)].map((member, index) => <article key={member}><Avatar initials={initials(member)} active={index === 0} /><div><strong>{member}</strong><span>{index === 0 ? 'Project owner' : 'Team member'}</span></div></article>)}</div>{!project.members.length && <div className="project-detail-empty">Add teammates by editing this project.</div>}</>}
        {activeTab === 'Project Progress' && <><div className="project-detail-panel-heading"><div><span className="panel-kicker">A little progress adds up</span><h2>Project progress</h2></div><strong className="project-progress-value">{project.progress}%</strong></div><div className="project-progress-label"><span>Overall completion</span><b>{project.progress}%</b></div><div className="project-detail-progress"><i style={{ width: `${project.progress}%` }} /></div><p className="project-progress-caption">{completedTasks} of {tasks.length} project tasks are complete. Mark tasks done to keep progress up to date.</p>{taskList}</>}
      </section>
      {taskModal && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskModal(false); }}><form className="project-modal" onSubmit={addTask} role="dialog" aria-modal="true" aria-labelledby="project-task-form-title"><div className="project-modal-heading"><div><span className="panel-kicker">{project.name}</span><h2 id="project-task-form-title">Add a project task</h2></div><button type="button" onClick={() => setTaskModal(false)} aria-label="Close task form">×</button></div><label>Task name<input autoFocus required value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} placeholder="What needs to get done?" /></label><div className="project-form-grid"><label>Due date<input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} /></label><label>Priority<select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label></div>{formError && <p className="project-form-error" role="alert">{formError}</p>}<div className="project-modal-actions"><Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Cancel</Button><Button type="submit">Add task</Button></div></form></div>}
      {meetingModal && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMeetingModal(false); }}><form className="project-modal" onSubmit={addMeeting} role="dialog" aria-modal="true" aria-labelledby="project-meeting-form-title"><div className="project-modal-heading"><div><span className="panel-kicker">{project.name}</span><h2 id="project-meeting-form-title">Schedule a meeting</h2></div><button type="button" onClick={() => setMeetingModal(false)} aria-label="Close meeting form">×</button></div><label>Meeting name<input autoFocus required value={meetingDraft.title} onChange={(event) => setMeetingDraft({ ...meetingDraft, title: event.target.value })} placeholder="e.g. Weekly project sync" /></label><div className="project-form-grid"><label>Date<input type="date" min={today} required value={meetingDraft.date} onChange={(event) => setMeetingDraft({ ...meetingDraft, date: event.target.value })} /></label><label>Time<input type="time" required value={meetingDraft.time} onChange={(event) => setMeetingDraft({ ...meetingDraft, time: event.target.value })} /></label></div>{formError && <p className="project-form-error" role="alert">{formError}</p>}<div className="project-modal-actions"><Button type="button" variant="secondary" onClick={() => setMeetingModal(false)}>Cancel</Button><Button type="submit">Schedule meeting</Button></div></form></div>}
      {goalModal && <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGoalModal(false); }}><form className="project-modal" onSubmit={addGoal} role="dialog" aria-modal="true" aria-labelledby="project-goal-form-title"><div className="project-modal-heading"><div><span className="panel-kicker">{project.name}</span><h2 id="project-goal-form-title">Add a project goal</h2></div><button type="button" onClick={() => setGoalModal(false)} aria-label="Close goal form">×</button></div><label>Goal<input autoFocus required value={goalDraft.title} onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })} placeholder="What outcome are you aiming for?" /></label><label>Target date<input type="date" value={goalDraft.targetDate} onChange={(event) => setGoalDraft({ ...goalDraft, targetDate: event.target.value })} /></label>{formError && <p className="project-form-error" role="alert">{formError}</p>}<div className="project-modal-actions"><Button type="button" variant="secondary" onClick={() => setGoalModal(false)}>Cancel</Button><Button type="submit">Add goal</Button></div></form></div>}
    </section>
  );
}

export default function ProjectsPage({ onNavigate, onLogout, session, locationPath = '/projects' }) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('deadline');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const user = {
    id: session.user.id,
    profile: {
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      email: session.user.email || ''
    }
  };

  const refresh = async () => {
    const [nextProjects, nextTasks, nextMeetings] = await Promise.all([getProjects(user), getTasks(), getMeetings()]);
    const taskCounts = new Map();
    nextTasks.forEach((task) => taskCounts.set(task.projectId, [...(taskCounts.get(task.projectId) || []), task]));
    setProjects(nextProjects.map((project) => {
      const projectTasks = taskCounts.get(project.id) || [];
      return { ...project, progress: projectTasks.length ? Math.round(projectTasks.filter((task) => task.done).length / projectTasks.length * 100) : 0 };
    }));
    setTasks(nextTasks);
    setMeetings(nextMeetings);
    setPageError('');
  };

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(user), getTasks(), getMeetings()]).then(([nextProjects, nextTasks, nextMeetings]) => {
      if (!active) return;
      const taskCounts = new Map();
      nextTasks.forEach((task) => taskCounts.set(task.projectId, [...(taskCounts.get(task.projectId) || []), task]));
      setProjects(nextProjects.map((project) => {
        const projectTasks = taskCounts.get(project.id) || [];
        return { ...project, progress: projectTasks.length ? Math.round(projectTasks.filter((task) => task.done).length / projectTasks.length * 100) : 0 };
      }));
      setTasks(nextTasks);
      setMeetings(nextMeetings);
      setPageError('');
    }).catch((error) => {
      if (active) setPageError(error.message || 'Could not load projects and tasks.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  const projectId = decodeURIComponent(locationPath.split('/')[2] || '');
  const selectedProject = projectId ? projects.find((project) => project.id === projectId) || null : null;
  const visibleProjects = useMemo(() => projects
    .filter((project) => showArchived ? project.archived : !project.archived)
    .filter((project) => statusFilter === 'All statuses' || project.status === statusFilter)
    .filter((project) => `${project.name} ${project.description} ${project.owner}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (a.deadline || '9999').localeCompare(b.deadline || '9999');
    }), [projects, search, statusFilter, showArchived, sortBy]);

  const openProject = (project) => onNavigate(`projects/${encodeURIComponent(project.id)}`);
  const openCreate = () => { setEditingProject(null); setFormOpen(true); };
  const openEdit = (project) => { setEditingProject(project); setFormOpen(true); };
  const handleSave = async (project) => {
    await saveProject(project, user);
    setFormOpen(false);
    setEditingProject(null);
    await refresh();
    setPageSuccess('Project changes saved.');
  };
  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? Tasks, meetings, and files are unlinked; project goals are deleted.`)) return;
    try {
      await deleteProject(project.id);
      if (project.id === projectId) onNavigate('projects');
      await refresh();
      setPageSuccess('Project deleted.');
    } catch (error) {
      setPageError(error.message || 'Could not delete this project.');
    }
  };
  const handleArchive = async (project) => {
    const action = project.archived ? 'restore' : 'archive';
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} "${project.name}"?`)) return;
    try {
      await saveProject({ ...project, archived: !project.archived }, user);
      if (project.id === projectId) onNavigate('projects');
      await refresh();
      setPageSuccess(action === 'archive' ? 'Project archived.' : 'Project restored.');
    } catch (error) {
      setPageError(error.message || 'Could not update this project.');
    }
  };
  const onEditDetails = () => openEdit(selectedProject);

  if (selectedProject) {
    return <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="projects">
      {loading ? <div className="project-loading" role="status">Loading project…</div> : <><ProjectDetails key={selectedProject.id} project={selectedProject} tasks={tasks.filter((task) => task.projectId === selectedProject.id)} meetings={meetings} user={user} onBack={() => onNavigate('projects')} onEdit={onEditDetails} refresh={refresh} />{pageError && <div role="alert">{pageError}</div>}{pageSuccess && <div role="status">{pageSuccess}</div>}</>}
      {formOpen && <ProjectForm project={editingProject} onClose={() => setFormOpen(false)} onSave={handleSave} />}
    </DashboardLayout>;
  }

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="projects">
      <section className="projects-page page-transition">
        <header className="projects-page-header"><div><span className="panel-kicker">Your workspace</span><h1>Projects</h1><p>Bring tasks, meetings, files, and people together around the work that matters.</p></div><Button onClick={openCreate}>+ Create Project</Button></header>
        {pageError && <div role="alert">{pageError}</div>}{pageSuccess && <div role="status">{pageSuccess}</div>}
        <div className="projects-toolbar">
          <label className="projects-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects..." aria-label="Search projects" /></label>
          <div className="projects-filter-wrap">
            <Button type="button" variant="secondary" className="projects-filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>☷ Filter{statusFilter !== 'All statuses' || showArchived ? ' · 1' : ''}</Button>
            {filtersOpen && <div className="projects-filter-popover"><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter projects by status"><option>All statuses</option>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="projects-archived-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived projects</label><button type="button" onClick={() => { setStatusFilter('All statuses'); setShowArchived(false); }}>Clear filters</button></div>}
          </div>
          <label className="projects-sort">Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort projects">{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        {loading ? <div className="projects-loading" role="status"><span className="loading-spinner" />Loading your projects…</div> : <>
          <div className="projects-results-summary"><span>{visibleProjects.length} {showArchived ? 'archived ' : ''}project{visibleProjects.length === 1 ? '' : 's'}</span><span>{projects.filter((project) => !project.archived).length} in your workspace</span></div>
          {visibleProjects.length ? <div className="projects-grid">{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => openProject(project)} onEdit={() => openEdit(project)} onDelete={() => handleDelete(project)} onArchive={() => handleArchive(project)} tasks={tasks.filter((task) => task.projectId === project.id)} meetings={meetings.filter((meeting) => meeting.projectId === project.id)} />)}</div>
            : <div className="projects-empty"><span className="projects-empty-mark">◫</span><strong>{projects.length ? 'No projects found' : 'Your next big thing starts here'}</strong><span>{projects.length ? 'Try changing your search or filters.' : 'Create a project to bring your team, tasks, and ideas together. Existing browser-only projects remain saved locally and are not imported automatically.'}</span>{!projects.length && <Button onClick={openCreate}>Create your first project</Button>}</div>}
        </>}
      </section>
      {formOpen && <ProjectForm project={editingProject} onClose={() => setFormOpen(false)} onSave={handleSave} />}
    </DashboardLayout>
  );
}
