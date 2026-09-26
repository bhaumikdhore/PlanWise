import { useEffect, useRef, useState } from 'react';

function parseNumber(value) {
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export default function StatCard({ value, label, detail, icon }) {
  const ref = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const target = parseNumber(value);
    const duration = 1100;
    const start = performance.now();

    let frameId;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isVisible, value]);

  const formattedValue =
    value.includes('k') || value.includes('K')
      ? `${(displayValue / 1000).toFixed(displayValue >= 1000 ? 1 : 2).replace(/\.0$/, '')}k+`
      : value.includes('%')
        ? `${Math.round(displayValue)}%`
        : value.includes('+')
          ? `${Math.round(displayValue)}+`
          : `${Math.round(displayValue)}`;

  return (
    <div ref={ref} className="stat-card glass-card">
      <div className="stat-card-top">
        <div className="stat-icon">{icon}</div>
        <span className="trend-badge">+12%</span>
      </div>
      <strong>{formattedValue}</strong>
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
