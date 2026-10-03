export default function AuthCard({ title, subtitle, children, linkLabel, onLinkClick, className = '' }) {
  return (
    <div className={`auth-card glass-card ${className}`.trim()}>
      <div className="auth-header">
        <span className="auth-kicker">Planwise</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
      {linkLabel ? (
        <button type="button" className="text-button auth-link" onClick={onLinkClick}>
          {linkLabel}
        </button>
      ) : null}
    </div>
  );
}
