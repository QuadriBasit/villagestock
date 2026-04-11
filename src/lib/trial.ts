import type { BusinessProfile } from '@/types';
import { db } from '@/lib/db';
import { effectiveBusinessProfileForBilling } from '@/lib/devBillingOverride';

export class TrialExpiredError extends Error {
  constructor() {
    super('Your trial has ended. Choose a plan to continue.');
    this.name = 'TrialExpiredError';
  }
}

const TRIAL_PLACEHOLDER = '1970-01-01T00:00:00.000Z';

function isPlaceholderTrialEnd(iso: string): boolean {
  return !iso || iso.startsWith('1970-01-01');
}

/** True when mutations (inventory, sales, etc.) must be blocked. */
export function trialBlocksMutations(bp: BusinessProfile | null | undefined): boolean {
  if (!bp?.onboarding_complete) return false;
  if (bp.account_disabled) return true;

  const paidActive =
    bp.plan !== 'trial' && bp.plan_status === 'active';

  if (paidActive) return false;

  if (bp.plan === 'trial') {
    if (isPlaceholderTrialEnd(bp.trial_end_date)) return false;
    return Date.now() > new Date(bp.trial_end_date).getTime();
  }

  return bp.plan_status === 'expired' || bp.plan_status === 'cancelled';
}

export async function assertTrialAllowsMutations(userId: string): Promise<void> {
  const bp = await db.business_profiles.get(userId);
  const effective = effectiveBusinessProfileForBilling(bp ?? undefined);
  if (trialBlocksMutations(effective)) throw new TrialExpiredError();
}

export function trialBannerState(bp: BusinessProfile | null | undefined): {
  visible: boolean;
  daysRemaining: number;
  urgent: boolean;
} {
  if (!bp?.onboarding_complete || bp.plan !== 'trial') {
    return { visible: false, daysRemaining: 0, urgent: false };
  }
  if (isPlaceholderTrialEnd(bp.trial_end_date)) {
    return { visible: false, daysRemaining: 0, urgent: false };
  }
  const end = new Date(bp.trial_end_date).getTime();
  const now = Date.now();
  if (now > end) return { visible: false, daysRemaining: 0, urgent: false };

  const dayMs = 86_400_000;
  const daysRemaining = Math.max(1, Math.ceil((end - now) / dayMs));
  return {
    visible: true,
    daysRemaining,
    urgent: daysRemaining <= 3,
  };
}

export function showTrialEndedOverlay(bp: BusinessProfile | null | undefined): boolean {
  return trialBlocksMutations(bp);
}

export { TRIAL_PLACEHOLDER };
