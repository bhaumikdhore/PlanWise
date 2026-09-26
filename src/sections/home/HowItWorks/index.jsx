import Container from '../../../components/common/Container';
import SectionHeading from '../../../components/common/SectionHeading';
import ProcessStep from '../../../components/marketing/ProcessStep';

const steps = [
  {
    step: 1,
    title: 'Plan',
    description: 'Create goals, organize workstreams, and align teams around a single roadmap.'
  },
  {
    step: 2,
    title: 'Implement',
    description: 'Turn plans into action with tasks, owners, priorities, and collaborative execution.'
  },
  {
    step: 3,
    title: 'Track',
    description: 'Monitor status in real time to catch delays early and keep momentum high.'
  },
  {
    step: 4,
    title: 'Achieve',
    description: 'Measure outcomes, celebrate progress, and refine your next cycle with confidence.'
  }
];

export default function HowItWorks() {
  return (
    <section id="solutions" className="process-section">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From planning to progress in four simple steps"
          description="Planwise keeps the full journey organized, transparent, and easier to manage as teams scale."
        />
        <div className="process-grid">
          {steps.map((step) => (
            <ProcessStep key={step.step} step={step.step} title={step.title} description={step.description} />
          ))}
        </div>
      </Container>
    </section>
  );
}
