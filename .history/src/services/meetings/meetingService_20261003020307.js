import { supabase } from '../../lib/supabaseClient.js';
import { deleteMeetingCalendarEvent, saveMeetingCalendarEvent } from '../calendar/calendarService.js';

const statusToDatabase = {
  Upcoming: 'upcoming',
  'In Progress': 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled'
};
const statusFromDatabase = Object.fromEntries(Object.entries(statusToDatabase).map(([label, value]) => [value, label]));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function toTimestamp(date, time) {
  const timestamp = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Choose a valid meeting date and time.');
  return timestamp.toISOString();
}

function dateTimeParts(timestamp) {
  const date = new Date(timestamp);
  const part = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    time: `${part(date.getHours())}:${part(date.getMinutes())}`
  };
}

function mapMeeting(row, participantIds = []) {
  const starts = dateTimeParts(row.starts_at);
  const ends = dateTimeParts(row.ends_at);
  const creator = row.creator_profile;
  return {
    id: row.id,
    projectId: row.project_id || '',
    createdBy: row.created_by,
    title: row.title,
    description: row.description || '',
    date: starts.date,
    startTime: starts.time,
    endTime: ends.time,
    participants: participantIds,
    location: row.location || '',
    meetingLink: row.meeting_link || '',
    reminder: row.reminder_minutes,
    meetingType: row.meeting_type || 'Team meeting',
    status: statusFromDatabase[row.status] || 'Upcoming',
    notes: row.notes || '',
    actionItems: row.action_items || [],
    googleEventId: row.google_event_id || '',
    organizer: creator?.full_name || creator?.email || (row.created_by ? row.created_by.slice(0, 8) : '')
  };
}

async function listParticipantIds(meetingIds) {
  if (!meetingIds.length) return new Map();
  const { data, error } = await supabase.from('meeting_participants')
    .select('meeting_id,user_id')
    .in('meeting_id', meetingIds);
  if (error) throw error;
  const participantsByMeeting = new Map();
  data.forEach(({ meeting_id, user_id }) => {
    participantsByMeeting.set(meeting_id, [...(participantsByMeeting.get(meeting_id) || []), user_id]);
  });
  return participantsByMeeting;
}

async function syncParticipants(meetingId, participantIds) {
  const desired = [...new Set((participantIds || []).filter(Boolean))];
  const invalidId = desired.find((id) => !uuidPattern.test(id));
  if (invalidId) throw new Error(`Participant ID "${invalidId}" is not a valid profile UUID.`);

  const { data: existing, error: readError } = await supabase.from('meeting_participants')
    .select('user_id')
    .eq('meeting_id', meetingId);
  if (readError) throw readError;

  const current = new Set(existing.map((row) => row.user_id));
  const wanted = new Set(desired);
  const toAdd = desired.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));
  if (toAdd.length) {
    const { error } = await supabase.from('meeting_participants').insert(toAdd.map((userId) => ({ meeting_id: meetingId, user_id: userId })));
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase.from('meeting_participants')
      .delete()
      .eq('meeting_id', meetingId)
      .in('user_id', toRemove);
    if (error) throw error;
  }
}

export async function getMeetings() {
  requireClient();
  const { data, error } = await supabase.from('meetings')
    .select('*,creator_profile:profiles!meetings_created_by_fkey(full_name,email)')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  const participantsByMeeting = await listParticipantIds(data.map((meeting) => meeting.id));
  return data.map((meeting) => mapMeeting(meeting, participantsByMeeting.get(meeting.id) || []));
}

export async function saveMeeting(meeting, userId) {
  requireClient();
  const startsAt = toTimestamp(meeting.date, meeting.startTime);
  const endsAt = toTimestamp(meeting.date, meeting.endTime);
  if (endsAt <= startsAt) throw new Error('The end time must be after the start time.');

  const payload = {
    project_id: meeting.projectId || null,
    title: meeting.title.trim(),
    description: meeting.description || '',
    starts_at: startsAt,
    ends_at: endsAt,
    location: meeting.location || null,
    meeting_link: meeting.meetingLink || null,
    reminder_minutes: Number(meeting.reminder) || 0,
    meeting_type: meeting.meetingType || 'Team meeting',
    status: statusToDatabase[meeting.status] || 'upcoming',
    notes: meeting.notes || '',
    action_items: meeting.actionItems || [],
    google_event_id: meeting.googleEventId || null
  };
  const isNew = !meeting.id;
  let row;

  if (isNew) {
    const { data, error } = await supabase.from('meetings')
      .insert({ ...payload, created_by: userId })
      .select('*,creator_profile:profiles!meetings_created_by_fkey(full_name,email)')
      .single();
    if (error) throw error;
    row = data;
  } else {
    await syncParticipants(meeting.id, meeting.participants || []);
    const { data, error } = await supabase.from('meetings')
      .update(payload)
      .eq('id', meeting.id)
      .select('*,creator_profile:profiles!meetings_created_by_fkey(full_name,email)')
      .single();
    if (error) throw error;
    row = data;
  }

  try {
    if (isNew) await syncParticipants(row.id, meeting.participants || []);
    const mapped = mapMeeting(row, meeting.participants || []);
    await saveMeetingCalendarEvent(mapped, userId);
    return mapped;
  } catch (saveError) {
    if (isNew) {
      await deleteMeetingCalendarEvent(row.id, userId);
      await supabase.from('meetings').delete().eq('id', row.id);
    }
    throw saveError;
  }
}

export async function setMeetingGoogleEventId(meetingId, googleEventId, userId) {
  requireClient();
  const { data, error } = await supabase.from('meetings')
    .update({ google_event_id: googleEventId || null })
    .eq('id', meetingId)
    .select('*,creator_profile:profiles!meetings_created_by_fkey(full_name,email)')
    .single();
  if (error) throw error;
  const participantMap = await listParticipantIds([meetingId]);
  const meeting = mapMeeting(data, participantMap.get(meetingId) || []);
  await saveMeetingCalendarEvent(meeting, userId);
  return meeting;
}

export async function deleteMeeting(meetingId, userId) {
  requireClient();
  await deleteMeetingCalendarEvent(meetingId, userId);
  const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
  if (error) throw error;
}