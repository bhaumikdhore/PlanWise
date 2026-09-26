import Card from '../common/Card';

export default function QuickActions({ actions }) {
  return (
    <Card className="panel-card quick-actions-panel">
      <div className="panel-header quick-actions-header">
        <h3>Quick Actions</h3>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => (
          <button key={action.label} type="button" className="action-pill">
            <span>{action.icon}</span>
            <small>{action.label}</small>
          </button>
        ))}
      </div>
    </Card>
  );
}
