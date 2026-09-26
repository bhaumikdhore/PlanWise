import { useEffect, useRef } from 'react';

const calendarCells = Array.from({ length: 6 });
const checklistItems = Array.from({ length: 3 });

export default function AnimatedPlanningBackground({ variant = 'default' }) {
  const backgroundRef = useRef(null);

  useEffect(() => {
    const background = backgroundRef.current;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsPointer = window.matchMedia('(pointer: fine)').matches;
    if (!background || prefersReducedMotion || !supportsPointer) return undefined;

    let frame = 0;
    const updateParallax = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = ((event.clientX / window.innerWidth) - 0.5) * 2;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 2;
        background.style.setProperty('--pointer-x', x.toFixed(3));
        background.style.setProperty('--pointer-y', y.toFixed(3));
      });
    };

    window.addEventListener('pointermove', updateParallax, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', updateParallax);
    };
  }, []);

  return (
    <div ref={backgroundRef} className={`planning-background planning-background-${variant}`} aria-hidden="true">
      <div className="planning-orb planning-orb-one" />
      <div className="planning-orb planning-orb-two" />
      <div className="planning-calendar planning-float planning-depth-one">
        <span className="planning-calendar-head" />
        <div className="planning-calendar-grid">{calendarCells.map((_, index) => <i key={index} />)}</div>
      </div>
      <div className="planning-checklist planning-float planning-depth-two">
        {checklistItems.map((_, index) => <span key={index}><i /> <b /></span>)}
      </div>
      <div className="planning-progress planning-float planning-depth-one"><i /></div>
      <div className="planning-goal planning-float planning-depth-two"><span>✦</span></div>
      <div className="planning-timeline planning-depth-three"><i /><i /><i /><b /></div>
      <div className="planning-connection planning-depth-two"><i /><i /><i /></div>
      <div className="planning-icon planning-icon-check planning-float">✓</div>
      <div className="planning-icon planning-icon-clock planning-float">◷</div>
      <div className="planning-dots"><i /><i /><i /><i /><i /></div>
    </div>
  );
}
