import { supabase } from '../../lib/supabaseClient.js';
import { recordActivity } from '../activity/activityLogService.js';

const validStatuses = new Set(['todo', 'in_progress', 'completed', 'cancelled']);
const validPriorities = new Set(['low', 'medium', 'high']);

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

function mapTask(row, assigneeIds) {
  const { dueDate, dueTime } = toLocalDateTime(row.due_at);
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
    createdBy: row.created_by
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
    completed_at: status === 'completed' ? task.completedAt || new Date().toISOString() : null
  };
}

async function syncAssignees(taskId, assigneeIds) {
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
    const { error } = await supabase.from('task_assignees').insert(toAdd.map((userId) => ({ task_id: taskId, user_id: userId })));
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
  return data.map((task) => mapTask(task, assignedByTask.get(task.id) || []));
}

export async function saveTask(task, userId) {
  requireClient();
  const isNew = !task.id;
  const payload = taskPayload(task);
  const query = task.id
    ? supabase.from('tasks').update(payload).eq('id', task.id)
    : supabase.from('tasks').insert({ ...payload, created_by: userId });
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  try {
    await syncAssignees(data.id, task.assigneeIds || []);
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

export async function updateTaskStatus(task, done, userId) {
  requireClient();
  const status = done ? 'completed' : 'todo';
  const { data, error } = await supabase.from('tasks').update({
    status,
    completed_at: done ? new Date().toISOString() : null
  }).eq('id', task.id).select('*').single();
  if (error) throw error;
  await recordActivity({
    actorId: userId,
    projectId: data.project_id,
    action: done ? 'task_completed' : 'task_reopened',
    entityType: 'task',
    entityId: data.id,
    metadata: { title: data.title, status: data.status }
  });
  return mapTask(data, task.assigneeIds || []);
}

export async function deleteTask(taskId, userId) {
  requireClient();
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id,project_id,title').single();
  if (error) throw error;
  await recordActivity({ actorId: userId, projectId: data.project_id, action: 'task_deleted', entityType: 'task', entityId: data.id, metadata: { title: data.title } });
}