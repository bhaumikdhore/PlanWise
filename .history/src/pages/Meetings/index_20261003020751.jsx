import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { googleCalendarRequest, hasCalendarBackend } from '../../services/calendar/googleCalendarApi';
import { getProjects } from '../../services/projects/projectService';
import { getMeetings, saveMeeting, deleteMeeting, setMeetingGoogleEventId } from '../../services/meetings/meetingService';
import { saveTask } from '../../services/tasks/taskService';

const statusFilters = ['All', 'Upcoming', 'In Progress', 'Completed', 'Cancelled'];
const blankMeeting = () => ({
  title: '', description: '', date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  startTime: '10:00', endTime: '10:30', participants: [], projectId: '',
  location: '', meetingLink: '', reminder: '10', meetingType: 'Team meeting',
  status: 'Upcoming', notes: '', actionItems: [], googleEventId: ''
});

function localDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function dateLabel(value) {
  return localDate(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function timeLabel(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2020, 0, 1, hour, minute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function getStatus(meeting) {
  if (meeting.status === 'Cancelled') return 'Cancelled';
  if (meeting.status === 'Completed') return 'Completed';
  const now = new Date();
  const start = new Date(`${meeting.date}T${meeting.startTime || '00:00'}:00`);
  const end = new Date(`${meeting.date}T${meeting.endTime || '23:59'}:00`);
  if (now >= end) return 'Completed';
  if (now >= start) return 'In Progress';
  return 'Upcoming';
}
function initials(value) {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
function toGoogleEvent(meeting, projects, user) {
  const project = projects.find((item) => item.id === meeting.projectId);
  const description = [
    meeting.description,
    meeting.meetingLink ? `Meeting link: ${meeting.meetingLink}` : '',
    project ? `Planwise project: ${project.name}` : ''
  ].filter(Boolean).join('\n\n');
  const body = {
    summary: meeting.title,
    description,
    location: meeting.location || '',
    start: { dateTime: `${meeting.date}T${meeting.startTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: `${meeting.date}T${meeting.endTime}:00`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    reminders: Number(meeting.reminder) > 0
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: Number(meeting.reminder) }] }
      : { useDefault: false }
  };
  const attendees = meeting.participants
    .map((participant) => participant === user.id ? user.email : participant)
    .filter((participant) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant));
  if (attendees.length) body.attendees = attendees.map((email) => ({ email }));
  if (project) body.extendedProperties = { private: { planwiseProjectId: project.id, planwiseCategory: meeting.meetingType } };
  return body;
}

function MeetingForm({ meeting, projects, teamMembers, currentUserName, googleConnected, onClose, onSave }) {
  const [draft, setDraft] = useState(() => meeting ? { ...meeting, participants: [...(meeting.participants || [])], reminder: String(meeting.reminder ?? 10) } : blankMeeting());
  const [error, setError] = useState('');
  const [syncGoogle, setSyncGoogle] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) { setError('Enter a meeting title.'); return; }
    if (!draft.date || !draft.startTime || !draft.endTime) { setError('Choose a date, start time, and end time.'); return; }
    if (draft.endTime <= draft.startTime) { setError('The end time must be after the start time.'); return; }
    if (draft.meetingLink && !/^https?:\/\//i.test(draft.meetingLink)) { setError('The meeting link must start with http:// or https://.'); return; }
    const savedMeeting = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      participants: draft.participants,
      reminder: Number(draft.reminder),
      organizer: draft.organizer || currentUserName
    };
    setSaving(true);
    try {
      await onSave(savedMeeting, syncGoogle);
    } catch (submitError) {
      setError(submitError.message || 'Could not save this meeting.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="meetings-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="meetings-modal meetings-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="meeting-form-title">
      <div className="meetings-modal-heading"><div><span className="panel-kicker">Make it a good meeting</span><h2 id="meeting-form-title">{meeting ? 'Edit meeting' : 'Schedule a meeting'}</h2></div><button type="button" onClick={onClose} aria-label="Close meeting form">×</button></div>
      <label className="meeting-field">Meeting title<input autoFocus required maxLength="160" value={draft.title} onChange={set('title')} placeholder="What is this meeting about?" /></label>
      <label className="meeting-field">Description<textarea rows="2" maxLength="2000" value={draft.description} onChange={set('description')} placeholder="Add an agenda or some context…" /></label>
      <div className="meeting-form-grid"><label className="meeting-field">Date<input type="date" required value={draft.date} onChange={set('date')} /></label><label className="meeting-field">Meeting type<select value={draft.meetingType} onChange={set('meetingType')}><option>Team meeting</option><option>Project review</option><option>Client meeting</option><option>One-on-one</option><option>Planning</option><option>Interview</option><option>Other</option></select></label><label className="meeting-field">Start time<input type="time" required value={draft.startTime} onChange={set('startTime')} /></label><label className="meeting-field">End time<input type="time" required value={draft.endTime} onChange={set('endTime')} /></label></div>
      <label className="meeting-field">Participants<select multiple value={draft.participants} onChange={(event) => setDraft({ ...draft, participants: Array.from(event.target.selectedOptions, (option) => option.value) })} aria-describedby="meeting-participants-help">{teamMembers.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select><small id="meeting-participants-help">Participants are existing Planwise users.</small></label>
      <label className="meeting-field">Project<select value={draft.projectId} onChange={set('projectId')}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <div className="meeting-form-grid"><label className="meeting-field">Location<input maxLength="250" value={draft.location} onChange={set('location')} placeholder="Room or address" /></label><label className="meeting-field">Meeting link<input type="url" value={draft.meetingLink} onChange={set('meetingLink')} placeholder="https://…" /></label></div>
      <label className="meeting-field">Reminder<select value={draft.reminder} onChange={set('reminder')}><option value="0">No reminder</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>
      {!meeting && googleConnected && <label className="meeting-sync-toggle"><input type="checkbox" checked={syncGoogle} onChange={(event) => setSyncGoogle(event.target.checked)} />Also sync this meeting to Google Calendar</label>}
      {error && <p className="meeting-form-error" role="alert">{error}</p>}
      <div className="meetings-modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : meeting ? 'Save changes' : 'Schedule meeting'}</Button></div>
    </form>
  </div>;
}

function MeetingCard({ meeting, projectName, teamMembers, onOpen, onEdit, onCancel, onDelete, onJoin, onComplete, style }) {
  const status = getStatus(meeting);
  const participantLabel = (id) => teamMembers.find((person) => person.id === id)?.label || id.slice(0, 8);
  return <article className="meeting-page-card" style={style} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}>
    <div className={`meeting-card-color meeting-color-${meeting.color || 'blue'}`} />
    <div className="meeting-card-main">
      <div className="meeting-card-title-line"><h2>{meeting.title}</h2><span className={`meeting-status meeting-status-${status.toLowerCase().replace(/\s/g, '-')}`}>{status}</span></div>
      {meeting.description && <p className="meeting-card-description">{meeting.description}</p>}
      <div className="meeting-card-meta"><span>◷ {dateLabel(meeting.date)} · {timeLabel(meeting.startTime)}–{timeLabel(meeting.endTime)}</span><span>◎ {meeting.organizer || userProfile.name}</span><span>◈ {projectName || 'No project'}</span><span>▣ {meeting.meetingType || 'Team meeting'}</span></div>
      <div className="meeting-card-bottom">
        <div className="meeting-participant-stack" aria-label={`Participants: ${(meeting.participants || []).map(participantLabel).join(', ')}`}>
          {meeting.participants?.length ? <>{meeting.participants.slice(0, 5).map((person) => <span key={person} title={participantLabel(person)}>{initials(participantLabel(person))}</span>)}{meeting.participants.length > 5 && <span>+{meeting.participants.length - 5}</span>}<small>{meeting.participants.length} participant{meeting.participants.length === 1 ? '' : 's'}</small></> : <small>No participants added</small>}
        </div>
        {meeting.meetingLink && <a className="meeting-card-link" href={meeting.meetingLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>↗ Meeting link</a>}
      </div>
    </div>
    <div className="meeting-card-actions" onClick={(event) => event.stopPropagation()}>
      {meeting.meetingLink && status !== 'Cancelled' && status !== 'Completed' && <button type="button" className="meeting-join-button" onClick={onJoin}>Join</button>}
      <button type="button" onClick={onEdit}>Edit</button>
      {['Upcoming', 'In Progress'].includes(status) && <button type="button" onClick={onCancel}>Cancel</button>}
      {status === 'In Progress' && <button type="button" onClick={onComplete}>Complete</button>}
      <button type="button" className="meeting-delete-action" onClick={onDelete}>Delete</button>
    </div>
  </article>;
}

export default function MeetingsPage({ onNavigate, onLogout, session }) {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [pageError, setPageError] = useState('');
  const [toast, setToast] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [actionDraft, setActionDraft] = useState({ title: '', assignee: '' });

  const user = {
    id: session.user.id,
    email: session.user.email || ''
  };
  const currentUserName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || user.email || 'You';

  const refresh = async () => {
    const [nextProjects, nextMeetings] = await Promise.all([getProjects(user), getMeetings()]);
    setMeetings(nextMeetings);
    setProjects(nextProjects);
    setPageError('');
  };

  useEffect(() => {
    let active = true;
    refresh().catch((error) => {
      if (active) setPageError(error.message || 'Could not load meeting data.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    if (hasCalendarBackend) {
      googleCalendarRequest('/status')
        .then((status) => setGoogleConnected(Boolean(status.configured && status.connected)))
        .catch(() => setGoogleConnected(false));
    }
    return () => { active = false; };
  }, [session.user.id]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const teamMembers = useMemo(() => {
    const members = new Map([[session.user.id, { id: session.user.id, label: currentUserName }]]);
    const addMember = (id) => {
      if (id && !members.has(id)) members.set(id, { id, label: id.slice(0, 8) });
    };
    projects.forEach((project) => {
      addMember(project.ownerId);
      project.members.forEach(addMember);
    });
    meetings.forEach((meeting) => meeting.participants.forEach(addMember));
    return [...members.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [session.user.id, currentUserName, projects, meetings]);
  const participantLabel = (id) => teamMembers.find((person) => person.id === id)?.label || id.slice(0, 8);
  const visibleMeetings = useMemo(() => meetings
    .filter((meeting) => statusFilter === 'All' || getStatus(meeting) === statusFilter)
    .filter((meeting) => !projectFilter || meeting.projectId === projectFilter)
    .filter((meeting) => {
      const project = projects.find((item) => item.id === meeting.projectId);
      return `${meeting.title} ${meeting.description || ''} ${(meeting.participants || []).map(participantLabel).join(' ')} ${meeting.organizer || ''} ${project?.name || ''} ${meeting.meetingType || ''}`.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
  [meetings, statusFilter, projectFilter, search, projects, teamMembers]);

  const save = async (draft, syncGoogle) => {
    setPageError('');
    setToast('');
    try {
      let saved = await saveMeeting({
        ...draft,
        organizer: draft.organizer || currentUserName,
        googleEventId: editingMeeting?.googleEventId || draft.googleEventId || ''
      }, session.user.id);
      const syncNotices = [];
      if (!saved.calendarMirrorSynced) syncNotices.push('The calendar copy remains owned by the meeting creator and could not be changed under the current calendar-event policy.');

      if (saved.createdBy === session.user.id && saved.googleEventId && googleConnected) {
        try {
          await googleCalendarRequest(`/events/${encodeURIComponent(saved.googleEventId)}`, { method: 'PATCH', body: toGoogleEvent(saved, projects, user) });
        } catch (error) {
          syncNotices.push(`Google Calendar could not be updated: ${error.message}`);
        }
      } else if (!editingMeeting && syncGoogle && googleConnected) {
        try {
          const result = await googleCalendarRequest('/events', { method: 'POST', body: toGoogleEvent(saved, projects, user) });
          saved = await setMeetingGoogleEventId(saved.id, result.id, session.user.id);
        } catch (error) {
          syncNotices.push(`Not synced to Google Calendar: ${error.message}`);
        }
      } else if (saved.googleEventId && !googleConnected) {
        syncNotices.push('Reconnect Google Calendar to sync changes.');
      } else if (saved.googleEventId && saved.createdBy !== session.user.id) {
        syncNotices.push('Only its creator can sync this meeting with their Google Calendar.');
      }
      await refresh();
      setFormOpen(false);
      setEditingMeeting(null);
      setToast(syncNotices.length ? `Saved in PlanWise. ${syncNotices.join(' ')}` : (editingMeeting ? 'Meeting updated.' : 'Meeting scheduled and added to your calendar.'));
    } catch (error) {
      setPageError(error.message || 'Could not save this meeting.');
    }
  };

  const openEdit = (meeting) => {
    setSelectedMeeting(null);
    setEditingMeeting(meeting);
    setFormOpen(true);
  };
  const changeStatus = async (meeting, status) => {
    try {
      const saved = await saveMeeting({ ...meeting, status }, session.user.id);
      await refresh();
      setSelectedMeeting(saved);
      setToast(status === 'Cancelled' ? 'Meeting cancelled.' : 'Meeting marked complete.');
    } catch (error) {
      setPageError(error.message || 'Could not update this meeting.');
    }
  };
  const removeMeeting = async (meeting) => {
    const ownsGoogleCopy = meeting.createdBy === session.user.id;
    const confirmation = meeting.googleEventId && (!googleConnected || !ownsGoogleCopy)
      ? `Delete “${meeting.title}” from Planwise? Its Google Calendar copy will remain.`
      : `Delete “${meeting.title}” permanently? This also removes its Planwise Calendar event${meeting.googleEventId ? ' and Google Calendar copy' : ''}.`;
    if (!window.confirm(confirmation)) return;
    try {
      if (meeting.googleEventId && googleConnected && ownsGoogleCopy) {
        await googleCalendarRequest(`/events/${encodeURIComponent(meeting.googleEventId)}`, { method: 'DELETE' });
      }
      await deleteMeeting(meeting.id, session.user.id);
      await refresh();
      setSelectedMeeting(null);
      setToast(meeting.googleEventId && (!googleConnected || !ownsGoogleCopy) ? 'Deleted from PlanWise. The Google Calendar copy remains.' : 'Meeting deleted.');
    } catch (error) {
      setPageError(error.message || 'Could not delete this meeting.');
    }
  };
  const openMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setNotesDraft(meeting.notes || '');
    setActionDraft({ title: '', assignee: '' });
  };
  const saveNotes = async () => {
    if (!selectedMeeting) return;
    try {
      const saved = await saveMeeting({ ...selectedMeeting, notes: notesDraft }, session.user.id);
      setSelectedMeeting(saved);
      await refresh();
      setToast('Meeting notes saved.');
    } catch (error) {
      setPageError(error.message || 'Could not save meeting notes.');
    }
  };
  const addActionItem = async (event) => {
    event.preventDefault();
    if (!selectedMeeting || !actionDraft.title.trim()) return;
    const actionItems = [...(selectedMeeting.actionItems || []), {
      id: `action-${crypto.randomUUID()}`,
      title: actionDraft.title.trim(),
      assignee: actionDraft.assignee,
      taskId: '',
      done: false
    }];
    try {
      const saved = await saveMeeting({ ...selectedMeeting, actionItems }, session.user.id);
      setSelectedMeeting(saved);
      setActionDraft({ title: '', assignee: '' });
      await refresh();
    } catch (error) {
      setPageError(error.message || 'Could not add this action item.');
    }
  };
  const toggleActionItem = async (item) => {
    if (!selectedMeeting) return;
    try {
      const saved = await saveMeeting({
        ...selectedMeeting,
        actionItems: selectedMeeting.actionItems.map((action) => action.id === item.id ? { ...action, done: !action.done } : action)
      }, session.user.id);
      setSelectedMeeting(saved);
      await refresh();
    } catch (error) {
      setPageError(error.message || 'Could not update this action item.');
    }
  };
  const convertActionToTask = async (item) => {
    if (!selectedMeeting || item.taskId) return;
    const task = {
      title: item.title,
      description: `Action item from meeting: ${selectedMeeting.title}${item.assignee ? ` · Assigned to ${item.assignee}` : ''}`,
      priority: 'Medium',
      dueDate: selectedMeeting.date,
      dueTime: selectedMeeting.endTime,
      category: 'Work',
      done: item.done,
      projectId: selectedMeeting.projectId || '',
      assigneeIds: item.assignee ? [item.assignee] : []
    };
    try {
      const createdTask = await saveTask(task, session.user.id);
      const saved = await saveMeeting({
        ...selectedMeeting,
        actionItems: selectedMeeting.actionItems.map((action) => action.id === item.id ? { ...action, taskId: createdTask.id } : action)
      }, session.user.id);
      setSelectedMeeting(saved);
      await refresh();
      setToast('Action item added to Planwise Tasks.');
    } catch (error) {
      setPageError(error.message || 'Could not create a task from this action item.');
    }
  };

  const counts = statusFilters.slice(1).reduce((result, status) => {
    result[status] = meetings.filter((meeting) => getStatus(meeting) === status).length;
    return result;
  }, {});

  return <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="dashboard">
    <section className="meetings-page page-transition">
      <header className="meetings-page-header"><div><span className="panel-kicker">Bring the right people together</span><h1>Meetings</h1><p>Plan conversations, capture decisions, and keep the next steps moving.</p></div><Button onClick={() => { setEditingMeeting(null); setFormOpen(true); }}>+ Schedule Meeting</Button></header>
      <div className="meetings-summary-grid">
        <article><span className="meeting-summary-icon summary-blue">◷</span><div><small>Upcoming</small><strong>{counts.Upcoming || 0}</strong></div></article>
        <article><span className="meeting-summary-icon summary-purple">◌</span><div><small>In progress</small><strong>{counts['In Progress'] || 0}</strong></div></article>
        <article><span className="meeting-summary-icon summary-green">✓</span><div><small>Completed</small><strong>{counts.Completed || 0}</strong></div></article>
        <article><span className="meeting-summary-icon summary-amber">◎</span><div><small>Participants</small><strong>{new Set(meetings.flatMap((meeting) => meeting.participants || [])).size}</strong></div></article>
      </div>
      <div className="meetings-toolbar">
        <label className="meetings-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meetings, projects, or people…" aria-label="Search meetings" /></label>
        <div className="meetings-filter-wrap"><Button type="button" variant="secondary" className="meetings-filter-button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>☷ Filter{statusFilter !== 'All' || projectFilter ? ' · 1' : ''}</Button>
          {filterOpen && <div className="meetings-filter-popover"><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusFilters.map((status) => <option key={status}>{status}</option>)}</select></label><label>Project<select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button type="button" onClick={() => { setStatusFilter('All'); setProjectFilter(''); }}>Clear filters</button></div>}
        </div>
      </div>
      <div className="meeting-status-tabs" role="tablist" aria-label="Meeting status">
        {statusFilters.map((status) => <button type="button" key={status} role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}><span>{status}</span>{status !== 'All' && <small>{counts[status] || 0}</small>}</button>)}
      </div>
      {loading ? <div className="meetings-loading" role="status"><span className="loading-spinner" />Loading meetings…</div> : visibleMeetings.length ? <section className="meetings-list" aria-live="polite">
        {visibleMeetings.map((meeting, index) => {
          const project = projects.find((item) => item.id === meeting.projectId);
          return <MeetingCard key={meeting.id} meeting={meeting} projectName={project?.name} teamMembers={teamMembers} onOpen={() => openMeeting(meeting)} onEdit={() => openEdit(meeting)} onCancel={() => { if (window.confirm(`Cancel “${meeting.title}”?`)) changeStatus(meeting, 'Cancelled'); }} onDelete={() => removeMeeting(meeting)} onJoin={() => window.open(meeting.meetingLink, '_blank', 'noopener,noreferrer')} onComplete={() => changeStatus(meeting, 'Completed')} style={{ '--meeting-delay': `${index * 45}ms` }} />;
        })}
      </section> : <div className="meetings-empty"><span>◌</span><strong>{meetings.length ? 'No meetings match your search' : 'Make room for a great conversation'}</strong><p>{meetings.length ? 'Try another search or filter.' : 'Schedule your first meeting and keep the whole team in sync.'}</p>{!meetings.length && <Button onClick={() => { setEditingMeeting(null); setFormOpen(true); }}>Schedule a meeting</Button>}</div>}
      {pageError && <div className="meetings-error" role="alert"><span>{pageError}</span><button type="button" onClick={() => setPageError('')} aria-label="Dismiss error">×</button></div>}
    </section>

    {formOpen && <MeetingForm meeting={editingMeeting} projects={projects} teamMembers={teamMembers} currentUserName={currentUserName} googleConnected={googleConnected} onClose={() => setFormOpen(false)} onSave={save} />}

    {selectedMeeting && <div className="meetings-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMeeting(null); }}>
      <section className="meetings-modal meeting-detail-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-detail-title">
        <div className="meeting-detail-accent" />
        <div className="meetings-modal-heading"><div><span className={`meeting-status meeting-status-${getStatus(selectedMeeting).toLowerCase().replace(/\s/g, '-')}`}>{getStatus(selectedMeeting)}</span><h2 id="meeting-detail-title">{selectedMeeting.title}</h2><p>{selectedMeeting.meetingType || 'Team meeting'}</p></div><button type="button" onClick={() => setSelectedMeeting(null)} aria-label="Close meeting details">×</button></div>
        <div className="meeting-detail-meta"><p><span>◷</span>{dateLabel(selectedMeeting.date)} · {timeLabel(selectedMeeting.startTime)}–{timeLabel(selectedMeeting.endTime)}</p><p><span>◎</span>Organized by {selectedMeeting.organizer || currentUserName}</p><p><span>◈</span>{projects.find((project) => project.id === selectedMeeting.projectId)?.name || 'No project'}</p>{selectedMeeting.location && <p><span>⌖</span>{selectedMeeting.location}</p>}{selectedMeeting.meetingLink && <p><span>↗</span><a href={selectedMeeting.meetingLink} target="_blank" rel="noreferrer">{selectedMeeting.meetingLink}</a></p>}<p><span>◴</span>{selectedMeeting.reminder ? `${selectedMeeting.reminder} minutes before` : 'No reminder'}</p></div>
        {selectedMeeting.description && <p className="meeting-detail-description">{selectedMeeting.description}</p>}
        <section className="meeting-participants-detail"><h3>Participants <span>{selectedMeeting.participants?.length || 0}</span></h3><div>{selectedMeeting.participants?.map((person) => <span key={person} title={participantLabel(person)}>{initials(participantLabel(person))}</span>)}</div></section>
        <label className="meeting-field meeting-notes-field">Meeting notes<textarea rows="4" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="Capture decisions, highlights, and useful context…" /><Button type="button" variant="secondary" onClick={saveNotes}>Save notes</Button></label>
        <section className="meeting-action-section"><h3>Action items <span>{selectedMeeting.actionItems?.length || 0}</span></h3>
          {selectedMeeting.actionItems?.length > 0 && <div className="meeting-action-list">{selectedMeeting.actionItems.map((item) => <article key={item.id}><button type="button" className={`meeting-action-check${item.done ? ' is-checked' : ''}`} onClick={() => toggleActionItem(item)} aria-label={`${item.done ? 'Reopen' : 'Complete'} ${item.title}`}>{item.done ? '✓' : ''}</button><div><strong className={item.done ? 'is-done' : ''}>{item.title}</strong><span>{item.assignee ? `Assigned to ${participantLabel(item.assignee)}` : 'Unassigned'}</span></div>{item.taskId ? <span className="meeting-task-created">In Tasks</span> : <button type="button" className="meeting-convert-task" onClick={() => convertActionToTask(item)}>+ Task</button>}</article>)}</div>}
          <form className="meeting-action-form" onSubmit={addActionItem}><input required value={actionDraft.title} onChange={(event) => setActionDraft({ ...actionDraft, title: event.target.value })} placeholder="Add an action item…" aria-label="Action item" /><select value={actionDraft.assignee} onChange={(event) => setActionDraft({ ...actionDraft, assignee: event.target.value })} aria-label="Assign action item"><option value="">Assign to…</option>{teamMembers.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select><Button type="submit" size="sm">Add</Button></form>
        </section>
        <div className="meetings-modal-actions"><Button variant="secondary" onClick={() => openEdit(selectedMeeting)}>Edit meeting</Button>{['Upcoming', 'In Progress'].includes(getStatus(selectedMeeting)) && <Button variant="secondary" onClick={() => { if (window.confirm(`Cancel “${selectedMeeting.title}”?`)) changeStatus(selectedMeeting, 'Cancelled'); }}>Cancel meeting</Button>}{selectedMeeting.meetingLink && !['Cancelled', 'Completed'].includes(getStatus(selectedMeeting)) && <Button onClick={() => window.open(selectedMeeting.meetingLink, '_blank', 'noopener,noreferrer')}>Join meeting ↗</Button>}</div>
      </section>
    </div>}
    {toast && <div className="meetings-toast" role="status">{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notification">×</button></div>}
  </DashboardLayout>;
}
