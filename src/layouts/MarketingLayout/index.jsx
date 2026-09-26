import Navbar from '../../components/marketing/Navbar';
import AnimatedPlanningBackground from '../../components/common/AnimatedPlanningBackground';

export default function MarketingLayout({ children, onNavigate, backgroundVariant = 'default' }) {
  return (
    <div className="app-shell marketing-shell">
      <Navbar onNavigate={onNavigate} />
      <main className="page-transition">
        <AnimatedPlanningBackground variant={backgroundVariant} />
        {children}
      </main>
    </div>
  );
}
