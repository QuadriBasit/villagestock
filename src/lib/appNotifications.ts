import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { db } from '@/lib/db';
import { computeStockAlerts, CRITICAL_FLOOR, type StockAlertKind } from '@/lib/stockAlerts';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem, RepairRecord } from '@/types';

export type AppNotificationKind =
  | 'credit_overdue'
  | 'stock_out'
  | 'stock_low'
  | 'stock_last_unit'
  | 'stock_low_more'
  | 'repair_pickup'
  | 'supplier_debt'
  | 'cash_drawer';

export type AppNotificationTone = 'amber' | 'red' | 'teal' | 'violet' | 'muted';

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  tone: AppNotificationTone;
  title: string;
  detail: string;
  href: string;
  priority: number;
};

function locationShort(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Shop';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map(p => p[0]).join('').slice(0, 3).toUpperCase();
}

function repairRef(id: string): string {
  return `RP-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

function creditReceiptRef(saleId: string, receipt?: string): string {
  if (receipt) return receipt;
  return `CR-${saleId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

function daysOverdue(dueDate: string): number {
  return differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(dueDate)));
}

function stockKindPriority(kind: StockAlertKind): number {
  if (kind === 'out_of_stock') return 20;
  if (kind === 'last_unit') return 52;
  return 50;
}

function stockTitle(kind: StockAlertKind, item: InventoryItem): string {
  if (kind === 'out_of_stock') return `${item.name} is out of stock`;
  return `${item.name} running low`;
}

function stockDetail(kind: StockAlertKind, item: InventoryItem, branchLabel: string): string {
  const threshold = Math.max(item.low_stock_threshold, CRITICAL_FLOOR);
  if (kind === 'out_of_stock') return `Reorder level ${threshold} · ${branchLabel}`;
  const qty = item.mode === 'serialized' ? 1 : item.quantity;
  return `${qty} left · reorder at ${threshold}`;
}

