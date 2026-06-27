import type { InventoryItem } from '@/types';

export const CRITICAL_FLOOR = 3;

export type StockAlertKind = 'out_of_stock' | 'low_stock' | 'last_unit';

export type StockAlertTone = 'error' | 'warning' | 'last_unit';

export type StockAlertsBundle = {
  lowStock: InventoryItem[];
  outOfStock: InventoryItem[];
  lastUnits: InventoryItem[];
  total: number;
};

export function computeStockAlerts(items: InventoryItem[]): StockAlertsBundle {
  const nonSerialized = items.filter(i => i.mode === 'non_serialized');
  const outOfStock = nonSerialized.filter(i => i.quantity === 0);
  const lowStock = nonSerialized.filter(
    i => i.quantity > 0 && i.quantity <= Math.max(i.low_stock_threshold, CRITICAL_FLOOR),
  );

  const serializedInStock = items.filter(i => i.mode === 'serialized' && i.status === 'in_stock');
  const modelMap = new Map<string, InventoryItem[]>();
  for (const item of serializedInStock) {
    const key = `${item.brand}||${item.name}`;
    if (!modelMap.has(key)) modelMap.set(key, []);
    modelMap.get(key)!.push(item);
  }
  const lastUnits = [...modelMap.values()]
    .filter(units => units.length === 1)
    .map(units => units[0]);

  return {
    lowStock,
    outOfStock,
    lastUnits,
    total: lowStock.length + outOfStock.length + lastUnits.length,
  };
}

/** Flat list for notification preview — most urgent first. */
export function stockAlertPreview(
  bundle: StockAlertsBundle,
  limit = 8,
): { kind: StockAlertKind; item: InventoryItem }[] {
  const rows: { kind: StockAlertKind; item: InventoryItem }[] = [
    ...bundle.outOfStock.map(item => ({ kind: 'out_of_stock' as const, item })),
    ...bundle.lastUnits.map(item => ({ kind: 'last_unit' as const, item })),
    ...bundle.lowStock.map(item => ({ kind: 'low_stock' as const, item })),
  ];
  return rows.slice(0, limit);
}

export function stockAlertTone(kind: StockAlertKind): StockAlertTone {
  if (kind === 'out_of_stock') return 'error';
  if (kind === 'last_unit') return 'last_unit';
  return 'warning';
}

export function stockAlertLabel(kind: StockAlertKind, item: InventoryItem): string {
  if (kind === 'out_of_stock') return 'Out of stock';
  if (kind === 'last_unit') return 'Last unit';
  const isCritical = item.quantity < CRITICAL_FLOOR;
  return isCritical
    ? `Only ${item.quantity} left`
    : `${item.quantity} left · min ${item.low_stock_threshold}`;
}

export function stockAlertBadgeClass(tone: StockAlertTone, item?: InventoryItem): string {
  if (tone === 'error') return 'border-red-500/25 bg-red-500/10 text-red-300';
  if (tone === 'last_unit') return 'border-orange-500/25 bg-orange-500/10 text-orange-300';
  const isCritical = item != null && item.quantity < CRITICAL_FLOOR;
  return isCritical
    ? 'border-orange-500/25 bg-orange-500/10 text-orange-300'
    : 'border-amber-500/25 bg-amber-500/10 text-amber-300';
}
