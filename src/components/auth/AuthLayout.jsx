export default function AuthLayout({ children, pageTitle }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-glow" />
        <div className="auth-panel glass-card">
          <span className="auth-panel-label">{pageTitle}</span>
          <div className="mini-dashboard">
            <div className="mini-bar large" />
            <div className="mini-bar" />
            <div className="mini-bar mid" />
            <div className="mini-chart">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className="auth-content">{children}</div>
    </div>
  );
}
