import { PAID_PLANS, COMING_SOON_CTA } from '@/lib/plans';

type Props = {
  /** Larger padding for overlay context */
  variant?: 'default' | 'compact';
};

export default function PlanPickerGrid({ variant = 'default' }: Props) {
  const pad = variant === 'compact' ? 'p-3' : 'p-4';
  const grid = variant === 'compact' ? 'gap-2' : 'gap-3';

  return (
    <div className={`grid sm:grid-cols-3 ${grid}`}>
      {PAID_PLANS.map(plan => (
        <div
          key={plan.id}
          className={`ui-card rounded-2xl ${pad} flex flex-col ${
            plan.highlight ? 'border-primary shadow-md ring-2 ring-primary/20' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-heading font-semibold text-dark">{plan.title}</h4>
              <p className="text-lg font-bold text-primary mt-0.5">{plan.priceLabel}</p>
            </div>
            {plan.highlight && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                Popular
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1">{plan.blurb}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-dark flex-1">
            {plan.features.map(f => (
              <li key={f} className="flex gap-2">
                <span className="text-primary shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-4 w-full rounded-xl border border-border bg-surface py-2.5 text-xs font-medium text-muted cursor-not-allowed"
          >
            {COMING_SOON_CTA}
          </button>
        </div>
      ))}
    </div>
  );
}
