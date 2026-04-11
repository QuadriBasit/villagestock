import { db } from '@/lib/db';
import type { BusinessProfile, InventoryItem, StockSession, StockSessionSummary } from '@/types';

export function localSessionDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return localSessionDateKey(dt);
}

export function hasStockAccountabilityPlan(profile: BusinessProfile | null | undefined): boolean {
  return profile?.plan === 'business' && profile?.plan_status === 'active';
}

export async function loadInventoryMap(userId: string, locationId?: string): Promise<Map<string, InventoryItem>> {
  const rows = await db.inventory_items
    .where('user_id')
    .equals(userId)
    .filter((i) => {
      if (i.deleted) return false;
      if (locationId && i.location_id !== locationId) return false;
      return true;
    })
    .toArray();
  return new Map(rows.map((i) => [i.id, i]));
}

/** Devices that should be physically in shop at end of session. */
export function computeExpectedClosingIds(
  session: Pick<StockSession, 'opening_snapshot_ids' | 'opened_at'>,
  items: InventoryItem[]
): string[] {
  const opening = new Set(session.opening_snapshot_ids);
  const openedAt = new Date(session.opened_at).getTime();
  const expected: string[] = [];

  for (const item of items) {
    if (item.mode !== 'serialized' || item.deleted) continue;
    if (item.status !== 'in_stock' && item.status !== 'reserved') continue;

    if (opening.has(item.id)) {
      expected.push(item.id);
      continue;
    }
    if (new Date(item.created_at).getTime() >= openedAt) {
      expected.push(item.id);
    }
  }
  return expected;
}

export async function buildSessionCloseSummary(
  userId: string,
  session: StockSession,
  items: InventoryItem[],
  expectedIds: string[]
): Promise<StockSessionSummary> {
  const opening = new Set(session.opening_snapshot_ids);
  const openedAt = new Date(session.opened_at);
  const itemById = new Map(items.map((i) => [i.id, i]));

  const sales = await db.sales_records.where('user_id').equals(userId).toArray();
  const sessionSales = sales.filter((s) => new Date(s.sold_at) >= openedAt);

  let soldFromOpening = 0;
  let creditFromOpening = 0;

  for (const s of sessionSales) {
    if (!opening.has(s.item_id)) continue;
    soldFromOpening += 1;
    if (s.payment_status === 'credit') creditFromOpening += 1;
  }

  let sentEngineer = 0;
  for (const id of opening) {
    const it = itemById.get(id);
    if (it?.status === 'with_engineer') sentEngineer += 1;
  }

  const returns = await db.return_records.where('user_id').equals(userId).toArray();
  const returnsReceived = returns.filter((r) => new Date(r.returned_at) >= openedAt).length;

  let newStock = 0;
  for (const item of items) {
    if (item.mode !== 'serialized' || item.deleted) continue;
    if (!opening.has(item.id) && new Date(item.created_at) >= openedAt && item.status === 'in_stock') {
      newStock += 1;
    }
  }

  return {
    opening_count: session.opening_snapshot_ids.length,
    sold_count: soldFromOpening,
    credit_sales_count: creditFromOpening,
    sent_engineer_count: sentEngineer,
    returns_received_count: returnsReceived,
    new_stock_count: newStock,
    expected_remaining: expectedIds.length,
  };
}

export const tradingBlockedMessage = 'Open stock to start trading';
