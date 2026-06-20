import { useState } from 'react';
import { Link } from 'react-router-dom';

const PRO_MONTHLY = 12500;
const PRO_ANNUAL = Math.round(PRO_MONTHLY * 12 * 0.8); // 20% off annual

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="landing-section landing-pricing" id="pricing">
      <div data-reveal>
        <div className="section-label">Pricing</div>
        <h2>Simple, transparent pricing.</h2>
        <p className="section-sub" style={{ margin: '0 auto 28px' }}>
          Start free, no credit card required. Upgrade as your business grows.
        </p>

        <div className="billing-toggle">
          <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
          <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
            Annual <span className="save-pill">Save 20%</span>
          </button>
        </div>
      </div>

      <div className="price-grid">
        <div className="price-card" data-reveal>
          <div className="price-tier">Starter</div>
          <div className="price-amount">Free</div>
          <div className="price-period">14-day trial, then ₦0/mo</div>
          <ul className="price-features">
            <li>1 branch location</li>
            <li>Up to 200 inventory items</li>
            <li>Sales &amp; receipts</li>
            <li>Basic reports</li>
            <li>Offline mode</li>
          </ul>
          <Link to="/auth" className="landing-btn landing-btn-ghost btn-block">Get started</Link>
        </div>

        <div className="price-card featured" data-reveal style={{ transitionDelay: '80ms' }}>
          <div className="price-badge">Most popular</div>
          <div className="price-tier">Pro</div>
          <div className="price-amount">
            ₦{(annual ? Math.round(PRO_ANNUAL / 12) : PRO_MONTHLY).toLocaleString()}
          </div>
          <div className="price-period">
            {annual ? `per month, billed ₦${PRO_ANNUAL.toLocaleString()}/yr` : 'per month, per branch'}
          </div>
          <ul className="price-features">
            <li>Unlimited inventory</li>
            <li>Repairs &amp; credit tracking</li>
            <li>Stock sessions &amp; audit log</li>
            <li>Full PDF report exports</li>
            <li>Staff roles &amp; permissions</li>
            <li>Priority support</li>
          </ul>
          <Link to="/auth" className="landing-btn landing-btn-primary btn-block">Start free trial</Link>
        </div>

        <div className="price-card" data-reveal style={{ transitionDelay: '160ms' }}>
          <div className="price-tier">Enterprise</div>
          <div className="price-amount">Custom</div>
          <div className="price-period">tailored for chains &amp; franchises</div>
          <ul className="price-features">
            <li>Unlimited branches</li>
            <li>Centralized admin dashboard</li>
            <li>Custom onboarding</li>
            <li>Dedicated account manager</li>
            <li>SLA &amp; compliance support</li>
          </ul>
          <a href="mailto:hello@villagestock.com" className="landing-btn landing-btn-ghost btn-block">Contact us</a>
        </div>
      </div>
    </section>
  );
}
