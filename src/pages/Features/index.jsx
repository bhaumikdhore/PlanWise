import { useEffect, useRef, useState } from 'react';
import FeatureCard from '../../components/marketing/FeatureCard';
import MarketingLayout from '../../layouts/MarketingLayout';

const features = [
  { title: 'Smart Task Management', description: 'Create, organize and prioritize tasks.', accent: '#6fa8ff', icon: '✓' },
  { title: 'Intelligent Scheduling', description: 'Manage schedules, deadlines and important events.', accent: '#8a7dff', icon: '◷' },
  { title: 'Goal Tracking', description: 'Set goals and track progress over time.', accent: '#44c4a7', icon: '◎' },
  { title: 'Personalized Planning', description: 'Create plans according to individual priorities.', accent: '#d58bf5', icon: '✦' },
  { title: 'Progress Analytics', description: 'Visualize productivity and completed tasks.', accent: '#f4b95f', icon: '◔' },
  { title: 'Notifications & Reminders', description: 'Never miss important activities.', accent: '#6fa8ff', icon: '!' }
];

function RevealCard({ feature, index }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

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
    <div ref={cardRef} className={`feature-page-reveal${visible ? ' is-visible' : ''}`} style={{ '--reveal-delay': `${index * 80}ms` }}>
      <FeatureCard {...feature} />
    </div>
  );
}

export default function FeaturesPage({ onNavigate }) {
  return (
    <MarketingLayout onNavigate={onNavigate} backgroundVariant="features">
      <main id="features" className="features-page">
        <div className="features-atmosphere" aria-hidden="true">
          <span className="feature-calendar-shape" />
          <span className="feature-check-shape">✓</span>
          <span className="feature-ring-shape" />
          <span className="feature-timeline-shape" />
          <span className="feature-particle particle-a" />
          <span className="feature-particle particle-b" />
          <span className="feature-particle particle-c" />
        </div>
        <section className="features-page-hero">
          <span className="eyebrow">Planwise capabilities</span>
          <h1>Everything You Need to Plan Better</h1>
          <p>Bring priorities, schedules, and progress into one calm workspace built for meaningful momentum.</p>
        </section>
        <section className="features-page-grid" aria-label="Planwise features">
          {features.map((feature, index) => <RevealCard key={feature.title} feature={feature} index={index} />)}
        </section>
      </main>
    </MarketingLayout>
  );
}