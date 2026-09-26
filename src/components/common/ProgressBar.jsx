export default function ProgressBar({ value = 0, tone = 'blue', className = '' }) {
  return (
    <div className={`progress-bar ${className}`.trim()}>
      <span className={`progress-fill progress-${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}
