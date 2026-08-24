import { cn } from '@/lib/utils';
import { PAID_PLANS, COMING_SOON_CTA } from '@/lib/plans';
import {
  billingPlanBlurb,
  billingPlanCard,
  billingPlanCta,
  billingPlanFeature,
  billingPlanPrice,
  billingPlanTitle,
} from '@/components/billing/billingUi';

type Props = {
  /** Larger padding for overlay context */
  variant?: 'default' | 'compact';
};

export default function PlanPickerGrid({ variant = 'default' }: Props) {
  const grid = variant === 'compact' ? 'gap-2' : 'gap-3';

  return (
    <div className={cn('grid sm:grid-cols-3', grid)}>
      {PAID_PLANS.map(plan => (
        <div key={plan.id} className={billingPlanCard(plan.highlight)}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={billingPlanTitle}>{plan.title}</h4>
              <p className={cn(billingPlanPrice, 'mt-0.5')}>{plan.priceLabel}</p>
            </div>
            {plan.highlight ? (
              <span className="shrink-0 rounded-full bg-brand-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                Popular
              </span>
            ) : null}
          </div>
          <p className={cn(billingPlanBlurb, 'mt-1')}>{plan.blurb}</p>
          <ul className="mt-3 flex-1 space-y-1.5">
            {plan.features.map(f => (
              <li key={f} className={cn(billingPlanFeature, 'flex gap-2')}>
                <span className="shrink-0 text-brand-300">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button type="button" disabled className={billingPlanCta}>
            {COMING_SOON_CTA}
          </button>
        </div>
      ))}
    </div>
  );
}
