import { tradingBlockedMessage } from '@/lib/stockSessionUtils';

/**
 * Open-stock requirement before selling: disabled (full trading access).
 *
 * PREVIOUS:
 *   import { db } from '@/lib/db';
 *   import { effectiveBusinessProfileForBilling } from '@/lib/devBillingOverride';
 *   import { hasStockAccountabilityPlan, localSessionDateKey, tradingBlockedMessage } from '@/lib/stockSessionUtils';
 *   // loaded profile; if hasStockAccountabilityPlan, required open session for today or threw tradingBlockedMessage.
 */
export async function assertTradingAllowedForStockPolicy(
  _userId: string,
  _locationId: string
): Promise<void> {
  return;
}

export { tradingBlockedMessage };
