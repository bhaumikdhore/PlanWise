import Container from '../../../components/common/Container';
import SectionHeading from '../../../components/common/SectionHeading';

export default function DashboardShowcase() {
  return (
    <section className="showcase-section">
      <Container>
        <SectionHeading
          eyebrow="Project visibility"
          title={(
            <>
              See every initiative <span className="gradient-text">in context</span>
            </>
          )}
          description="A dashboard built to give teams the clarity they need to plan, prioritize, and deliver with confidence."
        />

        <div className="showcase-window glass-card">
          <div className="showcase-toolbar">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="toolbar-actions">
              <span>Board view</span>
              <span>Timeline</span>
              <span>Insights</span>
            </div>
          </div>

          <div className="showcase-viewport">
            <svg className="showcase-connectors" viewBox="0 0 760 420" aria-hidden="true">
              <path d="M 80 140 C 150 40, 255 80, 318 130" />
              <path d="M 308 300 C 395 355, 440 320, 480 250" />
              <path d="M 500 125 C 560 85, 650 100, 710 180" />
              <path d="M 630 305 C 675 330, 705 300, 732 248" />
            </svg>

            <div className="connector-node node-one" />
            <div className="connector-node node-two" />
            <div className="connector-node node-three" />
            <div className="connector-node node-four" />

            <div className="showcase-floating-card calendar-card">
              <div className="floating-header">
                <span>Calendar</span>
                <span className="floating-badge">Live</span>
              </div>
              <strong>Plan your schedule</strong>
              <div className="calendar-mini-grid">
                <span className="day active">12</span>
                <span className="day">13</span>
                <span className="day">14</span>
                <span className="day">15</span>
              </div>
            </div>

            <div className="showcase-floating-card meet-card">
              <div className="floating-header">
                <span>Meet</span>
                <span className="floating-badge success">4 people</span>
              </div>
              <strong>Collaborate live</strong>
              <div className="avatar-stack small-stack">
                <span>AL</span>
                <span>LT</span>
                <span>MJ</span>
              </div>
            </div>

            <div className="showcase-floating-card tasks-card">
              <div className="floating-header">
                <span>Tasks</span>
                <span className="floating-badge muted">Today</span>
              </div>
              <strong>Stay on track</strong>
              <div className="tiny-progress-row">
                <span className="tiny-track"><em style={{ width: '74%' }} /></span>
                <small>74%</small>
              </div>
            </div>

            <div className="showcase-floating-card files-card">
              <div className="floating-header">
                <span>Files</span>
                <span className="floating-badge blue">8 shared</span>
              </div>
              <strong>Share resources</strong>
              <div className="file-pill-row">
                <span>Brief</span>
                <span>Deck</span>
                <span>Notes</span>
              </div>
            </div>

            <div className="showcase-floating-card milestone-card">
              <div className="floating-header">
                <span>Project milestone</span>
                <span className="floating-badge warning">QA</span>
              </div>
              <strong>Track progress</strong>
              <div className="milestone-row">
                <span className="dot success" />
                <small>Launch prep</small>
              </div>
            </div>

            <div className="showcase-dashboard">
              <aside className="showcase-sidebar">
                <div className="sidebar-block active">
                  <span>Launch roadmap</span>
                  <strong>12 tasks</strong>
                </div>
                <div className="sidebar-block">
                  <span>Design sprint</span>
                  <strong>8 tasks</strong>
                </div>
                <div className="sidebar-block">
                  <span>Ops review</span>
                  <strong>4 tasks</strong>
                </div>
              </aside>

              <div className="showcase-main">
                <div className="showcase-top-row">
                  <div className="showcase-card large-card">
                    <div className="mini-header">
                      <span>Milestone velocity</span>
                      <strong>+24%</strong>
                    </div>
                    <div className="mini-bars">
                      <span style={{ '--bar-height': '35%', '--delay': '0.1s' }} />
                      <span style={{ '--bar-height': '52%', '--delay': '0.2s' }} />
                      <span style={{ '--bar-height': '48%', '--delay': '0.3s' }} />
                      <span style={{ '--bar-height': '74%', '--delay': '0.4s' }} />
                      <span style={{ '--bar-height': '88%', '--delay': '0.5s' }} />
                      <span style={{ '--bar-height': '100%', '--delay': '0.6s' }} />
                    </div>
                  </div>

                  <div className="showcase-card risk-card">
                    <div className="mini-header">
                      <span>Risk radar</span>
                      <strong>3 alerts</strong>
                    </div>
                    <ul className="risk-list">
                      <li><span className="dot warn" /> Hiring gap</li>
                      <li><span className="dot info" /> Vendor handoff</li>
                      <li><span className="dot success" /> Scope aligned</li>
                    </ul>
                  </div>
                </div>

                <div className="showcase-bottom-row">
                  <div className="showcase-card delivery-card">
                    <div className="mini-header">
                      <span>Delivery mix</span>
                      <strong>72%</strong>
                    </div>
                    <div className="donut-wrap">
                      <div className="donut-chart" style={{ '--value': '72%' }}>
                        <span>72%</span>
                      </div>
                    </div>
                  </div>

                  <div className="showcase-card workload-card">
                    <div className="mini-header">
                      <span>Workload</span>
                      <strong>6 teams</strong>
                    </div>
                    <div className="team-row">
                      <span className="team-pill">Marketing</span>
                      <span className="team-pill">Product</span>
                      <span className="team-pill">Ops</span>
                    </div>
                    <div className="workload-bars">
                      <span style={{ '--bar-width': '64%' }} />
                      <span style={{ '--bar-width': '81%' }} />
                      <span style={{ '--bar-width': '53%' }} />
                    </div>
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
