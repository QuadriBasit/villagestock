import { Link } from 'react-router-dom';

export function CallToAction() {
  return (
    <section className="cta-section">
      <div className="cta-inner" data-reveal>
        <div className="section-label">Get started</div>
        <h2>Your shop deserves better than a spreadsheet.</h2>
        <p>
          Join electronics retailers already running smarter with VillageStock.
          Free trial. No credit card required.
        </p>
        <Link to="/auth" className="landing-btn landing-btn-primary landing-btn-lg">
          Start your free trial
          <svg className="btn-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    </section>
  );
}
