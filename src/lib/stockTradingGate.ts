import { db } from '@/lib/db';
import { effectiveBusinessProfileForBilling } from '@/lib/devBillingOverride';
import { hasStockAccountabilityPlan, localSessionDateKey, tradingBlockedMessage } from '@/lib/stockSessionUtils';

/** Enforced before sell / swap / send for repair when shop is on Business plan. */
export async function assertTradingAllowedForStockPolicy(userId: string, locationId: string): Promise<void> {
  const raw = await db.business_profiles.get(userId);
  const profile = effectiveBusinessProfileForBilling(raw ?? undefined);
  if (!hasStockAccountabilityPlan(profile)) return;

  const today = localSessionDateKey();
  const open = await db.stock_sessions
    .where('[user_id+location_id+date]')
    .equals([userId, locationId, today])
    .filter((s) => s.status === 'open')
    .first();

  if (!open) {
    throw new Error(tradingBlockedMessage);
  }
}

export { tradingBlockedMessage };
