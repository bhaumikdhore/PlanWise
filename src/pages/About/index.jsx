import { useEffect, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import MarketingLayout from '../../layouts/MarketingLayout';

const problems = [
  ['Scattered tasks', 'Bring work and everyday priorities into one clear view.', '▤'],
  ['Missed deadlines', 'Make important dates visible before they become urgent.', '◷'],
  ['Poor organization', 'Turn loose notes and ideas into an intentional plan.', '◫'],
  ['Hard-to-track goals', 'Keep long-term goals connected to the next small step.', '◎'],
  ['Limited progress visibility', 'See momentum clearly as work moves forward.', '◔']
];

const journey = [
  ['Chaos', 'Capture everything that needs your attention.', '✦'],
  ['Organize', 'Group tasks, schedules, and goals into a clear structure.', '▤'],
  ['Plan', 'Choose priorities and define the next useful action.', '◷'],
  ['Track', 'Follow progress and adjust when plans change.', '◔'],
  ['Achieve', 'Finish meaningful work with confidence and visibility.', '✓']
];

function Reveal({ children, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`about-reveal ${visible ? 'is-visible' : ''} ${className}`}>{children}</div>;
}

export default function AboutPage({ onNavigate }) {
  return (
    <MarketingLayout onNavigate={onNavigate} backgroundVariant="about">
      <main id="about" className="about-page">
        <div className="about-atmosphere" aria-hidden="true">
          <span className="about-calendar-shape" />
          <span className="about-task-shape">✓<i /><i /><i /></span>
          <span className="about-timeline-shape" />
          <span className="about-goal-shape" />
          <span className="about-particle about-particle-a" />
          <span className="about-particle about-particle-b" />
        </div>

        <section className="about-hero">
          <span className="eyebrow">The Planwise approach</span>
          <h1>Plan With Purpose</h1>
          <p>Planwise is a productivity and planning platform designed to help you organize tasks, schedules, goals, and everyday activities with more clarity.</p>
        </section>

        <section className="about-intro-grid">
          <Reveal className="about-copy-card glass-card"><span className="panel-kicker">About Planwise</span><h2>Planning should create clarity, not more work.</h2><p>Planwise brings the pieces of a busy life into one focused workspace. It helps you decide what matters, make time for it, and keep a visible sense of progress as plans evolve.</p></Reveal>
          <Reveal className="about-mission-card glass-card"><span className="about-orbit-icon">✦</span><span className="panel-kicker">Our Mission</span><blockquote>Make planning simple, intelligent and accessible.</blockquote><p>Every part of Planwise is shaped around that idea: useful structure, thoughtful choices, and a calmer path from intention to action.</p></Reveal>
        </section>

        <section className="about-section-block">
          <div className="about-section-heading"><span className="eyebrow">The problem worth solving</span><h2>What Planwise Solves</h2><p>When planning tools are scattered, the work itself becomes harder to see.</p></div>
          <div className="about-problem-grid">{problems.map(([title, description, icon], index) => <Reveal key={title}><article className="about-problem-card glass-card" style={{ '--about-delay': `${index * 70}ms` }}><span className="about-card-icon">{icon}</span><h3>{title}</h3><p>{description}</p></article></Reveal>)}</div>
        </section>

        <section className="about-section-block about-help-section">
          <div className="about-section-heading"><span className="eyebrow">A clearer path forward</span><h2>How Planwise Helps</h2><p>Move through a simple rhythm that keeps progress visible and purposeful.</p></div>
          <div className="about-journey">{journey.map(([title, description, icon], index) => <Reveal key={title}><article className="about-journey-step"><div className="about-journey-marker"><span>{icon}</span><i /></div><div><small>0{index + 1}</small><h3>{title}</h3><p>{description}</p></div></article></Reveal>)}</div>
        </section>

        <section className="about-innovation glass-card"><div><span className="eyebrow">Technology / Innovation</span><h2>Intelligent planning, grounded in your priorities.</h2><p>Planwise uses structured views of tasks, schedules, goals, and progress to help you make better planning decisions. It keeps the person in control while making the information easier to understand and act on.</p></div><div className="about-innovation-visual" aria-hidden="true"><span className="innovation-ring" /><span className="innovation-line line-one" /><span className="innovation-line line-two" /><span className="innovation-dot dot-one" /><span className="innovation-dot dot-two" /><span className="innovation-dot dot-three" /></div></section>

        <section className="about-cta glass-card"><div><span className="eyebrow">Your next step</span><h2>Start Planning Smarter</h2><p>Make room for the work and moments that matter most.</p></div><Button type="button" variant="primary" onClick={() => onNavigate('register')}>Get Started</Button></section>
      </main>
    </MarketingLayout>
  );
}
