import { db } from '@/lib/db';
import type {
  Category,
  InventoryItem,
  SalesRecord,
  ShopProfile,
  WarrantyDuration,
  WarrantyPolicy,
  WarrantyStockCondition,
} from '@/types';

const DAY_MS = 86_400_000;
const SHOP_PROFILE_KEY = 'shop_profile';

export const WARRANTY_CATEGORY_LABELS: Record<Category, string> = {
  phones: 'Phones',
  tablets: 'Tablets',
  laptops: 'Laptops',
  accessories: 'Accessories',
  parts: 'Parts',
};

export const WARRANTY_STOCK_CONDITIONS: WarrantyStockCondition[] = [
  'new',
  'used',
  'uk_used',
  'refurb',
];

export const WARRANTY_STOCK_CONDITION_LABELS: Record<WarrantyStockCondition, string> = {
  new: 'New',
  used: 'Used',
  uk_used: 'UK used',
  refurb: 'Refurb',
};

const cell = (value: number, unit: WarrantyDuration['unit'] = 'days'): WarrantyDuration => ({
  value,
  unit,
});

export const DEFAULT_WARRANTY_POLICY: WarrantyPolicy = {
  phones: {
    new: cell(1, 'months'),
    used: cell(7),
    uk_used: cell(7),
    refurb: cell(14),
  },
  tablets: {
    new: cell(1, 'months'),
    used: cell(7),
    uk_used: cell(7),
    refurb: cell(14),
  },
  laptops: {
    new: cell(1, 'months'),
    used: cell(7),
    uk_used: cell(7),
    refurb: cell(14),
  },
  accessories: {
    new: cell(0),
    used: cell(0),
    uk_used: cell(0),
    refurb: cell(0),
  },
  parts: {
    new: cell(0),
    used: cell(0),
    uk_used: cell(0),
    refurb: cell(0),
  },
};

/** Common overrides shop owners pick at the till */
export const WARRANTY_COVER_PRESETS: WarrantyDuration[] = [
  { value: 0, unit: 'days' },
  { value: 5, unit: 'days' },
  { value: 7, unit: 'days' },
  { value: 14, unit: 'days' },
  { value: 1, unit: 'months' },
  { value: 2, unit: 'months' },
];

export type WarrantyStatus = {
  cover: WarrantyDuration;
  active: boolean;
  label: string;
  leftDays: number;
  expiresAt: Date | null;
};

function isLegacyFlatPolicy(
  partial: Partial<WarrantyPolicy> | Partial<Record<Category, number>> | undefined,
): partial is Partial<Record<Category, number>> {
  if (!partial || typeof partial !== 'object') return false;
  const first = Object.values(partial)[0];
  return typeof first === 'number';
}

export function mergeWarrantyPolicy(
  partial?: Partial<WarrantyPolicy> | Partial<Record<Category, number>>,
): WarrantyPolicy {
  const base = structuredClone(DEFAULT_WARRANTY_POLICY);
  if (!partial) return base;

  if (isLegacyFlatPolicy(partial)) {
    for (const category of Object.keys(WARRANTY_CATEGORY_LABELS) as Category[]) {
      const months = partial[category] ?? 0;
      const cover: WarrantyDuration = months
        ? { value: months, unit: 'months' }
        : { value: 0, unit: 'days' };
      for (const condition of WARRANTY_STOCK_CONDITIONS) {
        base[category][condition] = { ...cover };
      }
    }
    return base;
  }

  for (const category of Object.keys(WARRANTY_CATEGORY_LABELS) as Category[]) {
    const row = partial[category];
    if (!row || typeof row !== 'object') continue;
    for (const condition of WARRANTY_STOCK_CONDITIONS) {
      const cellValue = row[condition];
      if (!cellValue) continue;
      base[category][condition] = {
        value: Math.max(0, cellValue.value ?? 0),
        unit: cellValue.unit === 'months' ? 'months' : 'days',
      };
    }
  }
  return base;
}

