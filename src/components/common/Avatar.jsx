export default function Avatar({ initials, size = 'md', active = false, className = '' }) {
  return (
    <div className={`avatar avatar-${size} ${active ? 'avatar-active' : ''} ${className}`.trim()}>
      {initials}
    </div>
  );
}
