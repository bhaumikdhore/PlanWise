export default function FeatureCard({ title, description, accent, icon }) {
  return (
    <article className="feature-card glass-card">
      <div className="feature-card-head">
        <div className="feature-icon" style={{ '--accent': accent }}>
          {icon}
        </div>
        <span className="feature-arrow">→</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
