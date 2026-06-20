import { oldWay, newWay } from './data';

export function Comparison() {
  return (
    <section className="landing-section landing-compare">
      <div className="compare-header" data-reveal>
        <div className="section-label">Why switch</div>
        <h2>Spreadsheets can't run a shop.</h2>
        <p className="section-sub">See what changes the day you move off notebooks and Excel.</p>
      </div>

      <div className="compare-grid">
        <div className="compare-col old" data-reveal>
          <div className="compare-tag">The old way</div>
          <ul>
            {oldWay.map((t) => (
              <li key={t}><span className="x">✕</span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="compare-col new" data-reveal style={{ transitionDelay: '90ms' }}>
          <div className="compare-tag accent">With VillageStock</div>
          <ul>
            {newWay.map((t) => (
              <li key={t}><span className="c">✓</span>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
