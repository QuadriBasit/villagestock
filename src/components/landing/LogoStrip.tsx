import { marqueeItems } from './data';

export function LogoStrip() {
  return (
    <section className="logo-strip" data-reveal>
      <p className="logo-strip-label">Trusted by gadget shops across Nigeria &amp; beyond</p>
      <div className="marquee">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span className="marquee-item" key={i}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
