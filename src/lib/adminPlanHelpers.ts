import type { AdminBusinessRow } from '@/types/admin';
import type { BusinessPlan, BusinessPlanStatus } from '@/types';
import { formatDate } from '@/lib/utils';

export const ADMIN_PLAN_OPTIONS: { value: BusinessPlan; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
];

export const ADMIN_PLAN_STATUS_OPTIONS: { value: BusinessPlanStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const EXTEND_TRIAL_PRESETS = [7, 14, 30, 90] as const;

export function trialDaysRemaining(trialEndIso: string): number | null {
  const end = new Date(trialEndIso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

export function formatTrialWindow(start: string, end: string): string {
  if (!start && !end) return '—';
  const startLabel = start ? formatDate(start) : '—';
  const endLabel = end ? formatDate(end) : '—';
  return `${startLabel} → ${endLabel}`;
}

export function planBadgeClass(plan: string, status: string): string {
  if (status === 'expired' || status === 'cancelled') {
    return 'bg-red-500/15 text-red-300 ring-red-400/25';
  }
  switch (plan) {
    case 'business':
      return 'bg-amber-500/15 text-amber-200 ring-amber-400/25';
    case 'pro':
      return 'bg-blue-500/15 text-blue-200 ring-blue-400/25';
    case 'starter':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/25';
    default:
      return 'bg-brand-500/15 text-brand-200 ring-brand-400/25';
  }
}

export function isTrialActive(b: AdminBusinessRow): boolean {
  return b.plan === 'trial' && b.plan_status === 'active';
}

export function isPaidPlan(b: AdminBusinessRow): boolean {
  return b.plan !== 'trial' && b.plan_status === 'active';
}
