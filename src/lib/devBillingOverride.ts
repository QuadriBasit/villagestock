import type { BusinessProfile } from '@/types';

/**
 * Pass-through: dev plan override disabled (no simulated plan / paywall).
 *
 * PREVIOUS — in DEV only, `VITE_DEBUG_BUSINESS_PLAN` overwrote `plan` / `plan_status`
 * for gates and UI. Implementation used `BusinessPlan` validation from `@/types`.
 */
export function effectiveBusinessProfileForBilling(
  profile: BusinessProfile | null | undefined
): BusinessProfile | null | undefined {
  return profile;
}
