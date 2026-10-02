import { supabase } from '../../lib/supabaseClient.js';
import { listProjectMembers, syncProjectMembers } from './projectMemberService.js';
import { recordActivity } from '../activity/activityLogService.js';

const statusToDatabase = {
  Planning: 'planning',
  Active: 'active',
  'On Hold': 'on_hold',
  Completed: 'completed'
};
const statusFromDatabase = Object.fromEntries(Object.entries(statusToDatabase).map(([label, value]) => [value, label]));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function mapProject(row, memberships, user) {
  const profile = row.owner_profile || (user?.id === row.owner_id ? user.profile : null);
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
    memberRoles: memberships.filter((member) => member.project_id === row.id).map(({ user_id, role }) => ({ userId: user_id, role })),
    color: 'blue',
    progress: 0
  };
}

export async function getProjects(user) {
  requireClient();
  const { data, error } = await supabase.from('projects')
    .select('*,owner_profile:profiles!projects_owner_id_fkey(full_name,email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const memberships = await listProjectMembers(data.map((project) => project.id));
  return data.map((project) => mapProject(project, memberships, user));
}

export async function getProject(projectId, user) {
  requireClient();
  const { data, error } = await supabase.from('projects')
    .select('*,owner_profile:profiles!projects_owner_id_fkey(full_name,email)')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const memberships = await listProjectMembers([projectId]);
  return mapProject(data, memberships, user);
}

export async function saveProject(project, user) {
  requireClient();
  const memberIds = project.members || [];
  const invalidMemberId = memberIds.find((id) => !uuidPattern.test(id));
  if (invalidMemberId) throw new Error(`Member ID "${invalidMemberId}" is not a valid profile UUID.`);
  const isNewProject = !project.id;
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
  try {
    await syncProjectMembers(data.id, memberIds, user.id);
  } catch (membershipError) {
    if (isNewProject) await supabase.from('projects').delete().eq('id', data.id);
    throw membershipError;
  }
  await recordActivity({
    actorId: user.id,
    projectId: data.id,
    action: isNewProject ? 'project_created' : 'project_updated',
    entityType: 'project',
    entityId: data.id,
    metadata: { name: data.name, status: data.status }
  });
  return mapProject(data, await listProjectMembers([data.id]), user);
}

export async function deleteProject(projectId, userId) {
  requireClient();
  const { data: project, error: readError } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle();
  if (readError) throw readError;
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
  await recordActivity({ actorId: userId, action: 'project_deleted', entityType: 'project', entityId: projectId, metadata: { name: project?.name || '', project_id: projectId } });
}
