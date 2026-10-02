import { supabase } from '../../lib/supabaseClient.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function listProjectMembers(projectIds) {
  requireClient();
  if (!projectIds.length) return [];
  const { data, error } = await supabase.from('project_members')
    .select('id,project_id,user_id,role,added_by,created_at')
    .in('project_id', projectIds);
  if (error) throw error;
  return data;
}

export async function syncProjectMembers(projectId, userIds, addedBy) {
  requireClient();
  const desiredIds = [...new Set(userIds.filter(Boolean))];
  const invalidId = desiredIds.find((id) => !uuidPattern.test(id));
  if (invalidId) throw new Error(`Member ID "${invalidId}" is not a valid profile UUID.`);

  const { data: existing, error: readError } = await supabase.from('project_members')
    .select('user_id,role')
    .eq('project_id', projectId);
  if (readError) throw readError;

  const existingIds = new Set(existing.map((member) => member.user_id));
  const desiredSet = new Set(desiredIds);
  const toAdd = desiredIds.filter((id) => !existingIds.has(id));
  const toRemove = existing
    .filter((member) => member.role !== 'owner' && !desiredSet.has(member.user_id))
    .map((member) => member.user_id);

  if (toAdd.length) {
    const { error } = await supabase.from('project_members').insert(toAdd.map((userId) => ({
      project_id: projectId,
      user_id: userId,
      role: 'member',
      added_by: addedBy
    })));
    if (error) throw error;
  }

  if (toRemove.length) {
    const { error } = await supabase.from('project_members')
      .delete()
      .eq('project_id', projectId)
      .in('user_id', toRemove);
    if (error) throw error;
  }

  return listProjectMembers([projectId]);
}