import Card from '../common/Card';

export default function ProjectAnalytics({ data }) {
  const maxValue = 90;
  const total = 100;
  const segments = [64, 24, 12];

  return (
    <Card className="panel-card project-analytics-panel">
      <div className="panel-header project-progress-header">
        <h3>Productivity Overview</h3>
        <button type="button" className="text-btn small">View All</button>
      </div>

      <div className="project-progress-chart">
        <div className="chart-grid-lines">
          <span>100</span>
          <span>80</span>
          <span>60</span>
          <span>40</span>
          <span>20</span>
          <span>0</span>
        </div>

        <div className="analytics-chart">
          {data.map((item) => (
            <div key={item.label} className="bar-column">
              <div className="bar-stack">
                <span className={`bar bar-blue ${item.label === 'Aug' ? 'highlighted' : ''}`} style={{ height: `${(item.value / maxValue) * 100}%` }} />
                <span className="bar bar-purple" style={{ height: `${(Math.min(item.value, 50) / maxValue) * 100}%` }} />
              </div>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="project-progress-right">
        <div className="donut-wrap">
          <div className="donut-chart" aria-label="Goal progress: 89 percent on track">
            <div className="donut-inner">
              <strong>89%</strong>
              <span>Goal Progress</span>
            </div>
          </div>
        </div>

        <div className="legend-list">
          <div className="legend-item"><span className="legend-dot blue" /> <span>On Track</span> <strong>64%</strong></div>
          <div className="legend-item"><span className="legend-dot amber" /> <span>At Risk</span> <strong>24%</strong></div>
          <div className="legend-item"><span className="legend-dot purple" /> <span>Delayed</span> <strong>12%</strong></div>
        </div>
      </div>
    </Card>
  );
}