export function stockConditionFromDescription(description?: string): WarrantyStockCondition {
  const head = description?.split(' · ')[0]?.trim();
  if (head === 'New') return 'new';
  if (head === 'UK Used') return 'uk_used';
  if (head === 'Refurb') return 'refurb';
  if (head === 'Used') return 'used';
  return 'used';
}

export function stockConditionFromItem(item: Pick<InventoryItem, 'description' | 'category'>): WarrantyStockCondition {
  if (item.description) return stockConditionFromDescription(item.description);
  return item.category === 'accessories' || item.category === 'parts' ? 'new' : 'used';
}

export function warrantyCoverFor(
  policy: WarrantyPolicy,
  category: Category,
  condition: WarrantyStockCondition,
): WarrantyDuration {
  return policy[category]?.[condition] ?? { value: 0, unit: 'days' };
}

export function warrantyCoversEqual(a: WarrantyDuration, b: WarrantyDuration): boolean {
  return a.value === b.value && a.unit === b.unit;
}

export function formatWarrantyCover(cover: WarrantyDuration): string {
  if (!cover.value) return 'No warranty';
  if (cover.unit === 'months') {
    return `${cover.value} month${cover.value === 1 ? '' : 's'}`;
  }
  return `${cover.value} day${cover.value === 1 ? '' : 's'}`;
}

export function addCoverToDate(sold: Date, cover: WarrantyDuration): Date {
  const end = new Date(sold);
  if (!cover.value) return end;
  if (cover.unit === 'months') {
    end.setMonth(end.getMonth() + cover.value);
  } else {
    end.setDate(end.getDate() + cover.value);
  }
  return end;
}

export async function getShopWarrantyPolicy(): Promise<WarrantyPolicy> {
  const row = await db.settings.get(SHOP_PROFILE_KEY);
  const profile = row?.value as ShopProfile | undefined;
  return mergeWarrantyPolicy(profile?.warranty_policy);
}

export function getSaleWarrantyCover(sale: SalesRecord): WarrantyDuration {
  if (sale.warranty_cover) return sale.warranty_cover;
  if (sale.warranty_months != null && sale.warranty_months > 0) {
    return { value: sale.warranty_months, unit: 'months' };
  }
  const condition = sale.item_stock_condition ?? 'used';
  return warrantyCoverFor(DEFAULT_WARRANTY_POLICY, sale.item_category, condition);
}

/** @deprecated Use getSaleWarrantyCover */
export function getWarrantyMonths(sale: SalesRecord): number {
  const cover = getSaleWarrantyCover(sale);
  if (!cover.value) return 0;
  return cover.unit === 'months' ? cover.value : Math.max(1, Math.round(cover.value / 30));
}

export function normalizeIdentifier(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

export function warrantyStatusFromCover(
  soldAtIso: string,
  cover: WarrantyDuration,
  now = new Date(),
): WarrantyStatus {
  if (!cover.value) {
    return { cover, active: false, label: 'No warranty', leftDays: 0, expiresAt: null };
  }
  const sold = new Date(soldAtIso);
  const expiresAt = addCoverToDate(sold, cover);
  const leftDays = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return {
    cover,
    active: leftDays >= 0,
    leftDays: Math.max(0, leftDays),
    label: expiresAt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }),
    expiresAt,
  };
}

export function saleWarrantyStatus(sale: SalesRecord, now = new Date()): WarrantyStatus {
  return warrantyStatusFromCover(sale.sold_at, getSaleWarrantyCover(sale), now);
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

export function encodeWarrantyCoverKey(cover: WarrantyDuration): string {
  return `${cover.unit}:${cover.value}`;
}

export function decodeWarrantyCoverKey(key: string): WarrantyDuration {
  const [unit, raw] = key.split(':');
  const value = Number(raw);
  if (unit === 'months' && Number.isFinite(value)) return { value, unit: 'months' };
  return { value: Number.isFinite(value) ? value : 0, unit: 'days' };
}
