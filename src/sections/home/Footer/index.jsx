import Container from '../../../components/common/Container';

const footerColumns = [
  {
    title: 'Product',
    items: ['Overview', 'Features', 'Solutions', 'Integrations']
  },
  {
    title: 'Company',
    items: ['About', 'Team', 'Careers', 'Contact']
  },
  {
    title: 'Resources',
    items: ['Guides', 'Documentation', 'Support', 'Blog']
  }
];

export default function Footer() {
  return (
    <footer id="about" className="site-footer">
      <Container>
        <div className="footer-grid">
          <div className="footer-brand-block">
            <div className="brand footer-brand">
              <span className="brand-mark-small">P</span>
              <span>Planwise</span>
            </div>
            <p>Plan smarter. Execute better. Turn ambitious work into measurable progress.</p>
            <div className="social-row">
              <span>X</span>
              <span>in</span>
              <span>◎</span>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="footer-column">
              <h3>{column.title}</h3>
              <ul>
                {column.items.map((item) => (
                  <li key={item}>
                    <a href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>© 2026 Planwise</span>
          <span>Privacy</span>
          <span>Terms</span>
          <span>hello@planwise.io</span>
        </div>
      </Container>
    </footer>
  );
}
