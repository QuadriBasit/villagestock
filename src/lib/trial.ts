import type { BusinessProfile } from '@/types';

/** Kept for callers that still `instanceof` / name-check; trial expiry no longer throws. */
export class TrialExpiredError extends Error {
  constructor() {
    super('Your trial has ended. Choose a plan to continue.');
    this.name = 'TrialExpiredError';
  }
}

export const TRIAL_PLACEHOLDER = '1970-01-01T00:00:00.000Z';

/**
 * True when write actions should be blocked in the UI (FAB, etc.).
 * Plan/trial gating disabled — only admin account suspension remains.
 *
 * PREVIOUS — trial & plan expiry paywall (restore if billing returns):
 *   if (!bp?.onboarding_complete) return false;
 *   if (bp.account_disabled) return true;
 *   const paidActive = bp.plan !== 'trial' && bp.plan_status === 'active';
 *   if (paidActive) return false;
 *   if (bp.plan === 'trial') {
 *     const iso = bp.trial_end_date;
 *     if (!iso || iso.startsWith('1970-01-01')) return false;
 *     return Date.now() > new Date(iso).getTime();
 *   }
 *   return bp.plan_status === 'expired' || bp.plan_status === 'cancelled';
 */
export function trialBlocksMutations(bp: BusinessProfile | null | undefined): boolean {
  return !!bp?.account_disabled;
}

/**
 * No-op: trial/plan enforcement removed (trial dates still stored on profile).
 *
 * PREVIOUS: loaded profile, applied devBillingOverride, threw TrialExpiredError when gated.
 */
export async function assertTrialAllowsMutations(_userId: string): Promise<void> {
  return;
}

/**
 * Trial countdown banner disabled.
 *
 * PREVIOUS: computed days left from trial_end_date for trial plan.
 */
export function trialBannerState(_bp: BusinessProfile | null | undefined): {
  visible: boolean;
  daysRemaining: number;
  urgent: boolean;
} {
  return { visible: false, daysRemaining: 0, urgent: false };
}

/**
 * Paywall overlay after trial: disabled (account suspension overlay remains in AppLayout).
 *
 * PREVIOUS: return trialBlocksMutations(bp);
 */
export function showTrialEndedOverlay(_bp: BusinessProfile | null | undefined): boolean {
  return false;
}
