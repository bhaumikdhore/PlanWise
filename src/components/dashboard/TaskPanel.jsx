import Card from '../common/Card';

const priorityTone = {
  Urgent: 'danger',
  High: 'danger',
  Medium: 'amber',
  Low: 'green'
};

export default function TaskPanel({ tasks, onToggleTask, onViewAll }) {
  return (
    <Card className="panel-card task-panel">
      <div className="panel-header task-header">
        <h3>Upcoming Tasks</h3>
        <button type="button" className="text-btn small" onClick={onViewAll}>View All</button>
      </div>

      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-row ${task.done ? 'is-done' : ''}`}>
            <button type="button" className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => onToggleTask?.(task.id)} aria-label={`${task.reviewerId ? 'Submit for review' : task.done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}>
              {task.done ? '✓' : ''}
            </button>

            <div className="task-copy">
              <strong>{task.title}</strong>
              <span>{task.project} · {task.dueTime}</span>
            </div>

            <span className={`priority-badge priority-${priorityTone[task.priority] || 'neutral'}`}>{task.priority}</span>
            <button type="button" className="task-menu" aria-label={`More options for ${task.title}`}>
              ⋮
            </button>
          </div>
        ))}
        {!tasks.length && <div className="project-detail-empty">No upcoming tasks.</div>}
      </div>
    </Card>
  );
}
