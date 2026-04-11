import type { BusinessPlan, BusinessProfile } from '@/types';

const PLANS: BusinessPlan[] = ['trial', 'starter', 'pro', 'business'];

function isBusinessPlan(s: string): s is BusinessPlan {
  return (PLANS as readonly string[]).includes(s);
}

/**
 * In `import.meta.env.DEV` only, `VITE_DEBUG_BUSINESS_PLAN` simulates a plan for UI and billing gates without writing to Dexie or Supabase. Production builds ignore the variable.
 */
export function effectiveBusinessProfileForBilling(
  profile: BusinessProfile | null | undefined
): BusinessProfile | null | undefined {
  if (!import.meta.env.DEV || profile == null) return profile;
  const raw = import.meta.env.VITE_DEBUG_BUSINESS_PLAN;
  if (typeof raw !== 'string') return profile;
  const plan = raw.trim().toLowerCase();
  if (!plan || !isBusinessPlan(plan)) return profile;
  return {
    ...profile,
    plan,
    plan_status: 'active',
  };
}
