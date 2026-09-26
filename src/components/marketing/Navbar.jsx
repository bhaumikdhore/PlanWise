import { useEffect, useState } from 'react';
import planwiseLogo from '../../assets/logo/planwise-logo.svg';
import Button from '../common/Button';

const navItems = [
  { label: 'Home', id: 'home' },
  { label: 'Features', id: 'features' },
  { label: 'Solutions', id: 'solutions' },
  { label: 'About', id: 'about' }
];

export default function Navbar({ onNavigate }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-18% 0px -65% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => (event) => {
    event.preventDefault();
    if (id === 'features' || id === 'solutions' || id === 'about') {
      onNavigate(id);
      setMenuOpen(false);
      return;
    }

    if (!document.getElementById(id)) {
      onNavigate('home');
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      setMenuOpen(false);
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
    setMenuOpen(false);
  };

  const navigateFromMenu = (view) => {
    setMenuOpen(false);
    onNavigate(view);
  };

  return (
    <header className={`site-header${isScrolled ? ' scrolled' : ''}`}>
      <div className={`container nav-shell glass-card${menuOpen ? ' mobile-open' : ''}`}>
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={() => navigateFromMenu('home')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              navigateFromMenu('home');
            }
          }}
        >
          <img src={planwiseLogo} alt="Planwise logo" className="brand-mark" />
          <span>Planwise</span>
        </div>

        <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Toggle navigation menu">
          {menuOpen ? '×' : '☰'}
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={`nav-link${activeSection === item.id ? ' active' : ''}`} onClick={scrollToSection(item.id)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <button type="button" className="text-button" onClick={() => navigateFromMenu('login')}>
            Login
          </button>
          <Button type="button" variant="primary" onClick={() => navigateFromMenu('register')}>
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
