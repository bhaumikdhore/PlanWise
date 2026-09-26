import Button from '../../../components/common/Button';
import Container from '../../../components/common/Container';

export default function Hero({ onNavigate }) {
  return (
    <section id="home" className="hero-section">
      <Container className="hero-shell">
        <div className="hero-copy fade-in-up">
          <span className="eyebrow">Built for ambitious teams</span>
          <h1>
            Plan <span>Smarter.</span> Execute <span>Better.</span>
          </h1>
          <p>
            Align your roadmap, coordinate execution, and move faster with a workspace designed to
            keep projects clear, teams focused, and outcomes measurable.
          </p>
          <div className="hero-actions">
            <Button type="button" variant="primary" onClick={() => onNavigate('register')}>
              Start planning
            </Button>
            <Button type="button" variant="secondary" onClick={() => onNavigate('login')}>
              View demo
            </Button>
          </div>
          <div className="trust-row">
            <div>
              <strong>4.9/5</strong>
              <span>customer satisfaction</span>
            </div>
            <div>
              <strong>20k+</strong>
              <span>monthly active teams</span>
            </div>
          </div>
        </div>

        <div className="hero-visual fade-in-up delay-1">
          <div className="hero-floating-card floating-calendar">
            <div className="mini-card-header">
              <span className="mini-label">Calendar</span>
              <span className="mini-dot accent" />
            </div>
            <div className="calendar-mini">
              <span className="calendar-day active">Mon</span>
              <span className="calendar-day">Tue</span>
              <span className="calendar-day">Wed</span>
              <span className="calendar-day">Thu</span>
            </div>
            <div className="calendar-event-row">
              <span className="event-dot blue" />
              <div>
                <strong>Design Sync</strong>
                <small>09:30 AM</small>
              </div>
            </div>
          </div>

          <div className="hero-floating-card floating-meeting">
            <div className="mini-card-header">
              <span className="mini-label">Meeting</span>
              <span className="mini-chip">Live</span>
            </div>
            <div className="avatar-stack">
              <span>AL</span>
              <span>KM</span>
              <span>JN</span>
            </div>
            <strong>Product review</strong>
            <small>11:00 AM · Zoom</small>
          </div>

          <div className="hero-floating-card floating-progress">
            <div className="mini-card-header">
              <span className="mini-label">Project</span>
              <span className="mini-percent">82%</span>
            </div>
            <div className="progress-line">
              <span style={{ width: '82%' }} />
            </div>
            <small>Launch roadmap</small>
          </div>

          <div className="hero-floating-card floating-analytics">
            <div className="mini-card-header">
              <span className="mini-label">Insights</span>
              <span className="mini-trend up">+24%</span>
            </div>
            <div className="analytics-bars">
              <span style={{ height: '35%' }} />
              <span style={{ height: '52%' }} />
              <span style={{ height: '74%' }} />
              <span style={{ height: '100%' }} />
            </div>
          </div>

          <div className="dashboard-frame glass-card">
            <div className="dashboard-header-row">
              <div className="window-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="header-pill">Q4 launch</div>
            </div>

            <div className="hero-dashboard-grid">
              <aside className="mini-sidebar">
                <span className="active">Overview</span>
                <span>Projects</span>
                <span>Tasks</span>
                <span>Team</span>
              </aside>

              <div className="mini-main">
                <div className="top-summary">
                  <div>
                    <small>Portfolio health</small>
                    <strong>89%</strong>
                  </div>
                  <div className="mini-progress">
                    <span />
                  </div>
                </div>

                <div className="mini-panels">
                  <div className="mini-panel">
                    <span>Tasks closed</span>
                    <strong>1,284</strong>
                    <div className="sparkline">
                      <i /><i /><i /><i /><i /><i />
                    </div>
                  </div>
                  <div className="mini-panel accent">
                    <span>Launch pipeline</span>
                    <strong>7 milestones</strong>
                    <ul>
                      <li>Research</li>
                      <li>Design</li>
                      <li>Delivery</li>
                    </ul>
                  </div>
                </div>

                <div className="task-list-mini">
                  <div className="task-row">
                    <span className="task-dot success" />
                    <span className="task-title">Product roadmap</span>
                    <span className="task-percent">92%</span>
                  </div>
                  <div className="task-row">
                    <span className="task-dot warn" />
                    <span className="task-title">Team onboarding</span>
                    <span className="task-percent">68%</span>
                  </div>
                  <div className="task-row">
                    <span className="task-dot info" />
                    <span className="task-title">CRM rollout</span>
                    <span className="task-percent">84%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
