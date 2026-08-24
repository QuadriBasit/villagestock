import { db } from '@/lib/db';
import type { BusinessProfile, InventoryItem, StockSession, StockSessionDeviceSnapshot, StockSessionSummary } from '@/types';

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

/**
 * Stock sessions + trading gate available for all users (plan check disabled).
 *
 * PREVIOUS: return profile?.plan === 'business' && profile?.plan_status === 'active';
 */
export function hasStockAccountabilityPlan(profile: BusinessProfile | null | undefined): boolean {
  void profile;
  return true;
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
  const locationId = session.location_id;
  const itemById = new Map(items.map((i) => [i.id, i]));

  const sales = await db.sales_records.where('user_id').equals(userId).toArray();
  const sessionSales = sales.filter(
    (s) =>
      new Date(s.sold_at) >= openedAt &&
      (!locationId || s.location_id === locationId),
  );

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
  const returnsReceived = returns.filter(
    (r) =>
      new Date(r.returned_at) >= openedAt &&
      (!locationId || r.location_id === locationId),
  ).length;

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

export function inventoryItemToSnapshot(item: InventoryItem): StockSessionDeviceSnapshot {
  return {
    id: item.id,
    name: item.name,
    brand: item.brand,
    imei: item.imei,
    serial_number: item.serial_number,
  };
}

export function placeholderDeviceSnapshot(id: string): StockSessionDeviceSnapshot {
  return {
    id,
    name: 'Device no longer in inventory',
    brand: '',
  };
}

/** Best-effort label for a device id using snapshots already on the session. */
export function snapshotForSessionDevice(
  id: string,
  session: Pick<
    StockSession,
    'expected_closing_snapshots' | 'opening_device_snapshots'
  >,
): StockSessionDeviceSnapshot {
  return (
    session.expected_closing_snapshots?.find(s => s.id === id) ??
    session.opening_device_snapshots?.find(s => s.id === id) ??
    placeholderDeviceSnapshot(id)
  );
}

/** Prefer frozen snapshots; fall back to live inventory; then placeholder. */
export function resolveSessionDeviceList(
  ids: string[],
  snapshots: StockSessionDeviceSnapshot[] | undefined,
  liveItems: Map<string, InventoryItem> | undefined,
): StockSessionDeviceSnapshot[] {
  if (snapshots?.length) {
    const byId = new Map(snapshots.map(s => [s.id, s]));
    return ids.map(id => byId.get(id) ?? placeholderDeviceSnapshot(id));
  }
  return ids.map(id => {
    const live = liveItems?.get(id);
    return live ? inventoryItemToSnapshot(live) : placeholderDeviceSnapshot(id);
  });
}
