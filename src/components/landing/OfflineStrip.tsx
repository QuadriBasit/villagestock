const badges = [
  'Local-first (IndexedDB)',
  'Supabase cloud sync',
  'Background sync queue',
  'Realtime updates',
  'Installable PWA',
];

export function OfflineStrip() {
  return (
    <section className="offline-strip" data-reveal>
      <div className="offline-text">
        <div className="section-label">Local-first</div>
        <h3>Works offline. Syncs automatically.</h3>
        <p>
          VillageStock is built local-first. Your data lives on your device so you
          keep selling even with no internet. When connectivity returns, everything
          syncs seamlessly to the cloud — no lost sales, no double entry.
        </p>
      </div>
      <div className="offline-badges">
        {badges.map((b) => (
          <span className="landing-badge" key={b}>{b}</span>
        ))}
      </div>
    </section>
  );
}
