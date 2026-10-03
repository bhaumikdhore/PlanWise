import { supabase } from '../../lib/supabaseClient.js';

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function getUnreadNotifications(limit = 30) {
  requireClient();
  const { data, error } = await supabase.from('notifications')
    .select('id,type,title,body,entity_type,entity_id,payload,created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getNotifications(limit = 30) {
  requireClient();
  const { data, error } = await supabase.from('notifications')
    .select('id,type,title,body,entity_type,entity_id,payload,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export function subscribeToNotifications(userId, onChange) {
  if (!supabase) return () => {};
  requireClient();
  if (!userId) throw new Error('A signed-in user is required for notification updates.');
  const channel = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function createDeadlineNotifications() {
  requireClient();
  const { data, error } = await supabase.rpc('notify_upcoming_task_deadlines');
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId) {
  requireClient();
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  requireClient();
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}