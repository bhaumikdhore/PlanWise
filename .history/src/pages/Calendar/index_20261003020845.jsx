import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getCalendarEvents, saveCalendarEvent, saveImportedGoogleEvents, deleteCalendarEvent } from '../../services/calendar/calendarService';
import { googleCalendarRequest, hasCalendarBackend } from '../../services/calendar/googleCalendarApi';
import { getProjects } from '../../services/projects/projectService';
import { deleteMeeting, getMeetings, saveMeeting } from '../../services/meetings/meetingService';

const views = ['Month', 'Week', 'Day', 'Agenda'];
const categories = ['Meeting', 'Planning', 'Focus', 'Personal'];
const colors = ['blue', 'purple', 'green', 'amber', 'rose'];
const reminders = [
  { value: '0', label: 'No reminder' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' }
];
const blankEvent = () => ({ title: '', description: '', date: dateKey(new Date()), startTime: '09:00', endTime: '10:00', location: '', meetingLink: '', projectId: '', participants: '', reminder: '10', category: 'Meeting', color: 'blue', sourceMeetingId: '' });

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
function startOfWeek(date) {
  return addDays(date, -date.getDay());
}
function monthTitle(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function dayTitle(date, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  return date.toLocaleDateString('en-US', options);
}
function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2020, 0, 1, hour, minute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function eventFromGoogle(item, projects) {
  const start = item.start?.dateTime ? new Date(item.start.dateTime) : null;
  const end = item.end?.dateTime ? new Date(item.end.dateTime) : null;
  const allDayDate = item.start?.date;
  const time = (value) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const privateProperties = item.extendedProperties?.private || {};
  const requestedProjectId = privateProperties.planwiseProjectId || '';
  const projectId = projects.find((project) => project.id === requestedProjectId)?.id || '';
  const embeddedMeetingLink = item.description?.match(/^Meeting link:\s*(https?:\/\/\S+)/im)?.[1] || '';
  const description = item.description?.replace(/(?:\r?\n){2}Meeting link:\s*https?:\/\/\S+\s*$/i, '') || '';
  const projectName = projects.find((project) => project.id === projectId)?.name || '';
  const colorMap = { '1': 'purple', '2': 'green', '5': 'amber', '9': 'blue', '10': 'green', '11': 'rose' };
  return {
    id: `google-${item.id}`,
    googleEventId: item.id,
    title: item.summary || '(No title)',
    description,
    date: allDayDate || (start ? dateKey(start) : dateKey(new Date())),
    startTime: start ? time(start) : '09:00',
    endTime: end ? time(end) : '10:00',
    allDay: Boolean(allDayDate),
    location: item.location || '',
    meetingLink: item.hangoutLink || item.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri || embeddedMeetingLink,
    projectId,
    projectName,
    participants: (item.attendees || []).map((attendee) => attendee.email).filter(Boolean),
    reminder: item.reminders?.overrides?.[0]?.minutes || 0,
    category: privateProperties.planwiseCategory || 'Meeting',
    color: privateProperties.planwiseColor || colorMap[item.colorId] || 'blue',
    status: item.status,
    provider: 'google'
  };
}
function toGoogleEvent(event) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: event.title,
    description: `${event.description || ''}${event.meetingLink ? `\n\nMeeting link: ${event.meetingLink}` : ''}`,
    location: event.location || '',
    start: event.allDay ? { date: event.date } : { dateTime: `${event.date}T${event.startTime}:00`, timeZone },
    end: event.allDay ? { date: dateKey(addDays(parseDate(event.date), 1)) } : { dateTime: `${event.date}T${event.endTime}:00`, timeZone },
    reminders: Number(event.reminder) > 0
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: Number(event.reminder) }] }
      : { useDefault: false }
  };
  body.extendedProperties = {
    private: {
      ...(event.projectId ? { planwiseProjectId: event.projectId } : {}),
      planwiseCategory: event.category,
      planwiseColor: event.color
    }
  };
  const colorId = { purple: '1', green: '2', amber: '5', blue: '9', rose: '11' }[event.color];
  if (colorId) body.colorId = colorId;
  const attendees = event.participants.filter((participant) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant));
  if (attendees.length) body.attendees = attendees.map((email) => ({ email }));
  return body;
}
function eventSort(a, b) {
  return `${a.date} ${a.allDay ? '00:00' : a.startTime}`.localeCompare(`${b.date} ${b.allDay ? '00:00' : b.startTime}`);
}
function EventPill({ event, onClick, draggable = false, compact = false }) {
  return <button type="button" draggable={draggable && event.provider !== 'meeting'} onDragStart={(e) => { e.dataTransfer.setData('text/plain', event.id); e.dataTransfer.effectAllowed = 'move'; }} className={`calendar-event-pill event-color-${event.color || 'blue'}${compact ? ' is-compact' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(); }} title={`${event.title} · ${event.startTime ? formatTime(event.startTime) : 'All day'}`}>
    <span className="calendar-event-dot" /><span className="calendar-event-pill-title">{event.title}</span>{!compact && event.startTime && <small>{formatTime(event.startTime)}</small>}
  </button>;
}

export default function CalendarPage({ onNavigate, onLogout, session }) {
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeView, setActiveView] = useState('Month');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [draft, setDraft] = useState(blankEvent);
  const [formError, setFormError] = useState('');
  const [googleStatus, setGoogleStatus] = useState({ loading: true, configured: false, connected: false, lastSyncedAt: null });
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [toast, setToast] = useState('');
  const [pageError, setPageError] = useState('');
  const [oauthMessage, setOauthMessage] = useState('');
  const user = {
    id: session.user.id,
    email: session.user.email || '',
    profile: {
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      email: session.user.email || ''
    }
  };
  const activeProjects = projects.filter((project) => !project.archived);
  const teamOptions = [...new Set([...activeProjects.flatMap((project) => project.members), ...meetings.flatMap((meeting) => meeting.participants || [])])].sort();
  const isToday = dateKey(new Date()) === dateKey(selectedDate);
  const googleConnected = googleStatus.configured && googleStatus.connected;

  const refreshEvents = async () => {
    const nextEvents = await getCalendarEvents();
    setEvents(nextEvents);
    return nextEvents;
  };
  const refreshCalendarData = async () => {
    const [nextEvents, nextMeetings] = await Promise.all([getCalendarEvents(), getMeetings()]);
    setEvents(nextEvents);
    setMeetings(nextMeetings);
  };
  const refreshGoogleStatus = async () => {
    if (!hasCalendarBackend) {
      setGoogleStatus({ loading: false, configured: false, connected: false, lastSyncedAt: null });
      return;
    }
    try {
      const status = await googleCalendarRequest('/status');
      setGoogleStatus({ loading: false, ...status });
    } catch (error) {
      setGoogleStatus((current) => ({ ...current, loading: false }));
      setPageError(error.message);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(user), getMeetings(), getCalendarEvents()]).then(([nextProjects, nextMeetings, nextEvents]) => {
      if (!active) return;
      setProjects(nextProjects);
      setMeetings(nextMeetings);
      setEvents(nextEvents);
    }).catch((error) => {
      if (active) setPageError(error.message || 'Could not load project calendar data.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    refreshGoogleStatus();
    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get('google');
    if (googleResult) {
      setOauthMessage(googleResult === 'connected' ? 'Google Calendar connected. Sync your events to get started.' : 'Google Calendar could not be connected. Check the Google OAuth redirect URI, server-side function secrets, and Edge Function logs, then try again.');
      window.history.replaceState({}, '', '/calendar');
      setIntegrationOpen(true);
    }
    return () => { active = false; };
  }, [session.user.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [selectedDate]);

  const range = useMemo(() => {
    if (activeView === 'Day') return { start: selectedDate, end: addDays(selectedDate, 1) };
    if (activeView === 'Week') return { start: startOfWeek(selectedDate), end: addDays(startOfWeek(selectedDate), 7) };
    if (activeView === 'Month') return { start: calendarDays[0], end: addDays(calendarDays[41], 1) };
    return { start: selectedDate, end: addDays(selectedDate, 31) };
  }, [activeView, selectedDate, calendarDays]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const date = parseDate(event.date);
    return date >= range.start && date < range.end;
  }).sort(eventSort), [events, range]);

  const dateEvents = (date) => events.filter((event) => event.date === dateKey(date)).sort(eventSort);
  const shiftDate = (amount) => {
    if (activeView === 'Month') setSelectedDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    else if (activeView === 'Week') setSelectedDate((current) => addDays(current, amount * 7));
    else setSelectedDate((current) => addDays(current, amount));
  };
  const openCreate = (date = selectedDate, time = '09:00', meeting = null) => {
    const initial = blankEvent();
    initial.date = dateKey(date);
    initial.startTime = meeting?.time || time;
    const [hour, minute] = initial.startTime.split(':').map(Number);
    const endMinutes = hour * 60 + minute + (Number(meeting?.duration) || 60);
    initial.endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    if (meeting) {
      initial.title = meeting.title;
      initial.description = `Created from project meeting${projects.find((project) => project.id === meeting.projectId) ? ` · ${projects.find((project) => project.id === meeting.projectId).name}` : ''}.`;
      initial.projectId = meeting.projectId || '';
      initial.participants = (meeting.attendees || []).join(', ');
      initial.category = 'Meeting';
      initial.color = 'purple';
      initial.sourceMeetingId = meeting.id;
    }
    setEditingEvent(null);
    setDraft(initial);
    setFormError('');
    setSyncToGoogle(false);
    setSelectedEvent(null);
    setFormOpen(true);
  };
  const openEdit = (event) => {
    setEditingEvent(event);
    setDraft({ ...event, participants: event.participants.join(', '), reminder: String(event.reminder ?? 0) });
    setFormError('');
    setSyncToGoogle(false);
    setSelectedEvent(null);
    setFormOpen(true);
  };
  const moveEvent = async (eventId, date, time) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || event.meetingId || event.provider === 'meeting') return;
    if (event.userId !== session.user.id) {
      setPageError('Only the event owner can reschedule this shared event.');
      return;
    }
    const updated = { ...event, date };
    if (time && !event.allDay) {
      const duration = Math.max(15, (Number(event.endTime.slice(0, 2)) * 60 + Number(event.endTime.slice(3)) - Number(event.startTime.slice(0, 2)) * 60 - Number(event.startTime.slice(3))));
      const [hour, minute] = time.split(':').map(Number);
      const end = Math.min(hour * 60 + minute + duration, 23 * 60 + 59);
      updated.startTime = time;
      updated.endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    }
    if (event.googleEventId && !googleConnected) {
      setPageError('Reconnect Google Calendar before rescheduling this Google event.');
      return;
    }
    try {
      await saveCalendarEvent(updated, session.user.id);
      if (event.googleEventId) {
        try {
          await googleCalendarRequest(`/events/${encodeURIComponent(event.googleEventId)}`, { method: 'PATCH', body: toGoogleEvent(updated) });
        } catch (error) {
          setToast(`Moved in PlanWise, but not Google Calendar: ${error.message}`);
        }
      }
      await refreshEvents();
      setToast((current) => current || `Moved “${event.title}” to ${dayTitle(parseDate(date), { month: 'short', day: 'numeric' })}.`);
    } catch (error) {
      setPageError(error.message || 'Could not reschedule this event.');
    }
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!draft.title.trim()) { setFormError('Add an event title before saving.'); return; }
    if (!draft.date || (!draft.allDay && (!draft.startTime || !draft.endTime))) { setFormError('Choose an event date and start and end times.'); return; }
    if (!draft.allDay && draft.endTime <= draft.startTime) { setFormError('The end time must be after the start time.'); return; }
    if (draft.meetingLink && !/^https?:\/\//i.test(draft.meetingLink)) { setFormError('Meeting links must start with https:// or http://.'); return; }
    const nextEvent = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      participants: (Array.isArray(draft.participants) ? draft.participants : draft.participants.split(',')).map((participant) => participant.trim()).filter(Boolean),
      reminder: Number(draft.reminder || 0),
      projectName: projects.find((project) => project.id === draft.projectId)?.name || ''
    };
    try {
      if (editingEvent?.googleEventId && !googleConnected) {
        setFormError('Reconnect Google Calendar before editing this Google event.');
        return;
      }
      if (editingEvent && editingEvent.userId !== session.user.id) {
        setFormError('Only the event owner can edit this shared calendar event.');
        return;
      }

      let syncNotice = '';
      if (editingEvent?.meetingId) {
        const originalMeeting = meetings.find((meeting) => meeting.id === editingEvent.meetingId);
        if (!originalMeeting) throw new Error('The linked meeting is not available to your account.');
        const savedMeeting = await saveMeeting({
          ...originalMeeting,
          title: nextEvent.title,
          description: nextEvent.description,
          date: nextEvent.date,
          startTime: nextEvent.startTime,
          endTime: nextEvent.endTime,
          location: nextEvent.location,
          meetingLink: nextEvent.meetingLink,
          projectId: nextEvent.projectId,
          reminder: nextEvent.reminder,
          participants: originalMeeting.participants
        }, session.user.id);
        if (savedMeeting.googleEventId && googleConnected && savedMeeting.createdBy === session.user.id) {
          try {
            await googleCalendarRequest(`/events/${encodeURIComponent(savedMeeting.googleEventId)}`, { method: 'PATCH', body: toGoogleEvent(savedMeeting) });
          } catch (error) {
            syncNotice = `Meeting saved in PlanWise, but Google Calendar could not be updated: ${error.message}`;
          }
        }
      } else {
        let savedEvent = await saveCalendarEvent({ ...nextEvent, id: editingEvent?.id, userId: session.user.id }, session.user.id);
        if (editingEvent?.googleEventId && googleConnected) {
          try {
            await googleCalendarRequest(`/events/${encodeURIComponent(editingEvent.googleEventId)}`, { method: 'PATCH', body: toGoogleEvent(nextEvent) });
          } catch (error) {
            syncNotice = `Event saved in PlanWise, but Google Calendar could not be updated: ${error.message}`;
          }
        } else if (!editingEvent && syncToGoogle) {
          try {
            const result = await googleCalendarRequest('/events', { method: 'POST', body: toGoogleEvent(nextEvent) });
            savedEvent = await saveCalendarEvent({ ...savedEvent, provider: 'google', googleEventId: result.id }, session.user.id);
          } catch (error) {
            syncNotice = `Event saved in PlanWise, but not Google Calendar: ${error.message}`;
          }
        }
      }
      await refreshCalendarData();
      setFormOpen(false);
      setToast(syncNotice || (editingEvent ? 'Event updated.' : 'Event added to your calendar.'));
    } catch (error) {
      setFormError(error.message || 'Could not save this event.');
    }
  };

  const deleteEvent = async (event) => {
    if (event.userId !== session.user.id) {
      setPageError('Only the event owner can delete this shared calendar event.');
      return;
    }
    const message = event.googleEventId
      ? googleStatus.connected
        ? `Delete “${event.title}” from Google Calendar and Planwise?`
        : `Delete “${event.title}” from Planwise? Its Google Calendar copy will remain and may reappear after syncing.`
      : `Delete “${event.title}” from your calendar?`;
    if (!window.confirm(message)) return;
    try {
      if (event.meetingId) {
        const meeting = meetings.find((item) => item.id === event.meetingId);
        if (!meeting) throw new Error('The linked meeting is not available to your account.');
        if (meeting.googleEventId && googleConnected && meeting.createdBy === session.user.id) {
          await googleCalendarRequest(`/events/${encodeURIComponent(meeting.googleEventId)}`, { method: 'DELETE' });
        }
        await deleteMeeting(meeting.id, session.user.id);
      } else {
        if (event.googleEventId && googleConnected) {
          await googleCalendarRequest(`/events/${encodeURIComponent(event.googleEventId)}`, { method: 'DELETE' });
        }
        await deleteCalendarEvent(event.id, session.user.id);
      }
      await refreshCalendarData();
      setSelectedEvent(null);
      setToast(event.googleEventId && !googleConnected ? 'Removed from Planwise. The Google Calendar copy remains.' : 'Event deleted.');
    } catch (error) {
      setPageError(`Could not delete the Google Calendar event: ${error.message}`);
    }
  };

  const connectGoogle = async () => {
    setPageError('');
    try {
      const result = await googleCalendarRequest('/connect', { method: 'POST' });
      window.location.assign(result.authUrl);
    } catch (error) {
      setPageError(error.message);
      await refreshGoogleStatus();
    }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    setPageError('');
    try {
      const { start, end } = range;
      const query = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString() });
      const result = await googleCalendarRequest(`/events?${query}`);
      const imported = result.items.map((event) => eventFromGoogle(event, activeProjects));
      const nextEvents = await saveImportedGoogleEvents(imported, { start: start.toISOString(), end: end.toISOString() }, session.user.id);
      setEvents(nextEvents);
      await refreshGoogleStatus();
      setToast(`${imported.filter((event) => event.status !== 'cancelled').length} Google Calendar event${imported.length === 1 ? '' : 's'} synced.`);
    } catch (error) {
      setPageError(error.message);
      if (/reconnect|invalid_grant/i.test(error.message)) setGoogleStatus((current) => ({ ...current, connected: false }));
    } finally {
      setSyncing(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? Google events already imported into Planwise will remain on your calendar.')) return;
    try {
      await googleCalendarRequest('/disconnect', { method: 'POST' });
      setGoogleStatus((current) => ({ ...current, connected: false, lastSyncedAt: null }));
      setToast('Google Calendar disconnected.');
    } catch (error) {
      setPageError(error.message);
    }
  };

  const dropOnDate = (event, date, time) => {
    event.preventDefault();
    const eventId = event.dataTransfer.getData('text/plain');
    if (eventId) moveEvent(eventId, dateKey(date), time);
  };
  const eventColor = (event) => event.provider === 'google' ? 'Google Calendar' : event.provider === 'meeting' ? 'Project meeting' : event.category;

  const monthHeading = activeView === 'Month' ? monthTitle(selectedDate)
    : activeView === 'Week' ? `${dayTitle(startOfWeek(selectedDate), { month: 'short', day: 'numeric' })} – ${dayTitle(addDays(startOfWeek(selectedDate), 6), { month: 'short', day: 'numeric', year: 'numeric' })}`
      : activeView === 'Day' ? dayTitle(selectedDate) : `Upcoming · ${dayTitle(selectedDate, { month: 'long', day: 'numeric' })}`;

  const eventDetails = selectedEvent && (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvent(null); }}>
      <section className="calendar-modal calendar-event-details" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">
        <div className={`calendar-modal-accent event-color-${selectedEvent.color || 'blue'}`} />
        <div className="calendar-modal-heading"><div><span className="calendar-event-source">{eventColor(selectedEvent)}</span><h2 id="calendar-event-title">{selectedEvent.title}</h2></div><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close event details">×</button></div>
        <div className="calendar-detail-fields">
          <p><span>◷</span>{dayTitle(parseDate(selectedEvent.date))}{selectedEvent.allDay ? ' · All day' : ` · ${formatTime(selectedEvent.startTime)} – ${formatTime(selectedEvent.endTime)}`}</p>
          {selectedEvent.description && <p><span>☰</span>{selectedEvent.description}</p>}
          {selectedEvent.location && <p><span>⌖</span>{selectedEvent.location}</p>}
          {selectedEvent.meetingLink && <p><span>↗</span><a href={selectedEvent.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a></p>}
          {selectedEvent.projectId && <p><span>◫</span>{selectedEvent.projectName || projects.find((project) => project.id === selectedEvent.projectId)?.name || 'Project'}</p>}
          {selectedEvent.participants?.length > 0 && <p><span>◎</span>{selectedEvent.participants.join(', ')}</p>}
          <p><span>◴</span>{selectedEvent.reminder ? `${selectedEvent.reminder} minute reminder` : 'No reminder'}</p>
          {selectedEvent.provider === 'google' && <p className="calendar-source-note">Synced with Google Calendar</p>}
        </div>
        <div className="calendar-modal-actions">
          {selectedEvent.meetingId ? <Button variant="secondary" onClick={() => openEdit(selectedEvent)}>Edit meeting</Button> : <Button variant="secondary" onClick={() => openEdit(selectedEvent)}>Edit event</Button>}
          <Button variant="secondary" className="calendar-delete-button" onClick={() => deleteEvent(selectedEvent)} disabled={selectedEvent.userId !== session.user.id}>Delete</Button>
        </div>
      </section>
    </div>
  );

  return <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="dashboard">
    <section className="calendar-page page-transition">
      <header className="calendar-page-header"><div><span className="panel-kicker">Make time for what matters</span><h1>Calendar</h1><p>Your plans, project meetings, and events in one place.</p></div><div className="calendar-header-actions"><Button variant="secondary" onClick={() => setIntegrationOpen((open) => !open)} aria-expanded={integrationOpen}>◉ Google Calendar</Button><Button onClick={() => openCreate()}>+ Create event</Button></div></header>

      <section className={`google-calendar-panel${integrationOpen ? ' is-open' : ''}`} aria-label="Google Calendar integration">
        <div className="google-calendar-status">
          <span className={`google-status-mark${googleStatus.connected ? ' is-connected' : ''}`}>G</span>
          <div className="google-status-copy"><strong>Google Calendar</strong><span>{googleStatus.loading ? 'Checking connection…' : googleConnected ? 'Connected · Google events can sync with Planwise' : googleStatus.connected ? 'Connection exists, but the server integration needs configuration' : 'Not connected · Your Planwise calendar works as usual'}</span></div>
          <div className="google-status-actions">
            {googleConnected ? <><span className="google-sync-time">{googleStatus.lastSyncedAt ? `Last synced ${new Date(googleStatus.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}</span><Button variant="secondary" size="sm" disabled={syncing} onClick={syncGoogle}>{syncing ? 'Syncing…' : 'Sync now'}</Button><button type="button" className="google-disconnect" onClick={disconnectGoogle}>Disconnect</button></>
              : <Button size="sm" disabled={googleStatus.loading} onClick={connectGoogle}>Connect Google Calendar</Button>}
            <button type="button" className="google-panel-toggle" onClick={() => setIntegrationOpen((open) => !open)} aria-label={integrationOpen ? 'Hide Google Calendar settings' : 'Show Google Calendar settings'}>{integrationOpen ? '⌃' : '⌄'}</button>
          </div>
        </div>
        {integrationOpen && <div className="google-integration-details">
          <div><strong>{googleStatus.configured ? 'Secure Google Calendar sync' : 'Google Calendar setup required'}</strong><p>{googleStatus.configured ? 'Events are imported from Google when you sync. New and edited events can be synced when you choose to. Google tokens are stored encrypted on the server, never in your browser.' : 'Connect the Google Calendar API credentials and Supabase Edge Function secrets to enable OAuth. Planwise calendar events remain available locally.'}</p></div>
          {!googleStatus.configured && <div className="google-setup-hint"><span>Required server-side setup</span><code>GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY · APP_URL · SUPABASE_SERVICE_ROLE_KEY</code><small>Google OAuth redirect URI: {import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar/callback` : 'Set VITE_SUPABASE_URL first'} · Scope: calendar events only. Never put Google secrets or the Supabase service-role key in frontend variables.</small></div>}
          {oauthMessage && <p className="calendar-notice" role="status">{oauthMessage}</p>}
        </div>}
      </section>

      {pageError && <div className="calendar-inline-error" role="alert"><span>{pageError}</span><button type="button" onClick={() => setPageError('')} aria-label="Dismiss error">×</button></div>}
      <section className="calendar-surface">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar-heading"><h2>{monthHeading}</h2><div className="calendar-navigation"><button type="button" onClick={() => shiftDate(-1)} aria-label="Previous period">‹</button><button type="button" onClick={() => setSelectedDate(new Date())} disabled={isToday}>Today</button><button type="button" onClick={() => shiftDate(1)} aria-label="Next period">›</button></div></div>
          <div className="calendar-view-switcher" role="tablist" aria-label="Calendar view">{views.map((view) => <button key={view} type="button" role="tab" aria-selected={activeView === view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>{view}</button>)}</div>
        </div>
        {loading ? <div className="calendar-loading" role="status"><span className="loading-spinner" />Loading your calendar…</div> : <>
          {activeView === 'Month' && <div className="calendar-month-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {calendarDays.map((date) => <div key={dateKey(date)} className={`calendar-month-day${date.getMonth() !== selectedDate.getMonth() ? ' is-outside' : ''}${dateKey(date) === dateKey(new Date()) ? ' is-today' : ''}${dateKey(date) === dateKey(selectedDate) ? ' is-selected' : ''}`} onClick={() => setSelectedDate(date)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnDate(event, date)}>
              <button type="button" className="calendar-date-number" onClick={() => { setSelectedDate(date); setActiveView('Day'); }}>{date.getDate()}</button>
              <div className="calendar-day-events">{dateEvents(date).slice(0, 3).map((item) => <EventPill key={item.id} event={item} onClick={() => item.provider === 'meeting' ? setSelectedEvent(item) : setSelectedEvent(item)} draggable />)}{dateEvents(date).length > 3 && <button type="button" className="calendar-more-events" onClick={() => { setSelectedDate(date); setActiveView('Day'); }}>+{dateEvents(date).length - 3} more</button>}</div>
              <button type="button" className="calendar-day-add" onClick={(event) => { event.stopPropagation(); openCreate(date); }} aria-label={`Create event on ${dayTitle(date)}`}>+</button>
            </div>)}
          </div>}
          {(activeView === 'Week' || activeView === 'Day') && <TimeGrid view={activeView} date={selectedDate} events={events} onSelectEvent={setSelectedEvent} onCreate={openCreate} onDrop={dropOnDate} />}
          {activeView === 'Agenda' && <div className="calendar-agenda">{visibleEvents.length ? visibleEvents.map((item) => <article className="calendar-agenda-day" key={item.id}><time>{dayTitle(parseDate(item.date), { weekday: 'short', month: 'short', day: 'numeric' })}</time><EventPill event={item} onClick={() => setSelectedEvent(item)} /><button type="button" onClick={() => setSelectedEvent(item)}>Details</button></article>) : <div className="calendar-empty"><span>◷</span><strong>No events in this range</strong><p>Enjoy the open space or create a new event.</p><Button onClick={() => openCreate(selectedDate)}>Create event</Button></div>}</div>}
        </>}
        {!loading && activeView !== 'Agenda' && visibleEvents.length === 0 && <div className="calendar-period-empty"><span>No events in this period</span><button type="button" onClick={() => openCreate(selectedDate)}>Add an event</button></div>}
        <div className="calendar-legend"><span><i className="event-color-blue" />Planwise</span><span><i className="event-color-purple" />Meetings</span><span><i className="event-color-google" />Google Calendar</span><span className="calendar-drag-hint">Drag events to reschedule</span></div>
      </section>
    </section>

    {formOpen && <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}><form className="calendar-modal calendar-event-form" onSubmit={submitEvent} role="dialog" aria-modal="true" aria-labelledby="calendar-form-title">
      <div className="calendar-modal-heading"><div><span className="panel-kicker">{editingEvent ? 'Update your plans' : 'Add to your calendar'}</span><h2 id="calendar-form-title">{editingEvent ? 'Edit event' : 'Create an event'}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Close event form">×</button></div>
      <label className="calendar-form-label">Title<input autoFocus required maxLength="160" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What’s happening?" /></label>
      <label className="calendar-form-label">Description<textarea rows="2" maxLength="2000" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add a few details…" /></label>
      <label className="calendar-all-day"><input type="checkbox" checked={Boolean(draft.allDay)} onChange={(event) => setDraft({ ...draft, allDay: event.target.checked })} />All day</label>
      <div className="calendar-form-grid"><label className="calendar-form-label">Date<input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>{!draft.allDay && <><label className="calendar-form-label">Starts<input type="time" required value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label className="calendar-form-label">Ends<input type="time" required value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></>}</div>
      <div className="calendar-form-grid"><label className="calendar-form-label">Location<input maxLength="250" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Add a location" /></label><label className="calendar-form-label">Meeting link<input type="url" value={draft.meetingLink} onChange={(event) => setDraft({ ...draft, meetingLink: event.target.value })} placeholder="https://…" /></label></div>
      <label className="calendar-form-label">Project<select value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label className="calendar-form-label">Participants<input list="calendar-team-options" value={draft.participants} onChange={(event) => setDraft({ ...draft, participants: event.target.value })} placeholder="Names or email addresses, separated by commas" /><datalist id="calendar-team-options">{teamOptions.map((member) => <option key={member} value={member} />)}</datalist><small>Separate names or email addresses with commas.</small></label>
      <div className="calendar-form-grid"><label className="calendar-form-label">Reminder<select value={draft.reminder} onChange={(event) => setDraft({ ...draft, reminder: event.target.value })}>{reminders.map((reminder) => <option key={reminder.value} value={reminder.value}>{reminder.label}</option>)}</select></label><label className="calendar-form-label">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
      <fieldset className="calendar-color-picker"><legend>Event color</legend>{colors.map((color) => <label key={color} className={`calendar-color-choice event-color-${color}`}><input type="radio" name="event-color" value={color} checked={draft.color === color} onChange={() => setDraft({ ...draft, color })} /><span>{color}</span></label>)}</fieldset>
      {!editingEvent && googleConnected && <label className="calendar-sync-option"><input type="checkbox" checked={syncToGoogle} onChange={(event) => setSyncToGoogle(event.target.checked)} />Also create this event in Google Calendar</label>}
      {formError && <p className="calendar-form-error" role="alert">{formError}</p>}
      <div className="calendar-modal-actions"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit">{editingEvent ? 'Save changes' : 'Create event'}</Button></div>
    </form></div>}
    {eventDetails}
    {toast && <div className="calendar-toast" role="status">{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notification">×</button></div>}
  </DashboardLayout>;
}

function TimeGrid({ view, date, events, onSelectEvent, onCreate, onDrop }) {
  const columns = view === 'Day' ? [date] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index));
  const hours = Array.from({ length: 16 }, (_, index) => index + 7);
  const styleEvent = (event) => {
    const [hour, minute] = (event.startTime || '09:00').split(':').map(Number);
    const [endHour, endMinute] = (event.endTime || '10:00').split(':').map(Number);
    const top = event.allDay ? 0 : Math.max(0, (hour - 7) * 60 + minute);
    const duration = event.allDay ? 45 : Math.max(28, (endHour * 60 + endMinute) - (hour * 60 + minute));
    return { top: `${top}px`, height: `${Math.min(duration, 960 - top)}px` };
  };
  return <div className={`calendar-time-grid ${view === 'Day' ? 'is-day-view' : 'is-week-view'}`}>
    <div className="calendar-time-header"><span />{columns.map((day) => <button type="button" key={dateKey(day)} className={dateKey(day) === dateKey(new Date()) ? 'is-today' : ''} onClick={() => onCreate(day)}><span>{dayTitle(day, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></button>)}</div>
    <div className="calendar-time-body"><div className="calendar-hour-labels">{hours.map((hour) => <span key={hour}>{formatTime(`${String(hour).padStart(2, '0')}:00`)}</span>)}</div>
      <div className="calendar-time-columns">{columns.map((day) => {
        const items = events.filter((event) => event.date === dateKey(day)).sort(eventSort);
        return <div className="calendar-time-column" key={dateKey(day)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, day)}>
          {hours.map((hour) => <button type="button" key={hour} className="calendar-hour-slot" onClick={() => onCreate(day, `${String(hour).padStart(2, '0')}:00`)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const offset = Math.max(0, Math.min(60, Math.floor((event.clientY - rect.top) / rect.height * 60 / 15) * 15)); onDrop(event, day, `${String(hour).padStart(2, '0')}:${String(offset).padStart(2, '0')}`); }} aria-label={`Create an event at ${formatTime(`${String(hour).padStart(2, '0')}:00`)}`} />)}
          <div className="calendar-timed-events">{items.map((item) => <button type="button" key={item.id} draggable={item.provider !== 'meeting'} onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }} onClick={() => onSelectEvent(item)} className={`calendar-timed-event event-color-${item.color || 'blue'}`} style={styleEvent(item)}><strong>{item.title}</strong><span>{item.allDay ? 'All day' : `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`}</span></button>)}</div>
        </div>;
      })}</div></div>
  </div>;
}
