import { db } from '@/lib/db';
import { hasStockAccountabilityPlan, localSessionDateKey, tradingBlockedMessage } from '@/lib/stockSessionUtils';

/** Enforced before sell / swap / send for repair when shop is on Business plan. */
export async function assertTradingAllowedForStockPolicy(userId: string): Promise<void> {
  const profile = await db.business_profiles.get(userId);
  if (!hasStockAccountabilityPlan(profile)) return;

  const today = localSessionDateKey();
  const open = await db.stock_sessions
    .where('[user_id+date]')
    .equals([userId, today])
    .filter((s) => s.status === 'open')
    .first();

  if (!open) {
    throw new Error(tradingBlockedMessage);
  }
}

export { tradingBlockedMessage };
