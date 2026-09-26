export default function Card({ children, className = '', as: Component = 'div' }) {
  return <Component className={`dashboard-card ${className}`.trim()}>{children}</Component>;
}
