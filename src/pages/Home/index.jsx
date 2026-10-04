import MarketingLayout from '../../layouts/MarketingLayout';
import Hero from '../../sections/home/Hero';
import Stats from '../../sections/home/Stats';
import Features from '../../sections/home/Features';
import HowItWorks from '../../sections/home/HowItWorks';
import DashboardShowcase from '../../sections/home/DashboardShowcase';
import CTA from '../../sections/home/CTA';
import Footer from '../../sections/home/Footer';

export default function HomePage({ onNavigate }) {
  return (
    <MarketingLayout onNavigate={onNavigate} backgroundVariant="home">
      <Hero onNavigate={onNavigate} />
      <Stats />
      <Features />
      <HowItWorks />
      <DashboardShowcase />
      <CTA onNavigate={onNavigate} />
      <Footer onNavigate={onNavigate} />
    </MarketingLayout>
  );
}
