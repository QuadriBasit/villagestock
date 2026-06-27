import type { Category, SalesRecord } from '@/types';

const DAY_MS = 86_400_000;

export type WarrantyStatus = {
  months: number;
  active: boolean;
  label: string;
  leftDays: number;
  expiresAt: Date | null;
};

export function defaultWarrantyMonths(category: Category): number {
  if (category === 'phones' || category === 'tablets') return 3;
  if (category === 'laptops') return 1;
  return 0;
}

export function getWarrantyMonths(sale: SalesRecord): number {
  if (sale.warranty_months != null) return sale.warranty_months;
  return defaultWarrantyMonths(sale.item_category);
}

export function normalizeIdentifier(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

export function warrantyStatus(soldAtIso: string, months: number, now = new Date()): WarrantyStatus {
  if (!months) {
    return { months: 0, active: false, label: 'No warranty', leftDays: 0, expiresAt: null };
  }
  const sold = new Date(soldAtIso);
  const expiresAt = new Date(sold);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  const leftDays = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return {
    months,
    active: leftDays >= 0,
    leftDays: Math.max(0, leftDays),
    label: expiresAt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }),
    expiresAt,
  };
}

export function saleWarrantyStatus(sale: SalesRecord, now = new Date()): WarrantyStatus {
  return warrantyStatus(sale.sold_at, getWarrantyMonths(sale), now);
}

export function identifierLabel(sale: SalesRecord): 'IMEI' | 'Serial' | null {
  if (sale.imei) return 'IMEI';
  if (sale.serial_number) return 'Serial';
  if (sale.item_category === 'laptops') return 'Serial';
  if (sale.item_category === 'phones' || sale.item_category === 'tablets') return 'IMEI';
  return null;
}

export function saleIdentifier(sale: SalesRecord): string | undefined {
  return sale.imei ?? sale.serial_number;
}

export function lookupSaleByIdentifier(sales: SalesRecord[], raw: string): SalesRecord | null {
  const norm = normalizeIdentifier(raw);
  if (norm.length < 4) return null;
  return (
    sales.find(s => {
      const imei = normalizeIdentifier(s.imei);
      const serial = normalizeIdentifier(s.serial_number);
      return (imei && imei === norm) || (serial && serial === norm);
    }) ?? null
  );
}

export function formatIdentifierDisplay(code: string | undefined, kind: 'IMEI' | 'Serial'): string {
  if (!code) return '—';
  if (kind === 'IMEI' && code.replace(/\s/g, '').length === 15) {
    const c = code.replace(/\s/g, '');
    return c.replace(/(\d{2})(\d{6})(\d{6})(\d)/, '$1 $2 $3 $4');
  }
  return code;
}
