import { supabase } from '../../lib/supabaseClient.js';
import { recordActivity } from '../activity/activityLogService.js';

const validStatuses = new Set(['todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled']);
const validPriorities = new Set(['low', 'medium', 'high', 'urgent']);

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function toLocalDateTime(value) {
  if (!value) return { dueDate: '', dueTime: '09:00' };
  const date = new Date(value);
  const part = (number) => String(number).padStart(2, '0');
  return {
    dueDate: `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    dueTime: `${part(date.getHours())}:${part(date.getMinutes())}`
  };
}

function mapTask(row, assigneeIds, profiles = []) {
  const { dueDate, dueTime } = toLocalDateTime(row.due_at);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    id: row.id,
    projectId: row.project_id || '',
    title: row.title,
    description: row.description || '',
    priority: row.priority[0].toUpperCase() + row.priority.slice(1),
    category: row.category || 'Work',
    dueDate,
    dueTime,
    done: row.status === 'completed',
    status: row.status,
    assigneeIds,
    assignees: assigneeIds.map((id) => profileMap.get(id) || { id, full_name: '', email: '' }),
    reviewerId: row.reviewer_id || '',
    reviewer: profileMap.get(row.reviewer_id) || null,
    reviewFeedback: row.review_feedback || '',
    reviewRequestedAt: row.review_requested_at || '',
    createdBy: row.created_by,
    completedAt: row.completed_at || '',
    createdAt: row.created_at
  };
}

function taskPayload(task) {
  const status = task.status && validStatuses.has(task.status)
    ? task.status
    : task.done ? 'completed' : 'todo';
  const priority = String(task.priority || 'Medium').toLowerCase();
  const dueAt = task.dueDate
    ? new Date(`${task.dueDate}T${task.dueTime || '09:00'}:00`).toISOString()
    : null;
  return {
    project_id: task.projectId || null,
    title: task.title.trim(),
    description: task.description || '',
    status,
    priority: validPriorities.has(priority) ? priority : 'medium',
    category: task.category || null,
    due_at: dueAt,
    reviewer_id: task.reviewerId || null,
    review_feedback: task.reviewFeedback || null,
    completed_at: status === 'completed' ? task.completedAt || new Date().toISOString() : null
  };
}

async function syncAssignees(taskId, assigneeIds, assignedBy) {
  const desired = [...new Set(assigneeIds || [])];
  const { data: existing, error: readError } = await supabase.from('task_assignees')
    .select('user_id')
    .eq('task_id', taskId);
  if (readError) throw readError;

  const current = new Set(existing.map((row) => row.user_id));
  const wanted = new Set(desired);
  const toAdd = desired.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));
  if (toAdd.length) {
    const { error } = await supabase.from('task_assignees').insert(toAdd.map((userId) => ({
      task_id: taskId,
      user_id: userId,
      assigned_by: assignedBy
    })));
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase.from('task_assignees').delete().eq('task_id', taskId).in('user_id', toRemove);
    if (error) throw error;
  }
}

export async function getTasks(projectId) {
  requireClient();
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return [];

  const { data: assignees, error: assigneeError } = await supabase.from('task_assignees')
    .select('task_id,user_id')
    .in('task_id', data.map((task) => task.id));
  if (assigneeError) throw assigneeError;
  const assignedByTask = new Map();
  assignees.forEach(({ task_id, user_id }) => assignedByTask.set(task_id, [...(assignedByTask.get(task_id) || []), user_id]));
  const profileIds = [...new Set([
    ...assignees.map(({ user_id }) => user_id),
    ...data.map(({ reviewer_id, created_by }) => [reviewer_id, created_by]).flat()
  ].filter(Boolean))];
  let profiles = [];
  if (profileIds.length) {
    const { data: profileRows, error: profileError } = await supabase.from('profiles')
      .select('id,full_name,email,avatar_url')
      .in('id', profileIds);
    if (profileError) throw profileError;
    profiles = profileRows;
  }
  return data.map((task) => mapTask(task, assignedByTask.get(task.id) || [], profiles));
}

export async function saveTask(task) {
  requireClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in before saving a task.');
  const userId = user.id;
  if (!String(task.title || '').trim()) throw new Error('Enter a task title.');
  const isNew = !task.id;
  const payload = taskPayload(task);
  const query = task.id
    ? supabase.from('tasks').update(payload).eq('id', task.id)
    : supabase.from('tasks').insert({ ...payload, created_by: userId });
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  try {
    await syncAssignees(data.id, task.assigneeIds || [], userId);
  } catch (assigneeError) {
    if (!task.id) await supabase.from('tasks').delete().eq('id', data.id);
    throw assigneeError;
  }
  await recordActivity({
    actorId: userId,
    projectId: data.project_id,
    action: isNew ? 'task_created' : data.status === 'completed' ? 'task_completed' : 'task_updated',
    entityType: 'task',
    entityId: data.id,
    metadata: { title: data.title, status: data.status }
  });
  return mapTask(data, task.assigneeIds || []);
}

export async function updateTaskStatus(task, done) {
  return transitionTaskStatus(task, done ? 'completed' : 'todo');
}

export async function transitionTaskStatus(task, status, reviewFeedback = task.reviewFeedback || '') {
  requireClient();
  if (!validStatuses.has(status)) throw new Error('Choose a valid task status.');
  const { data, error } = await supabase.from('tasks').update({
    status,
    review_feedback: reviewFeedback || null,
    completed_at: status === 'completed' ? new Date().toISOString() : null
  }).eq('id', task.id).select('*').single();
  if (error) throw error;
  const profileIds = [...new Set([...(task.assigneeIds || []), data.reviewer_id, data.created_by].filter(Boolean))];
  const { data: profiles, error: profileError } = profileIds.length
    ? await supabase.from('profiles').select('id,full_name,email,avatar_url').in('id', profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  return mapTask(data, task.assigneeIds || [], profiles);
}

export async function getTaskActivity(taskId) {
  requireClient();
  const { data: activities, error } = await supabase.from('activity_logs')
    .select('id,actor_id,action,metadata,created_at')
    .eq('entity_type', 'task')
    .eq('entity_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const actorIds = [...new Set(activities.map(({ actor_id }) => actor_id).filter(Boolean))];
  if (!actorIds.length) return activities.map((activity) => ({ ...activity, actor: null }));
  const { data: profiles, error: profileError } = await supabase.from('profiles')
    .select('id,full_name,email,avatar_url')
    .in('id', actorIds);
  if (profileError) throw profileError;
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  return activities.map((activity) => ({ ...activity, actor: profileMap.get(activity.actor_id) || null }));
}

export async function deleteTask(taskId, userId) {
  requireClient();
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id,project_id,title').single();
  if (error) throw error;
  await recordActivity({ actorId: userId, projectId: data.project_id, action: 'task_deleted', entityType: 'task', entityId: data.id, metadata: { title: data.title } });
}

export function subscribeToTaskChanges(onChange, onError) {
  requireClient();
  let refreshTimer;
  const channel = supabase
    .channel(`task-changes-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(onChange, 100);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(onChange, 100);
    })
    .subscribe((status) => {
      if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
        onError?.(new Error('Live task updates are unavailable. Refresh the page to check for changes.'));
      }
    });

  return () => {
    window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}