export async function computeAppNotifications(
  shopOwnerId: string,
  locationId: string,
  locationName: string,
  previewLimit = 8,
): Promise<{ preview: AppNotification[]; total: number }> {
  const branchLabel = locationShort(locationName);
  const todayStart = startOfDay(new Date()).toISOString();

  const [items, creditRows, repairs, suppliers, cashSessionsToday, salesById] = await Promise.all([
    db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === locationId)
      .toArray(),
    db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === locationId && r.balance_owed > 0)
      .toArray(),
    db.repair_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === locationId)
      .toArray(),
    db.contacts
      .where('user_id')
      .equals(shopOwnerId)
      .filter(c => c.type === 'supplier' && (c.location_id === locationId || !c.location_id) && c.balance_owed > 0)
      .toArray(),
    db.cash_sessions
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === locationId && s.closed_at >= todayStart)
      .toArray(),
    db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === locationId)
      .toArray()
      .then(rows => new Map(rows.map(s => [s.id, s.receipt_number]))),
  ]);

  const itemById = new Map(items.map(i => [i.id, i]));
  const notifications: AppNotification[] = [];

  const overdueCredits = creditRows
    .filter(c => new Date(c.due_date) < startOfDay(new Date()))
    .sort((a, b) => daysOverdue(b.due_date) - daysOverdue(a.due_date) || b.balance_owed - a.balance_owed);

  for (const credit of overdueCredits) {
    const days = daysOverdue(credit.due_date);
    notifications.push({
      id: `credit-${credit.id}`,
      kind: 'credit_overdue',
      tone: 'amber',
      title: `${credit.customer_name} owes ${formatCurrency(credit.balance_owed)}`,
      detail: `${days} day${days === 1 ? '' : 's'} overdue · ${creditReceiptRef(credit.sale_id, salesById.get(credit.sale_id))}`,
      href: '/credits',
      priority: 10 + Math.min(days, 30),
    });
  }

  const stock = computeStockAlerts(items);
  const stockRows: { kind: StockAlertKind; item: InventoryItem; priority: number }[] = [
    ...stock.outOfStock.map(item => ({ kind: 'out_of_stock' as const, item, priority: stockKindPriority('out_of_stock') })),
    ...stock.lastUnits.map(item => ({ kind: 'last_unit' as const, item, priority: stockKindPriority('last_unit') })),
    ...stock.lowStock.map(item => ({ kind: 'low_stock' as const, item, priority: stockKindPriority('low_stock') })),
  ].sort((a, b) => a.priority - b.priority || a.item.name.localeCompare(b.item.name));

  const lowStockCount = stockRows.filter(r => r.kind === 'low_stock').length;
  const lowStockShown = Math.min(lowStockCount, 3);
  let lowStockAdded = 0;

  for (const row of stockRows) {
    if (row.kind === 'low_stock') {
      if (lowStockAdded >= lowStockShown) continue;
      lowStockAdded += 1;
    }

    const kind = row.kind;
    const mappedKind: AppNotificationKind =
      kind === 'out_of_stock' ? 'stock_out' : kind === 'last_unit' ? 'stock_last_unit' : 'stock_low';
    notifications.push({
      id: `stock-${kind}-${row.item.id}`,
      kind: mappedKind,
      tone: kind === 'out_of_stock' ? 'red' : 'amber',
      title: stockTitle(kind, row.item),
      detail: stockDetail(kind, row.item, branchLabel),
      href: `/inventory?edit=${row.item.id}`,
      priority: row.priority,
    });
  }

  const lowStockOverflow = lowStockCount - lowStockShown;
  if (lowStockOverflow > 0) {
    notifications.push({
      id: 'stock-low-more',
      kind: 'stock_low_more',
      tone: 'muted',
      title: `${lowStockOverflow} more low-stock item${lowStockOverflow === 1 ? '' : 's'}`,
      detail: 'Open inventory to restock',
      href: '/alerts',
      priority: 60,
    });
  }

  const pickupRepairs = repairs
    .filter((r: RepairRecord) => r.repair_status === 'completed')
    .sort((a, b) => new Date(b.date_sent).getTime() - new Date(a.date_sent).getTime());

  for (const repair of pickupRepairs) {
    const item = itemById.get(repair.item_id);
    const itemLabel = item?.name ?? 'Device';
    const who = repair.engineer_name.split(/\s+/)[0] ?? 'Customer';
    notifications.push({
      id: `repair-${repair.id}`,
      kind: 'repair_pickup',
      tone: 'teal',
      title: `${itemLabel} ready for pickup`,
      detail: `${who}${who.endsWith('.') ? '' : '.'} · ${repairRef(repair.id)}`,
      href: '/repairs',
      priority: 30,
    });
  }

  const supplierTotal = suppliers.reduce((sum, s) => sum + s.balance_owed, 0);
  if (supplierTotal > 0) {
    notifications.push({
      id: 'supplier-debt',
      kind: 'supplier_debt',
      tone: 'amber',
      title: `You owe suppliers ${formatCurrency(supplierTotal)}`,
      detail: `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} on credit`,
      href: '/purchasing',
      priority: 40,
    });
  }

  if (cashSessionsToday.length === 0) {
    notifications.push({
      id: 'cash-drawer',
      kind: 'cash_drawer',
      tone: 'violet',
      title: "Today's drawer not counted yet",
      detail: 'Count cash before closing the day',
      href: '/cashup',
      priority: 70,
    });
  }

  notifications.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  return {
    preview: notifications.slice(0, previewLimit),
    total: notifications.length,
  };
}

export function notificationIconToneClass(tone: AppNotificationTone): string {
  switch (tone) {
    case 'red':
      return 'bg-red-500/15 text-red-300';
    case 'teal':
      return 'bg-teal-500/15 text-teal-300';
    case 'violet':
      return 'bg-violet-500/15 text-violet-300';
    case 'muted':
      return 'bg-shell-surface-2 text-shell-muted';
    default:
      return 'bg-amber-500/15 text-amber-300';
  }
}
