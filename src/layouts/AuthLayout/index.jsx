import planwiseLogo from '../../assets/logo/planwise-logo.svg';

export default function AuthLayout({ children, variant }) {
  const variantClass = variant ? ` auth-page-shell--${variant}` : '';

  return (
    <div className={`auth-page-shell${variantClass}`}>
      <div className={`auth-layout${variantClass ? ` auth-layout--${variant}` : ''}`}>
        <aside className={`auth-brand-panel${variantClass ? ` auth-brand-panel--${variant}` : ''}`} aria-label="Planwise branding panel">
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <img src={planwiseLogo} alt="Planwise logo" />
            </div>
            <div className="auth-brand-copy">
              <span className="auth-brand-name">Planwise</span>
              <span className="auth-tagline">Plan today. Build tomorrow.</span>
            </div>
          </div>

          <div className="auth-brand-copy-block">
            <p>
              Align priorities, move faster, and turn ambitious goals into steady progress with your team.
            </p>
          </div>

          <div className="auth-background-orbs" aria-hidden="true">
            <span className="orb orb-one" />
            <span className="orb orb-two" />
            <span className="orb orb-three" />
          </div>

          <div className="auth-particles" aria-hidden="true">
            <span className="particle particle-one" />
            <span className="particle particle-two" />
            <span className="particle particle-three" />
            <span className="particle particle-four" />
            <span className="particle particle-five" />
          </div>
        </aside>

        <main className="auth-content-panel">{children}</main>
      </div>
    </div>
  );
}
