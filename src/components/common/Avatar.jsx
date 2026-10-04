export default function Avatar({ initials, size = 'md', active = false, className = '', src = '', alt = 'Profile photo' }) {
  return (
    <div className={`avatar avatar-${size} ${active ? 'avatar-active' : ''} ${className}`.trim()}>
      {src ? <img className="avatar-photo" src={src} alt={alt} /> : initials}
    </div>
  );
}
