import Card from '../common/Card';
import Badge from '../common/Badge';

export default function ProjectInsights({ insights }) {
  return (
    <Card className="panel-card insights-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Project Health</p>
          <h3>Insights</h3>
        </div>
      </div>

      <div className="insight-list">
        {insights.map((item) => (
          <div key={item.label} className="insight-item">
            <div>
              <strong>{item.label}</strong>
              <span>Updated this week</span>
            </div>
            <Badge tone={item.tone}>{item.value}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
