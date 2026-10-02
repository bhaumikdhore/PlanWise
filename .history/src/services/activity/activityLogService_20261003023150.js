import { supabase } from '../../lib/supabaseClient.js';

export async function recordActivity({ actorId, projectId = null, action, entityType, entityId = null, metadata = {} }) {
  if (!supabase) return false;
  const { error } = await supabase.from('activity_logs').insert({
    actor_id: actorId,
    project_id: projectId || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });
  if (error) {
    console.warn('Activity log could not be recorded:', error.message);
    return false;
  }
  return true;
}