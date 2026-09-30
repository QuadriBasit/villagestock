import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="landing-hero" id="top">
      <div className="hero-copy">
        <p className="hero-eyebrow" data-reveal>
          Built for electronics &amp; gadget retailers
        </p>

        <h1 className="hero-title" data-reveal>
          Run the counter.
          <br />
          Know the stock.
          <br />
          <span className="hero-title-accent">Get paid.</span>
        </h1>

        <p className="hero-sub" data-reveal>
          Inventory, sales, repairs, credits, and reporting in one place. Works offline on
          the shop floor, syncs when you are back online.
        </p>

        <div className="hero-ctas" data-reveal>
          <Link to="/auth" className="landing-btn landing-btn-primary landing-btn-lg">
            Start free trial
            <svg className="btn-arrow" viewBox="0 0 24 24" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a href="#how" className="landing-btn landing-btn-ghost landing-btn-lg">
            See how it works
          </a>
        </div>

        <p className="hero-trust" data-reveal>
          14-day free trial · no card · cancel anytime
        </p>
      </div>

      <HeroMockup />
    </section>
  );
}

function HeroMockup() {
  const bars = [40, 55, 35, 80, 62, 90, 70];
  return (
    <div className="mockup-wrap" data-reveal>
      <div className="mockup-glow" aria-hidden />
      <div className="mockup-bar">
        <span className="dot-red" />
        <span className="dot-yellow" />
        <span className="dot-green" />
        <span className="mockup-url">
          <svg className="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
          app.villagestock.com
        </span>
        <span className="mockup-live"><span className="live-dot" /> Live</span>
      </div>
      <div className="landing-dashboard">
        <div className="dash-sidebar">
          <div className="dash-logo">village<span>stock</span></div>
          <div className="nav-item active"><span className="ni" />Dashboard</div>
          <div className="nav-item"><span className="ni" />Inventory</div>
          <div className="nav-item"><span className="ni" />Sales</div>
          <div className="nav-item"><span className="ni" />Repairs</div>
          <div className="nav-item"><span className="ni" />Credits</div>
          <div className="nav-item"><span className="ni" />Reports</div>
          <div className="nav-item"><span className="ni" />Stock sessions</div>
        </div>
        <div className="dash-main">
          <div className="dash-greeting">Today's overview — Ikeja Branch</div>
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-label">Revenue</div>
              <div className="stat-val accent">₦842,500</div>
              <div className="stat-delta up">↑ 12% vs yesterday</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Items sold</div>
              <div className="stat-val">23</div>
              <div className="stat-delta up">↑ 4 units</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net profit</div>
              <div className="stat-val green">₦214,000</div>
              <div className="stat-delta up">↑ 8.3%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active repairs</div>
              <div className="stat-val">7</div>
              <div className="stat-delta warn">2 overdue</div>
            </div>
          </div>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title">Sales this week</div>
              <div className="bar-chart">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="landing-bar"
                    style={{ height: `${h}%`, opacity: i === 6 ? 0.45 : 1, animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="chart-box">
              <div className="chart-title">Outstanding credits</div>
              <ul className="mini-list">
                <li><span>Chukwu Emeka</span><span className="lval">₦45,000</span></li>
                <li><span>Fatima Yusuf</span><span className="lval">₦28,500</span></li>
                <li><span>James Okafor</span><span className="lval">₦12,000</span></li>
                <li><span>Amaka Nwosu</span><span className="lval">₦8,750</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
