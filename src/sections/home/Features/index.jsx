import Container from '../../../components/common/Container';
import SectionHeading from '../../../components/common/SectionHeading';
import FeatureCard from '../../../components/marketing/FeatureCard';

const features = [
  {
    title: 'Project Planning',
    description: 'Map initiatives, assign owners, and create roadmaps with clear milestones and dependencies.',
    accent: '#6fa8ff',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19.5V8.5m7 11V4.5m7 15v-8" />
      </svg>
    )
  },
  {
    title: 'Real-Time Tracking',
    description: 'Monitor project health, task progress, and blockers instantly from one flexible workspace.',
    accent: '#7c9cff',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 15.5l4-4 3 3 7-8" />
      </svg>
    )
  },
  {
    title: 'Team Collaboration',
    description: 'Keep discussion, workstreams, and launches aligned with handoffs built for cross-functional teams.',
    accent: '#44c4a7',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm7 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3.5 18.5a4.5 4.5 0 019 0M11.5 18.5a4.5 4.5 0 019 0" />
      </svg>
    )
  },
  {
    title: 'Analytics & AI Insights',
    description: 'Surface trends, predict risks early, and turn operational data into smarter decisions.',
    accent: '#d58bf5',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 18.5h12M8 15l3-5 3 2 4-7" />
      </svg>
    )
  }
];

export default function Features() {
  return (
    <section id="features" className="feature-section">
      <Container>
        <SectionHeading
          eyebrow="Why teams choose Planwise"
          title="Built to keep execution clear at every stage"
          description="From strategy to completion, Planwise keeps roadmap planning, delivery work, and stakeholder visibility in sync."
        />
        <div className="features-grid">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              accent={feature.accent}
              icon={feature.icon}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
