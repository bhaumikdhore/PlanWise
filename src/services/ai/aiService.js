import { supabase } from '../../lib/supabaseClient.js';

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

export async function getAiConversations(userId) {
  requireClient();
  const { data, error } = await supabase.from('ai_conversations')
    .select('id,project_id,title,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function getAiMessages(conversationId) {
  requireClient();
  const { data, error } = await supabase.from('ai_messages')
    .select('id,role,content,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendAiMessage({ conversationId, projectId, message }) {
  requireClient();
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { conversationId: conversationId || undefined, projectId: projectId || null, message }
  });
  if (error) {
    let details = '';
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => ({}));
      details = body.error || '';
    }
    throw new Error(details || error.message || 'AI request failed. Please try again.');
  }
  return data;
}