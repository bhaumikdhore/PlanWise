export default function ProcessStep({ step, title, description }) {
  return (
    <div className="process-step glass-card">
      <span className="process-index">0{step}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
