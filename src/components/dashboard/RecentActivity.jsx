import Card from '../common/Card';

export default function RecentActivity({ items }) {
  return (
    <Card className="panel-card activity-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Recent Activity</p>
          <h3>Updates</h3>
        </div>
      </div>

      <div className="activity-list">
        {items.map((item) => (
          <div key={`${item.action}-${item.project}`} className="activity-item">
            <div className="activity-icon">{item.icon}</div>
            <div className="activity-copy">
              <strong>{item.action}</strong>
              <span>{item.project}</span>
            </div>
            <div className="activity-meta">
              <small>{item.time}</small>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
