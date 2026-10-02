import { supabase } from '../../lib/supabaseClient.js';
import { recordActivity } from '../activity/activityLogService.js';

const statusToDatabase = {
  'On track': 'on_track',
  'In progress': 'in_progress',
  Complete: 'complete'
};
const statusFromDatabase = Object.fromEntries(Object.entries(statusToDatabase).map(([label, value]) => [value, label]));

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function mapGoal(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    title: row.title,
    targetDate: row.target_date || '',
    progress: row.progress,
    status: statusFromDatabase[row.status] || 'On track',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function databaseStatus(status, progress) {
  if (progress >= 100) return 'complete';
  if (status && statusToDatabase[status]) return statusToDatabase[status];
  return progress > 0 ? 'in_progress' : 'on_track';
}

export async function getProjectGoals(projectId) {
  requireClient();
  let query = supabase.from('project_goals').select('*').order('target_date', { ascending: true, nullsFirst: false });
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapGoal);
}

export async function createProjectGoal({ projectId, title, targetDate, progress = 0, status }, userId) {
  requireClient();
  const payload = {
    project_id: projectId,
    created_by: userId,
    title: title.trim(),
    target_date: targetDate || null,
    progress: Math.max(0, Math.min(100, Math.round(Number(progress) || 0))),
    status: databaseStatus(status, Number(progress) || 0)
  };
  const { data, error } = await supabase.from('project_goals').insert(payload).select('*').single();
  if (error) throw error;
  const goal = mapGoal(data);
  await recordActivity({ actorId: userId, projectId, action: 'goal_created', entityType: 'project_goal', entityId: goal.id, metadata: { title: goal.title } });
  return goal;
}

export async function updateProjectGoal(goal, changes, userId) {
  requireClient();
  const progress = changes.progress === undefined ? goal.progress : Math.max(0, Math.min(100, Math.round(Number(changes.progress) || 0)));
  const payload = {
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.targetDate !== undefined ? { target_date: changes.targetDate || null } : {}),
    progress,
    status: databaseStatus(changes.status || goal.status, progress)
  };
  const { data, error } = await supabase.from('project_goals').update(payload).eq('id', goal.id).select('*').single();
  if (error) throw error;
  const updated = mapGoal(data);
  const action = updated.progress === 100 && goal.progress < 100 ? 'goal_completed' : 'goal_updated';
  await recordActivity({ actorId: userId, projectId: goal.projectId, action, entityType: 'project_goal', entityId: goal.id, metadata: { title: updated.title, progress: updated.progress } });
  return updated;
}

export async function deleteProjectGoal(goal, userId) {
  requireClient();
  const { error } = await supabase.from('project_goals').delete().eq('id', goal.id);
  if (error) throw error;
  await recordActivity({ actorId: userId, projectId: goal.projectId, action: 'goal_deleted', entityType: 'project_goal', entityId: goal.id, metadata: { title: goal.title } });
}