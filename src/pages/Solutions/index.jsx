import { useEffect, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import MarketingLayout from '../../layouts/MarketingLayout';

const solutions = [
  {
    title: 'Students',
    description: 'Turn busy semesters into a clear, achievable study rhythm.',
    icon: '▤',
    accent: '#6fa8ff',
    items: ['Study planning', 'Assignment tracking', 'Exam preparation', 'Daily schedules']
  },
  {
    title: 'Professionals',
    description: 'Keep work planning, meetings, and deadlines moving together.',
    icon: '◷',
    accent: '#8a7dff',
    items: ['Work planning', 'Meeting organization', 'Deadline tracking', 'Productivity management']
  },
  {
    title: 'Teams',
    description: 'Give every team a shared view of priorities, progress, and goals.',
    icon: '◎',
    accent: '#44c4a7',
    items: ['Shared planning', 'Task coordination', 'Progress tracking', 'Team goals']
  },
  {
    title: 'Personal Life',
    description: 'Make space for routines, goals, events, and the life around work.',
    icon: '✦',
    accent: '#d58bf5',
    items: ['Daily routines', 'Personal goals', 'Important events', 'Habit planning']
  }
];

function SolutionCard({ solution, index, onNavigate }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const detailId = `solution-detail-${index}`;

  const toggleExpanded = () => setExpanded((value) => !value);
  const handleCardKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={cardRef} tabIndex="0" aria-label={`${solution.title} solution`} onClick={(event) => { if (!event.target.closest('button')) toggleExpanded(); }} onKeyDown={handleCardKeyDown} className={`solution-card glass-card${visible ? ' is-visible' : ''}${expanded ? ' is-expanded' : ''}`} style={{ '--solution-accent': solution.accent, '--reveal-delay': `${index * 90}ms` }}>
      <div className="solution-card-top">
        <div className="solution-icon" aria-hidden="true">{solution.icon}</div>
        <span className="solution-index">0{index + 1}</span>
      </div>
      <h2>{solution.title}</h2>
      <p>{solution.description}</p>
      <ul className="solution-list">
        {solution.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}
      </ul>
      <Button type="button" variant="secondary" className="solution-explore" onClick={toggleExpanded} aria-expanded={expanded} aria-controls={detailId}>
        {expanded ? 'Selected Solution' : 'Explore Solution'} <span>{expanded ? '↓' : '→'}</span>
      </Button>
      <div id={detailId} className={`solution-detail${expanded ? ' is-open' : ''}`} aria-hidden={!expanded}>
        <p>Build a focused Planwise workspace around {solution.title.toLowerCase()} priorities and keep every next step visible.</p>
        <ul className="solution-detail-list">
          {solution.items.map((item) => <li key={item}><span>+</span>{item} workspace</li>)}
        </ul>
        <div className="solution-detail-actions">
          <Button type="button" variant="primary" disabled={!expanded} onClick={() => onNavigate('register')}>Get Started</Button>
          <button type="button" className="solution-close" disabled={!expanded} onClick={toggleExpanded}>Close</button>
        </div>
      </div>
    </article>
  );
}

export default function SolutionsPage({ onNavigate }) {
  return (
    <MarketingLayout onNavigate={onNavigate} backgroundVariant="solutions">
      <main id="solutions" className="solutions-page">
        <div className="solutions-atmosphere" aria-hidden="true">
          <span className="solution-calendar-shape" />
          <span className="solution-list-shape"><i /><i /><i /></span>
          <span className="solution-goal-shape" />
          <span className="solution-line-shape" />
          <span className="solution-particle solution-particle-a" />
          <span className="solution-particle solution-particle-b" />
          <span className="solution-particle solution-particle-c" />
        </div>
        <section className="solutions-page-hero">
          <span className="eyebrow">Made for your kind of planning</span>
          <h1>Planning Solutions For Every Need</h1>
          <p>Whether you are studying, leading a team, or organizing life, Planwise turns competing priorities into a plan you can trust.</p>
        </section>
        <section className="solutions-page-grid" aria-label="Planwise solutions">
          {solutions.map((solution, index) => <SolutionCard key={solution.title} solution={solution} index={index} onNavigate={onNavigate} />)}
        </section>
      </main>
    </MarketingLayout>
  );
}
