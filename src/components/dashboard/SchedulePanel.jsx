import Card from '../common/Card';
import Badge from '../common/Badge';

export default function SchedulePanel({ items }) {
  return (
    <Card className="panel-card compact-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Today’s Schedule</p>
          <h3>Meetings</h3>
        </div>
        <button type="button" className="text-btn small">View all</button>
      </div>

      <div className="schedule-list">
        {items.map((item) => (
          <div key={item.title} className="schedule-item">
            <div className="schedule-time">{item.time}</div>
            <div className="schedule-body">
              <div className="schedule-icon">{item.icon}</div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.type}</span>
              </div>
            </div>
            <Badge tone={item.status === 'Live' ? 'green' : 'blue'}>{item.status}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
