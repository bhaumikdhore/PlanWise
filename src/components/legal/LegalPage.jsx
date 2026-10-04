import MarketingLayout from '../../layouts/MarketingLayout';

export default function LegalPage({ title, intro, sections, onNavigate }) {
  return (
    <MarketingLayout onNavigate={onNavigate}>
      <div className="legal-page page-transition">
        <div className="legal-document">
          <a className="legal-back-link" href="/" onClick={(event) => { event.preventDefault(); onNavigate('home'); }}>
            ← Back to Planwise
          </a>
          <header className="legal-header">
            <span className="legal-eyebrow">Planwise · Legal</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            <span className="legal-effective-date">Effective date: October 4, 2026</span>
          </header>
          <nav className="legal-toc" aria-label={`${title} contents`}>
            <strong>On this page</strong>
            <div>
              {sections.map((section, index) => (
                <a key={section.title} href={`#legal-section-${index + 1}`}>{section.title}</a>
              ))}
            </div>
          </nav>
          <article className="legal-content">
            {sections.map((section, index) => (
              <section id={`legal-section-${index + 1}`} key={section.title}>
                <h2>{index + 1}. {section.title}</h2>
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
                {section.items && (
                  <ul>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </article>
          <aside className="legal-contact">
            Questions about this document? Contact <strong>[Planwise privacy or legal contact email]</strong>.
            Replace this placeholder and have the document reviewed before publication.
          </aside>
          <div className="legal-cross-links">
            <a href="/privacy" onClick={(event) => { event.preventDefault(); onNavigate('privacy'); }}>Privacy Policy</a>
            <a href="/terms" onClick={(event) => { event.preventDefault(); onNavigate('terms'); }}>Terms of Service</a>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
