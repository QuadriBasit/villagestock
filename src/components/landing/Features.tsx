import { features } from './data';

export function Features() {
  return (
    <section className="landing-section landing-features" id="features">
      <div className="features-header" data-reveal>
        <div className="section-label">Features</div>
        <h2>Everything your shop needs,<br />nothing it doesn't.</h2>
        <p className="section-sub">
          From the sales floor to the stockroom, VillageStock handles every part
          of running a modern electronics business — and replaces the pile of
          notebooks and spreadsheets you're juggling today.
        </p>
      </div>

      <div className="feat-grid">
        {features.map((f, i) => (
          <div className="feat-card" data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }} key={f.title}>
            <div className="feat-icon" dangerouslySetInnerHTML={{ __html: f.icon }} />
            <div className="feat-title">{f.title}</div>
            <div className="feat-desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
