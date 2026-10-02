import { supabase } from '../../lib/supabaseClient.js';
import { listProjectMembers, syncProjectMembers } from './projectMemberService.js';

const statusToDatabase = {
  Planning: 'planning',
  Active: 'active',
  'On Hold': 'on_hold',
  Completed: 'completed'
};
const statusFromDatabase = Object.fromEntries(Object.entries(statusToDatabase).map(([label, value]) => [value, label]));

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function mapProject(row, memberships, user) {
  const profile = user?.id === row.owner_id ? user.profile : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    status: statusFromDatabase[row.status] || 'Planning',
    startDate: row.start_date || '',
    deadline: row.due_date || '',
    archived: Boolean(row.archived_at),
    owner: profile?.full_name || profile?.email || (user?.id === row.owner_id ? 'You' : row.owner_id),
    ownerId: row.owner_id,
    members: memberships.filter((member) => member.project_id === row.id && member.role !== 'owner').map((member) => member.user_id),
    color: 'blue',
    progress: 0
  };
}

export async function getProjects(user) {
  requireClient();
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const memberships = await listProjectMembers(data.map((project) => project.id));
  return data.map((project) => mapProject(project, memberships, user));
}

export async function getProject(projectId, user) {
  requireClient();
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const memberships = await listProjectMembers([projectId]);
  return mapProject(data, memberships, user);
}

export async function saveProject(project, user) {
  requireClient();
  const payload = {
    name: project.name.trim(),
    description: project.description?.trim() || '',
    status: statusToDatabase[project.status] || 'planning',
    start_date: project.startDate || null,
    due_date: project.deadline || null,
    archived_at: project.archived ? new Date().toISOString() : null
  };
  const query = project.id
    ? supabase.from('projects').update(payload).eq('id', project.id)
    : supabase.from('projects').insert({ ...payload, owner_id: user.id });
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  await syncProjectMembers(data.id, project.members || [], user.id);
  return mapProject(data, await listProjectMembers([data.id]), user);
}

export async function deleteProject(projectId) {
  requireClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}
