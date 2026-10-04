import { useMemo, useState } from 'react';
import { createAiPlannedTasks } from '../../services/ai/aiService';

export default function TaskPlanSuggestion({ plan, projectId, onCreated }) {
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const recommended = useMemo(() => plan?.recommendedOrder || [], [plan]);

  if (!plan) return null;

  const addWithDependencies = (target, index, tasks) => {
    if (tasks.has(index)) return;
    tasks.add(index);
    target[index].dependencies.forEach((dependency) => addWithDependencies(target, dependency, tasks));
  };

  const toggle = (index, checked) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        addWithDependencies(plan.subtasks, index, next);
      } else {
        const removed = new Set([index]);
        let changed = true;
        while (changed) {
          changed = false;
          plan.subtasks.forEach((subtask, dependentIndex) => {
            if (!removed.has(dependentIndex) && subtask.dependencies.some((dependency) => removed.has(dependency))) {
              removed.add(dependentIndex);
              changed = true;
            }
          });
        }
        removed.forEach((removedIndex) => next.delete(removedIndex));
      }
      return next;
    });
    setError('');
    setSuccess('');
  };

  const createSelected = async () => {
    const chosen = [...selected].sort((left, right) => left - right);
    if (!chosen.length || saving) return;
    const newIndex = new Map(chosen.map((oldIndex, index) => [oldIndex, index]));
    const tasks = chosen.map((oldIndex) => {
      const task = plan.subtasks[oldIndex];
      return {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dependencies: task.dependencies
          .filter((dependency) => newIndex.has(dependency))
          .map((dependency) => newIndex.get(dependency))
      };
    });
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await createAiPlannedTasks(projectId, tasks);
      setSelected(new Set());
      setCreated(true);
      setSuccess(`${created.length} task${created.length === 1 ? '' : 's'} created. You can review them in Tasks.`);
      onCreated?.(created);
    } catch (createError) {
      setError(createError.message || 'Could not create the selected tasks.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ai-task-plan" aria-label="Suggested task plan">
      <header>
        <span className="panel-kicker">Suggested plan · not created</span>
        <h4>{plan.title}</h4>
        <p>{plan.summary}</p>
        <div className="ai-task-plan-meta">
          <span>Suggested priority: {plan.priority}</span>
          <span>Estimated effort: {plan.estimatedHours}h</span>
        </div>
      </header>
      {plan.risks.length > 0 && <div className="ai-task-plan-risks"><strong>Risks to consider</strong><ul>{plan.risks.map((risk, index) => <li key={`${risk}-${index}`}>{risk}</li>)}</ul></div>}
      <div className="ai-task-plan-list">
        {recommended.map((index) => {
          const subtask = plan.subtasks[index];
          if (!subtask) return null;
          const dependencies = subtask.dependencies.map((dependency) => plan.subtasks[dependency]?.title).filter(Boolean);
          return <label className="ai-task-plan-item" key={`${index}-${subtask.title}`}>
            <input type="checkbox" checked={selected.has(index)} onChange={(event) => toggle(index, event.target.checked)} disabled={saving || created} />
            <span><strong>{subtask.title}</strong><small>{subtask.description || 'No additional details.'}</small><small>{subtask.estimatedHours}h · {subtask.priority}{dependencies.length ? ` · Depends on: ${dependencies.join(', ')}` : ''}</small></span>
          </label>;
        })}
      </div>
      <p className="ai-approval-note">Select the subtasks you approve. Required earlier dependencies are selected with a subtask.</p>
      {error && <p className="ai-chat-error" role="alert">{error}</p>}
      {success && <p className="ai-chat-success" role="status">{success}</p>}
      <button className="ai-create-selected" type="button" onClick={createSelected} disabled={saving || created || selected.size === 0}>
        {created ? 'Selected Tasks Created' : saving ? 'Creating selected tasks…' : `Create Selected Tasks${selected.size ? ` (${selected.size})` : ''}`}
      </button>
    </section>
  );
}
