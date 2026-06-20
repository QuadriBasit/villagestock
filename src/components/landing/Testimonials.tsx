import { testimonials } from './data';

export function Testimonials() {
  return (
    <section className="landing-section landing-testimonials">
      <div style={{ textAlign: 'center' }} data-reveal>
        <div className="section-label">Loved by shop owners</div>
        <h2>Don't just take our word for it.</h2>
      </div>
      <div className="testi-grid">
        {testimonials.map((t, i) => (
          <figure className="testi-card" data-reveal style={{ transitionDelay: `${i * 80}ms` }} key={t.name}>
            <div className="testi-stars">★★★★★</div>
            <blockquote>“{t.quote}”</blockquote>
            <figcaption>
              <span className="testi-avatar">{t.initials}</span>
              <span>
                <span className="testi-name">{t.name}</span>
                <span className="testi-role">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
