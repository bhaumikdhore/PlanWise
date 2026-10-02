import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function MetricCard({ icon, label, value, trend, tone, description, progress }) {
  return (
    <Card className="metric-card">
      <div className="metric-top">
        <div className={`metric-icon metric-${tone}`}>{icon}</div>
        {trend && <span className="metric-trend positive">{trend}</span>}
      </div>

      <div className="metric-body">
        <p>{label}</p>
        <h3>{value}</h3>
      </div>

      <div className="metric-footer">
        <small>{description}</small>
        {typeof progress === 'number' && (
          <div className="metric-progress">
            <ProgressBar value={progress} tone={tone} />
          </div>
        )}
      </div>
    </Card>
  );
}
