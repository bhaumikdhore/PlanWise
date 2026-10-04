import { supabase } from '../../lib/supabaseClient.js';

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateAgentResponse(value, expectedAgent) {
  if (!value || typeof value !== 'object' || value.agent !== expectedAgent
    || typeof value.message !== 'string' || !Array.isArray(value.recommendations)
    || !Array.isArray(value.insights) || !Array.isArray(value.proposedActions)
    || !idPattern.test(value.conversationId || '')
    || (value.taskPlan !== null && (!value.taskPlan || typeof value.taskPlan !== 'object'))
    || (value.dailyPlan !== undefined && (!value.dailyPlan || !Array.isArray(value.dailyPlan.priorities)
      || !Array.isArray(value.dailyPlan.overdueTasks) || !Array.isArray(value.dailyPlan.upcomingDeadlines)
      || !Array.isArray(value.dailyPlan.reviewTasks)))) {
    throw new Error('Planwise AI returned an invalid response. Please try again.');
  }
  return value;
}

export async function sendAiMessage(message, options = {}) {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');

  const agent = options.agent || 'personal_assistant';
  const body = { message, agent };
  if (options.conversationId) body.conversationId = options.conversationId;
  if (options.taskId) body.taskId = options.taskId;
  if (options.projectId) body.projectId = options.projectId;
  if (options.action) body.action = options.action;
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body });
  if (error) {
    let details = '';
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => ({}));
      details = body.error || '';
    }
    throw new Error(details || error.message || 'AI request failed. Please try again.');
  }

  return validateAgentResponse(data, agent);
}

export async function createAiPlannedTasks(projectId, tasks) {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in before creating planned tasks.');
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 20) {
    throw new Error('Select between 1 and 20 suggested tasks.');
  }

  const safeTasks = tasks.map((task, index) => {
    if (!task || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 200
      || typeof task.description !== 'string' || task.description.length > 2000
      || !['low', 'medium', 'high', 'urgent'].includes(task.priority)
      || !Array.isArray(task.dependencies)
      || task.dependencies.some((dependency) => !Number.isInteger(dependency) || dependency < 0 || dependency >= index)) {
      throw new Error('A selected task suggestion is invalid.');
    }
    return {
      title: task.title.trim(),
      description: task.description.trim(),
      priority: task.priority,
      category: 'AI subtask',
      due_at: null,
      depends_on: task.dependencies
    };
  });
  const { data, error } = await supabase.rpc('create_ai_planned_tasks', {
    p_project_id: projectId || null,
    p_tasks: safeTasks
  });
  if (error) throw new Error(error.message || 'Could not create selected tasks.');
  return data || [];
}
