import { useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { sendAiMessage } from '../../services/ai/aiService';
import TaskPlanSuggestion from '../ai/TaskPlanSuggestion';

const starterMessage = 'What should I work on today?';

export default function AIAssistant({ session, projects = [], onTasksCreated }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('assistant');
  const [message, setMessage] = useState(starterMessage);
  const [projectId, setProjectId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [response, setResponse] = useState(null);
  const [responseSequence, setResponseSequence] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (event) => {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt || sending) return;
    if (!session?.access_token) {
      setError('Sign in again to use Planwise AI.');
      return;
    }

    setSending(true);
    setError('');
    setResponse(null);
    try {
      const result = await sendAiMessage(prompt, {
        agent: mode === 'planner' ? 'task_planner' : 'personal_assistant',
        projectId: mode === 'planner' ? projectId || undefined : undefined,
        conversationId: conversationId || undefined
      });
      setResponse(result);
      setResponseSequence((value) => value + 1);
      setConversationId(result.conversationId);
    } catch (sendError) {
      setError(sendError.message || 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="panel-card ai-panel ai-assistant-card">
      <div className="ai-assistant-heading">
        <div className="ai-badge" aria-hidden="true">AI</div>
        <div className="ai-copy">
          <h3>Planwise AI</h3>
          <p>Get a secure, personalized starting point for your workday.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Close' : 'Ask AI'}
        </Button>
      </div>

      {open && (
        <div className="ai-assistant-content">
          <div className="ai-mode-switch" role="group" aria-label="AI mode">
            <button type="button" className={mode === 'assistant' ? 'active' : ''} onClick={() => {
              setMode('assistant');
              setConversationId('');
              setResponse(null);
              setMessage(starterMessage);
            }}>Ask my assistant</button>
            <button type="button" className={mode === 'planner' ? 'active' : ''} onClick={() => {
              setMode('planner');
              setConversationId('');
              setResponse(null);
              setMessage('');
            }}>Plan a task</button>
          </div>
          {mode === 'planner' && <label className="ai-project-select"><span>Create suggestions for</span><select value={projectId} onChange={(event) => {
            setProjectId(event.target.value);
            setConversationId('');
            setResponse(null);
          }} disabled={sending}><option value="">Personal Tasks</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>}
          <form className="ai-chat-form" onSubmit={send}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows="2"
              maxLength="4000"
              placeholder={mode === 'planner' ? 'Describe the task you want to plan…' : 'Ask Planwise AI…'}
              aria-label={mode === 'planner' ? 'Describe a task to plan' : 'Message Planwise AI'}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !message.trim()}>
              {sending ? 'Thinking…' : mode === 'planner' ? 'Generate suggestion' : 'Send'}
            </Button>
          </form>

          {sending && <p className="ai-chat-empty" role="status">Planwise AI is reviewing your authorized workspace context…</p>}
          {error && <p className="ai-chat-error" role="alert">{error}</p>}
          {response && (
            <section className="ai-assistant-response" aria-live="polite" aria-label="Planwise AI response">
              <p>{response.message}</p>
              {response.taskPlan && <TaskPlanSuggestion key={responseSequence} plan={response.taskPlan} projectId={projectId || null} onCreated={onTasksCreated} />}
              {response.recommendations.length > 0 && (
                <ul>
                  {response.recommendations.map((recommendation, index) => (
                    <li key={recommendation.taskId || `${recommendation.title}-${index}`}>
                      <strong>{recommendation.title}</strong>
                      <span>{recommendation.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
