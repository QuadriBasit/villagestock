export function WhoItsFor() {
  return (
    <section className="landing-section landing-who" id="who">
      <div data-reveal>
        <div className="section-label">Who it's for</div>
        <h2>One tool. Every shop size.</h2>
        <p className="section-sub">
          Whether you run a single counter or a multi-location chain, VillageStock
          scales with you.
        </p>
      </div>

      <div className="who-grid">
        <div className="who-card" data-reveal>
          <h3>Single-location shops</h3>
          <p>
            Perfect for independent phone and gadget retailers who need professional
            tools without the enterprise complexity or price tag.
          </p>
          <ul className="check-list">
            <li>Full inventory and sales management</li>
            <li>Repair tracking and credit management</li>
            <li>Daily stock sessions and audit trail</li>
            <li>PDF reports and branded receipts</li>
            <li>Works offline — no internet required to sell</li>
          </ul>
        </div>
        <div className="who-card" data-reveal style={{ transitionDelay: '90ms' }}>
          <h3>Multi-branch retailers</h3>
          <p>
            Built for growing businesses with multiple locations, staff to manage,
            and a need for branch-level visibility and control.
          </p>
          <ul className="check-list">
            <li>Branch-scoped inventory and sales data</li>
            <li>Owner / manager / staff role permissions</li>
            <li>Access control for profit and financial info</li>
            <li>Centralized reporting across all branches</li>
            <li>Admin dashboard for business-wide oversight</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
