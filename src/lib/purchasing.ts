import type { PurchaseRecord } from '@/types';

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

export function filterPurchases(records: PurchaseRecord[], tab: PurchaseTab): PurchaseRecord[] {
  if (tab === 'owing') return records.filter(p => !purchaseIsPaid(p));
  if (tab === 'paid') return records.filter(purchaseIsPaid);
  return records;
}
