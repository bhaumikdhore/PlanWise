import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';

export default function CTA({ onNavigate }) {
  return (
    <section className="cta-section">
      <Container>
        <div className="cta-card glass-card">
          <div>
            <span className="eyebrow">Ready to move faster?</span>
            <h2>Turn plans into momentum.</h2>
          </div>
          <div className="cta-actions">
            <Button type="button" variant="primary" onClick={() => onNavigate('register')}>
              Start planning
            </Button>
            <Button type="button" variant="secondary" onClick={() => onNavigate('login')}>
              Talk to sales
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
