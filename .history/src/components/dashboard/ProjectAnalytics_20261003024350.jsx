import Card from '../common/Card';

export default function ProjectAnalytics({ data, goals }) {
  const totalGoals = goals.onTrack + goals.inProgress + goals.complete;
  const goalProgress = totalGoals ? Math.round((goals.complete / totalGoals) * 100) : 0;
  const onTrackEnd = totalGoals ? goals.onTrack / totalGoals * 100 : 0;
  const inProgressEnd = totalGoals ? (goals.onTrack + goals.inProgress) / totalGoals * 100 : 0;

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
                <span className="bar bar-blue" style={{ height: `${item.value}%` }} />
              </div>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="project-progress-right">
        <div className="donut-wrap">
          <div className="donut-chart" style={{ background: totalGoals ? `conic-gradient(var(--blue) 0 ${onTrackEnd}%, var(--purple) ${onTrackEnd}% ${inProgressEnd}%, var(--green) ${inProgressEnd}% 100%)` : 'var(--line)' }} aria-label={`Goal completion: ${goalProgress} percent complete`}>
            <div className="donut-inner">
              <strong>{goalProgress}%</strong>
              <span>Goals complete</span>
            </div>
          </div>
        </div>

        <div className="legend-list">
          <div className="legend-item"><span className="legend-dot blue" /> <span>On Track</span> <strong>{goals.onTrack}</strong></div>
          <div className="legend-item"><span className="legend-dot purple" /> <span>In Progress</span> <strong>{goals.inProgress}</strong></div>
          <div className="legend-item"><span className="legend-dot green" /> <span>Complete</span> <strong>{goals.complete}</strong></div>
        </div>
      </div>
      {!data.length && <p className="project-detail-empty">No accessible projects yet.</p>}
    </Card>
  );
}
