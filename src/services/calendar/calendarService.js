import { getMeetings, getProjects } from '../projects/projectService.js';

const STORAGE_KEY = 'planwise-calendar-events-v1';

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const seedEvents = [
  { id: 'seed-calendar-planning', title: 'Weekly planning', description: 'Align this week’s priorities and focus blocks.', date: localDate(0), startTime: '09:00', endTime: '09:45', location: 'Team room', meetingLink: '', projectId: 'product-launch', participants: ['Ava', 'Noah'], reminder: 10, category: 'Planning', color: 'blue', provider: 'planwise' },
  { id: 'seed-calendar-design', title: 'Design review', description: 'Review the latest screens and share feedback.', date: localDate(0), startTime: '11:00', endTime: '12:00', location: 'Design studio', meetingLink: '', projectId: 'design-sprint', participants: ['Lia', 'Max'], reminder: 10, category: 'Meeting', color: 'purple', provider: 'planwise' },
  { id: 'seed-calendar-focus', title: 'Focus time', description: 'Uninterrupted time for deep work.', date: localDate(1), startTime: '10:00', endTime: '12:00', location: '', meetingLink: '', projectId: '', participants: [], reminder: 0, category: 'Focus', color: 'green', provider: 'planwise' },
  { id: 'seed-calendar-launch', title: 'Launch readiness', description: 'Check open launch items and owners.', date: localDate(2), startTime: '14:00', endTime: '14:45', location: '', meetingLink: '', projectId: 'product-launch', participants: ['Ava', 'Noah'], reminder: 10, category: 'Meeting', color: 'amber', provider: 'planwise' }
];

function readEvents() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : seedEvents;
}

function writeEvents(events) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function meetingEvent(meeting) {
  const start = new Date(`${meeting.date}T${meeting.time || '09:00'}:00`);
  const duration = Number(meeting.duration) || 30;
  const end = new Date(start.getTime() + duration * 60000);
  const time = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const project = getProjects().find((item) => item.id === meeting.projectId);
  return {
    id: `meeting:${meeting.id}`,
    sourceMeetingId: meeting.id,
    title: meeting.title,
    description: `Project meeting${project ? ` for ${project.name}` : ''}.`,
    date: meeting.date,
    startTime: time(start),
    endTime: time(end),
    location: '',
    meetingLink: '',
    projectId: meeting.projectId || '',
    participants: meeting.attendees || [],
    reminder: 10,
    category: 'Meeting',
    color: 'purple',
    provider: 'meeting'
  };
}

export function getCalendarEvents() {
  const events = readEvents();
  const convertedMeetings = new Set(events.filter((event) => event.sourceMeetingId).map((event) => event.sourceMeetingId));
  const meetingEvents = getMeetings()
    .filter((meeting) => !convertedMeetings.has(meeting.id))
    .map(meetingEvent);
  return [...events, ...meetingEvents];
}

export function saveCalendarEvent(event) {
  const events = readEvents();
  const existingIndex = events.findIndex((item) => item.id === event.id);
  const saved = event.id && existingIndex !== -1
    ? { ...events[existingIndex], ...event }
    : { ...event, id: `event-${crypto.randomUUID()}`, provider: event.provider || 'planwise' };
  const next = existingIndex === -1 ? [saved, ...events] : events.map((item) => item.id === saved.id ? saved : item);
  writeEvents(next);
  return saved;
}

export function saveImportedGoogleEvents(googleEvents, { start, end }) {
  const current = readEvents();
  const incomingIds = new Set(googleEvents.map((event) => event.googleEventId || event.id));
  const cancelledIds = new Set(googleEvents
    .filter((event) => event.status === 'cancelled')
    .map((event) => event.googleEventId || event.id));
  const kept = current.filter((event) => {
    if (event.provider !== 'google' || !event.googleEventId) return true;
    if (cancelledIds.has(event.googleEventId)) return false;
    return event.date < start || event.date >= end || incomingIds.has(event.googleEventId);
  });
  const byGoogleId = new Map(kept.filter((event) => event.googleEventId).map((event) => [event.googleEventId, event]));
  const imported = googleEvents
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      const googleId = event.googleEventId || event.id;
      const existing = byGoogleId.get(googleId);
      return { ...existing, ...event, id: existing?.id || `google-${googleId}`, googleEventId: googleId, provider: 'google' };
    });
  const next = [...kept.filter((event) => event.provider !== 'google' || event.date < start || event.date >= end), ...imported];
  writeEvents(next);
  return next;
}

export function deleteCalendarEvent(eventId) {
  const next = readEvents().filter((event) => event.id !== eventId);
  writeEvents(next);
  return next;
}

export function deleteMeetingCalendarEvent(meetingId) {
  const next = readEvents().filter((event) => event.sourceMeetingId !== meetingId);
  writeEvents(next);
  return next;
}
