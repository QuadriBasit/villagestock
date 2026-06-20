import { useState } from 'react';
import { faqs } from './data';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-icon" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div className="faq-a-wrap">
        <p className="faq-a">{a}</p>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section className="landing-section landing-faq" id="faq">
      <div className="faq-head" data-reveal>
        <div className="section-label">FAQ</div>
        <h2>Questions, answered.</h2>
        <p className="section-sub">Everything you need to know before getting started.</p>
      </div>
      <div className="faq-list" data-reveal>
        {faqs.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>
    </section>
  );
}
