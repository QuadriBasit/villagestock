import { cn } from '@/lib/utils';

export const billingPlanCard = (highlight?: boolean) =>
  cn(
    'flex flex-col rounded-xl border border-shell-line bg-shell-surface p-4 shadow-none',
    highlight && 'border-brand-400/35 ring-1 ring-brand-400/20',
  );

export const billingPlanPrice = 'text-lg font-bold text-brand-300';
export const billingPlanTitle = 'font-display font-semibold text-shell-ink';
export const billingPlanBlurb = 'text-xs text-shell-muted';
export const billingPlanFeature = 'text-xs text-shell-ink';
export const billingPlanCta =
  'mt-4 w-full cursor-not-allowed rounded-xl border border-shell-line bg-shell-surface-2/40 py-2.5 text-xs font-medium text-shell-muted';
