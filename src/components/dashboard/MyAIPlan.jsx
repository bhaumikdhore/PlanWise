import { useState } from 'react';
import Card from '../common/Card';
import { sendAiMessage } from '../../services/ai/aiService';

function TaskList({ title, tasks, onNavigate }) {
  return <section className="my-ai-plan-group">
    <h4>{title}<span>{tasks.length}</span></h4>
    {tasks.length ? <ul>{tasks.map((task, index) => <li key={task.taskId || `${task.title}-${index}`}>
      <button type="button" disabled={!task.taskId} onClick={() => task.taskId && onNavigate(`tasks?task=${encodeURIComponent(task.taskId)}`)}>
        <strong>{task.title}</strong><small>{task.reason}</small>
      </button>
    </li>)}</ul> : <p>Nothing to show.</p>}
  </section>;
}

export default function MyAIPlan({ onNavigate }) {
  const [plan, setPlan] = useState(null);
  const [conversationId, setConversationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await sendAiMessage('Generate my personal daily work plan.', {
        action: 'daily_plan',
        conversationId: conversationId || undefined
      });
      setPlan(result.dailyPlan);
      setConversationId(result.conversationId);
    } catch (requestError) {
      setError(requestError.message || 'Could not generate your AI plan.');
    } finally {
      setLoading(false);
    }
  };

  return <Card className="my-ai-plan-card">
    <header className="my-ai-plan-heading">
      <div><span className="panel-kicker">Personal planning</span><h2>My AI Plan</h2><p>Priorities are ranked from your task deadlines, status, priority, dependencies, and project status.</p></div>
      <button type="button" className="primary-inline-button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate My Plan'}</button>
    </header>
    {loading && <p className="ai-chat-empty" role="status">Reviewing your authorized tasks and calendar…</p>}
    {error && <p className="ai-chat-error" role="alert">{error}</p>}
    {!loading && !plan && !error && <p className="my-ai-plan-empty">Generate a plan to see today’s priorities and upcoming workload. No tasks will be changed.</p>}
    {plan && <div className="my-ai-plan-content">
      <div className="my-ai-plan-summary">
        <span><strong>{plan.estimatedWorkloadHours}h</strong><small>rough workload estimate</small></span>
        <span><strong>{plan.overdueTasks.length}</strong><small>overdue tasks</small></span>
        <span><strong>{plan.reviewTasks.length}</strong><small>waiting for review</small></span>
      </div>
      <p className="my-ai-plan-caveat">Workload is a planning estimate of 1.5 hours per open task; task-level effort estimates are not stored yet.</p>
      {plan.suggestedNextTask && <div className="my-ai-plan-next"><span>Suggested next task</span><button type="button" onClick={() => onNavigate(`tasks?task=${encodeURIComponent(plan.suggestedNextTask.taskId)}`)}><strong>{plan.suggestedNextTask.title}</strong><small>{plan.suggestedNextTask.reason}</small></button></div>}
      <div className="my-ai-plan-groups">
        <TaskList title="Today’s priorities" tasks={plan.priorities} onNavigate={onNavigate} />
        <TaskList title="Overdue tasks" tasks={plan.overdueTasks} onNavigate={onNavigate} />
        <TaskList title="Upcoming deadlines" tasks={plan.upcomingDeadlines} onNavigate={onNavigate} />
        <TaskList title="Waiting for review" tasks={plan.reviewTasks} onNavigate={onNavigate} />
      </div>
    </div>}
  </Card>;
}
