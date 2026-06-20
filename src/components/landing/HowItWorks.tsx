import { steps } from './data';

export function HowItWorks() {
  return (
    <section className="landing-section landing-how" id="how">
      <div style={{ textAlign: 'center' }} data-reveal>
        <div className="section-label">How it works</div>
        <h2>Up and running in minutes.</h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          No installs, no IT team, no training week. Four simple steps.
        </p>
      </div>
      <div className="steps">
        {steps.map((s, i) => (
          <div className="step" data-reveal style={{ transitionDelay: `${i * 90}ms` }} key={s.title}>
            <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
            <h4>{s.title}</h4>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
