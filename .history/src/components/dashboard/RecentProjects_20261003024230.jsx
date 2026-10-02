import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';

export default function RecentProjects({ projects, totalCount = projects.length }) {
  return (
    <Card className="panel-card project-list-panel">
      <div className="panel-header project-list-header">
        <h3>Recent Projects ({totalCount})</h3>
        <button type="button" className="text-btn small">View All</button>
      </div>

      <div className="project-list">
        {projects.map((project) => (
          <div key={project.name} className="project-item compact-project-item">
            <div className="project-main">
              <div className={`project-icon project-${project.color}`}>{project.name.slice(0, 1)}</div>
              <div className="project-copy">
                <strong>{project.name}</strong>
                <span>{project.status} · {project.tasksLeft} tasks left</span>
              </div>
            </div>

            <div className="project-meta compact-meta">
              <ProgressBar value={project.completion} tone={project.color} className="project-progress" />
              <div className="project-completion"><strong>{project.completion}%</strong></div>
            </div>
          </div>
        ))}
      </div>
      {!projects.length && <p className="project-detail-empty">No accessible projects yet.</p>}
    </Card>
  );
}
