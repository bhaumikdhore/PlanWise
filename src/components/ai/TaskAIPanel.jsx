import { useState } from 'react';
import { sendAiMessage } from '../../services/ai/aiService';
import TaskPlanSuggestion from './TaskPlanSuggestion';

const actions = [
  ['explain', 'Explain this task', 'Explain this task using its description, priority, deadline, dependencies, and project context.'],
  ['breakdown', 'Break into subtasks', 'Break this task into a practical plan with ordered subtasks, effort estimates, dependencies, and risks.'],
  ['next', 'Suggest next step', 'What is the most useful next step for this task? Explain briefly.'],
  ['effort', 'Estimate effort', 'Estimate the effort for this task and explain the assumptions.'],
  ['risks', 'Identify risks', 'Identify risks or blockers for this task based only on its authorized context.'],
  ['activity', 'Summarize activity', 'Summarize the activity history for this task.']
];

export default function TaskAIPanel({ task, active, onCreated }) {
  const [conversationId, setConversationId] = useState('');
  const [response, setResponse] = useState(null);
  const [responseSequence, setResponseSequence] = useState(0);
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');

  const ask = async (key, prompt) => {
    if (loadingAction) return;
    setLoadingAction(key);
    setError('');
    try {
      const result = await sendAiMessage(prompt, {
        agent: key === 'breakdown' ? 'task_planner' : 'personal_assistant',
        conversationId: conversationId || undefined,
        taskId: task.id
      });
      setConversationId(result.conversationId);
      setResponse(result);
      setResponseSequence((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Could not get task assistance.');
    } finally {
      setLoadingAction('');
    }
  };

  return active ? <section className="task-ai-panel is-open" aria-label={`AI help for ${task.title}`}>
    <div className="task-ai-content">
      <div className="task-ai-actions">{actions.map(([key, label, prompt]) => <button type="button" key={key} onClick={() => ask(key, prompt)} disabled={Boolean(loadingAction)}>{loadingAction === key ? 'Thinking…' : label}</button>)}</div>
      {loadingAction && <p role="status" className="ai-chat-empty">Reviewing this task and its authorized project context…</p>}
      {error && <p role="alert" className="ai-chat-error">{error}</p>}
      {response && <div className="task-ai-response" aria-live="polite">
        <p>{response.message}</p>
        {response.taskPlan && <TaskPlanSuggestion key={responseSequence} plan={response.taskPlan} projectId={task.projectId || null} onCreated={onCreated} />}
      </div>}
    </div>
  </section> : null;
}
