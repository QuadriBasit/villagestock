import { inventoryMissingRequiredIdentifiers } from '@/lib/serializedIdentifiers';
import { getCategoryMode, type Category, type PurchaseLine, type PurchaseRecord } from '@/types';

export type PurchaseTab = 'all' | 'owing' | 'paid';

export function purchaseOwed(record: PurchaseRecord): number {
  return Math.max(0, record.total - record.paid);
}

export function purchaseIsPaid(record: PurchaseRecord): boolean {
  return purchaseOwed(record) === 0;
}

export function purchaseStatusLabel(record: PurchaseRecord): 'Paid' | 'Owing' {
  return purchaseIsPaid(record) ? 'Paid' : 'Owing';
}

export function purchaseItemSummary(record: PurchaseRecord): string {
  return record.items.map(it => `${it.qty}× ${it.name.split(' · ')[0]}`).join(', ');
}

export function purchaseOrderLabel(record: PurchaseRecord): string {
  return record.id.slice(0, 8).toUpperCase();
}

export function monthSpendTotal(records: PurchaseRecord[]): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return records
    .filter(p => new Date(p.purchased_at) >= start)
    .reduce((sum, p) => sum + p.total, 0);
}

export const PURCHASE_CATEGORIES: { value: Category; label: string }[] = [
  { value: 'phones', label: 'Phone' },
  { value: 'laptops', label: 'Laptop' },
  { value: 'tablets', label: 'Tablet' },
  { value: 'accessories', label: 'Accessory' },
  { value: 'parts', label: 'Part' },
];

export function blankPurchaseLine(): PurchaseLine {
  return { name: '', qty: 1, unit_cost: 0, category: 'accessories', sell_price: 0, unit_ids: [] };
}

export function purchaseLineBrand(line: PurchaseLine): string {
  const explicit = line.brand?.trim();
  if (explicit) return explicit;
  return line.name.trim().split(/\s+/)[0] || 'Generic';
}

export function resizeUnitIds(ids: string[] | undefined, qty: number): string[] {
  const next = [...(ids ?? [])];
  next.length = Math.max(0, qty);
  return next.map(id => id ?? '');
}

/** User-facing reason a line cannot be stocked, or null when it is ready. */
export function purchaseLineStockError(line: PurchaseLine): string | null {
  const name = line.name.trim() || 'this item';
  if (!line.category) return `Choose what kind of item ${name} is.`;
  if (!line.sell_price || line.sell_price <= 0) return `Enter a selling price for ${name}.`;
  if (getCategoryMode(line.category) !== 'serialized') return null;
  const ids = line.unit_ids ?? [];
  if (ids.length !== line.qty || ids.some(id => !id.trim())) {
    return line.category === 'laptops'
      ? `Enter a serial number for each ${name}.`
      : `Enter an IMEI for each ${name}.`;
  }
  for (const raw of ids) {
    const err =
      line.category === 'laptops'
        ? inventoryMissingRequiredIdentifiers(line.category, undefined, raw)
        : inventoryMissingRequiredIdentifiers(line.category, raw);
    if (err) return `${name}: ${err}`;
  }
  return null;
}

export function filterPurchases(records: PurchaseRecord[], tab: PurchaseTab): PurchaseRecord[] {
  if (tab === 'owing') return records.filter(p => !purchaseIsPaid(p));
  if (tab === 'paid') return records.filter(purchaseIsPaid);
  return records;
}
