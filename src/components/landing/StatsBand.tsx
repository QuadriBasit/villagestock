import { useCountUp } from './hooks';

function Stat({
  target,
  prefix = '',
  suffix = '',
  label,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  const { ref, value } = useCountUp(target);
  return (
    <div className="stat-item">
      <div className="stat-number">
        {prefix}
        <span ref={ref}>{value.toLocaleString()}</span>
        {suffix}
      </div>
      <div className="stat-caption">{label}</div>
    </div>
  );
}

export function StatsBand() {
  return (
    <section className="stats-band">
      <div className="stats-grid" data-reveal>
        <Stat target={3200} suffix="+" label="Items tracked daily" />
        <Stat target={99} suffix="%" label="Offline uptime" />
        <Stat target={45} suffix="s" label="Avg. sale checkout" />
        <Stat target={12} suffix="+" label="Branches supported" />
      </div>
    </section>
  );
}
