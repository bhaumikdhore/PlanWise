import Container from '../../../components/common/Container';
import StatCard from '../../../components/common/StatCard';

const stats = [
  {
    value: '12k+',
    label: 'Active Users',
    detail: 'weekly growth',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 18a4 4 0 10-8 0M12 12a4 4 0 100-8 4 4 0 000 8zm7 6a4 4 0 00-3.2-3.9M17 4.5a3.7 3.7 0 010 7.1" />
      </svg>
    )
  },
  {
    value: '1.8k',
    label: 'Projects Launched',
    detail: 'this quarter',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5.5h10a2 2 0 012 2V18a2 2 0 01-2 2H7a2 2 0 01-2-2V7.5a2 2 0 012-2zm0 6h10M9 3v5m6-5v5" />
      </svg>
    )
  },
  {
    value: '220',
    label: 'Organizations',
    detail: 'scaling globally',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19.5V9.5l8-5 8 5v10M8 19.5v-6h8v6M12 9.5h.01" />
      </svg>
    )
  },
  {
    value: '87%',
    label: 'Progress Clarity',
    detail: 'team aligned',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 16.5V10m7 6.5V5m7 11.5v-8" />
      </svg>
    )
  }
];

export default function Stats() {
  return (
    <section className="stats-section">
      <Container>
        <div className="stats-grid">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              detail={stat.detail}
              icon={stat.icon}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
