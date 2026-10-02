import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const admin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json'
    }
  });
}

async function authenticate(request: Request) {
  if (!admin) throw new ApiError(503, 'AI service is not configured with Supabase server credentials.');
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new ApiError(401, 'Sign in to use Planwise AI.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Your Planwise session is invalid or expired.');
  return data.user;
}

async function assertProjectAccess(projectId: string | null, userId: string) {
  if (!projectId) return;
  const { data, error } = await admin!.rpc('is_project_member', {
    p_project_id: projectId,
    p_user_id: userId
  });
  if (error) throw new ApiError(500, 'Could not verify access to the selected project.');
  if (!data) throw new ApiError(403, 'You do not have access to the selected project.');
}

async function handleRequest(request: Request) {
  if (!admin) throw new ApiError(503, 'AI service is not configured with Supabase server credentials.');
  if (!openAiKey) throw new ApiError(503, 'AI service is not configured. Add the OPENAI_API_KEY Edge Function secret.');

  const user = await authenticate(request);
  let input: { conversationId?: string; projectId?: string | null; message?: string };
  try {
    input = await request.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }

  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) throw new ApiError(400, 'Enter a message before sending.');
  if (message.length > 4000) throw new ApiError(413, 'Messages must be 4,000 characters or fewer.');

  let conversationId = input.conversationId || '';
  let projectId = input.projectId || null;
  let isNewConversation = false;

  if (conversationId) {
    const { data: conversation, error } = await admin.from('ai_conversations')
      .select('id,user_id,project_id,title')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new ApiError(500, 'Could not load this conversation.');
    if (!conversation) throw new ApiError(404, 'Conversation not found.');
    if (projectId && projectId !== conversation.project_id) throw new ApiError(400, 'A conversation cannot be moved to another project.');
    projectId = conversation.project_id;
  } else {
    const title = message.replace(/\s+/g, ' ').slice(0, 72);
    const { data: conversation, error } = await admin.from('ai_conversations')
      .insert({ user_id: user.id, project_id: projectId, title: title || 'New conversation' })
      .select('id')
      .single();
    if (error) throw new ApiError(500, 'Could not create a conversation.');
    conversationId = conversation.id;
    isNewConversation = true;
  }
  await assertProjectAccess(projectId, user.id);

  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (!isNewConversation) {
    const { data, error } = await admin.from('ai_messages')
      .select('role,content')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) throw new ApiError(500, 'Could not load conversation history.');
    history = data.reverse().map((row) => ({ role: row.role, content: row.content }));
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are Planwise AI, a concise project-planning assistant. Answer using only the information in this conversation. Do not claim to have inspected the user’s Planwise workspace.' },
          ...history,
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.4
      })
    });
  } catch {
    if (isNewConversation) await admin.from('ai_conversations').delete().eq('id', conversationId).eq('user_id', user.id);
    throw new ApiError(502, 'Could not reach the AI provider. Please try again.');
  }

  if (!response.ok) {
    if (isNewConversation) await admin.from('ai_conversations').delete().eq('id', conversationId).eq('user_id', user.id);
    console.error('[ai-assistant] Provider request failed', { status: response.status });
    throw new ApiError(502, 'The AI provider could not answer right now. Please try again.');
  }

  const result = await response.json();
  const assistantContent = result.choices?.[0]?.message?.content;
  if (typeof assistantContent !== 'string' || !assistantContent.trim()) {
    if (isNewConversation) await admin.from('ai_conversations').delete().eq('id', conversationId).eq('user_id', user.id);
    throw new ApiError(502, 'The AI provider returned an empty response. Please try again.');
  }

  const { data: savedMessages, error: messageError } = await admin.from('ai_messages').insert([
    { conversation_id: conversationId, role: 'user', content: message },
    { conversation_id: conversationId, role: 'assistant', content: assistantContent.trim() }
  ]).select('id,role,content,created_at');
  if (messageError) {
    if (isNewConversation) await admin.from('ai_conversations').delete().eq('id', conversationId).eq('user_id', user.id);
    throw new ApiError(500, 'The response was generated but could not be saved. Please try again.');
  }

  const { error: updateError } = await admin.from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', user.id);
  if (updateError) console.warn('[ai-assistant] Conversation timestamp could not be updated', { code: updateError.code });

  return {
    conversationId,
    messages: savedMessages.map((saved) => ({ id: saved.id, role: saved.role, content: saved.content, createdAt: saved.created_at }))
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    return json(await handleRequest(request));
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error('[ai-assistant] Request failed unexpectedly', { error: error instanceof Error ? error.name : 'UnknownError' });
    return json({ error: 'AI request failed unexpectedly. Please try again.' }, 500);
  }
});
