import { supabase } from '../../lib/supabaseClient.js';

const allowedColors = new Set(['blue', 'purple', 'green', 'amber', 'rose']);

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function dateTimeParts(timestamp) {
  const date = new Date(timestamp);
  const part = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    time: `${part(date.getHours())}:${part(date.getMinutes())}`
  };
}

function toTimestamp(date, time) {
  const value = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(value.getTime())) throw new Error('Choose a valid calendar date and time.');
  return value.toISOString();
}

function mapCalendarEvent(row) {
  const starts = dateTimeParts(row.starts_at);
  const ends = dateTimeParts(row.ends_at);
  return {
    id: row.id,
    userId: row.user_id,
    meetingId: row.meeting_id || '',
    title: row.title,
    description: row.description || '',
    date: starts.date,
    startTime: starts.time,
    endTime: ends.time,
    allDay: row.all_day,
    timezone: row.timezone || 'UTC',
    location: row.location || '',
    meetingLink: row.meeting_link || '',
    projectId: row.project_id || '',
    category: row.category,
    color: row.color,
    reminder: row.reminder_minutes,
    provider: row.meeting_id ? 'meeting' : row.provider,
    externalId: row.external_id || '',
    googleEventId: row.provider === 'google' ? row.external_id || '' : '',
    participants: Array.isArray(row.attendees) ? row.attendees : []
  };
}

function payloadFor(event, userId) {
  const start = event.allDay ? toTimestamp(event.date, '00:00') : toTimestamp(event.date, event.startTime || '09:00');
  const endDate = event.allDay
    ? (() => {
      const next = new Date(`${event.date}T00:00:00`);
      next.setDate(next.getDate() + 1);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    })()
    : event.date;
  const end = event.allDay ? toTimestamp(endDate, '00:00') : toTimestamp(endDate, event.endTime || '10:00');
  if (end <= start) throw new Error('The event end must be after its start.');
  const provider = event.googleEventId || event.externalId || event.provider === 'google' ? 'google' : 'planwise';
  return {
    user_id: event.userId || userId,
    project_id: event.projectId || null,
    meeting_id: event.meetingId || null,
    title: event.title.trim(),
    description: event.description || '',
    starts_at: start,
    ends_at: end,
    all_day: Boolean(event.allDay),
    timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    location: event.location || null,
    meeting_link: event.meetingLink || null,
    category: event.category || 'meeting',
    color: allowedColors.has(event.color) ? event.color : 'blue',
    reminder_minutes: Math.max(0, Number(event.reminder) || 0),
    provider,
    external_id: provider === 'google' ? event.googleEventId || event.externalId || null : null,
    attendees: Array.isArray(event.participants) ? event.participants : []
  };
}

async function findExistingEvent(event, userId) {
  if (event.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) {
    return { id: event.id, user_id: event.userId || userId };
  }
  let query = supabase.from('calendar_events').select('id,user_id,meeting_id')
    .eq('user_id', userId);
  if (event.meetingId) query = query.eq('meeting_id', event.meetingId);
  else if (event.googleEventId || event.externalId) query = query.eq('provider', 'google').eq('external_id', event.googleEventId || event.externalId);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCalendarEvents() {
  requireClient();
  const { data, error } = await supabase.from('calendar_events').select('*').order('starts_at', { ascending: true });
  if (error) throw error;
  return data.map(mapCalendarEvent);
}

export async function saveCalendarEvent(event, userId) {
  requireClient();
  if (event.userId && event.userId !== userId) throw new Error('You can only change calendar events you own.');
  const payload = payloadFor(event, userId);
  const existing = await findExistingEvent(event, userId);
  const request = existing
    ? supabase.from('calendar_events').update(payload).eq('id', existing.id).eq('user_id', userId)
    : supabase.from('calendar_events').insert(payload);
  const { data, error } = await request.select('*').single();
  if (error) throw error;
  return mapCalendarEvent(data);
}

export async function saveMeetingCalendarEvent(meeting, userId) {
  if (meeting.createdBy && meeting.createdBy !== userId) return null;
  return saveCalendarEvent({
    id: meeting.calendarEventId,
    userId,
    meetingId: meeting.id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    allDay: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: meeting.location,
    meetingLink: meeting.meetingLink,
    projectId: meeting.projectId,
    category: meeting.meetingType || 'Meeting',
    color: 'purple',
    reminder: meeting.reminder,
    provider: meeting.googleEventId ? 'google' : 'planwise',
    googleEventId: meeting.googleEventId,
    participants: meeting.participants || []
  }, userId);
}

export async function saveImportedGoogleEvents(events, { start, end }, userId) {
  requireClient();
  const { data: existing, error } = await supabase.from('calendar_events')
    .select('id,external_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .gte('starts_at', start)
    .lt('starts_at', end);
  if (error) throw error;

  const activeIds = new Set(events.filter((event) => event.status !== 'cancelled').map((event) => event.googleEventId || event.externalId));
  const removeIds = existing.filter((row) => !activeIds.has(row.external_id)).map((row) => row.id);
  if (removeIds.length) {
    const { error: deleteError } = await supabase.from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .in('id', removeIds);
    if (deleteError) throw deleteError;
  }

  for (const event of events) {
    if (event.status === 'cancelled') continue;
    await saveCalendarEvent({ ...event, provider: 'google' }, userId);
  }
  return getCalendarEvents();
}

export async function deleteCalendarEvent(eventId, userId) {
  requireClient();
  const { error } = await supabase.from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteMeetingCalendarEvent(meetingId, userId) {
  requireClient();
  const { error } = await supabase.from('calendar_events')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('user_id', userId);
  if (error) throw error;
}
