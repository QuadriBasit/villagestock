import type { AppleLaptopDeviceDetails, AppleMobileDeviceDetails, Category, InventoryItem } from '@/types';
import { conditionLabel, getInspectionFlags, getItemQty, getMarginPct } from '@/lib/inventoryDisplay';
import { formatCurrency } from '@/lib/utils';

export function productGroupKey(item: InventoryItem): string {
  return `${item.brand.trim().toLowerCase()}|${item.name.trim().toLowerCase()}|${item.category}`;
}

/** Stable key for a variant SKU within a product line. */
export function variantKeyForItem(item: InventoryItem): string {
  const dd = item.deviceDetails;
  if (dd && 'storage' in dd && dd.storage) {
    const mobile = dd as AppleMobileDeviceDetails;
    return `phone:${mobile.storage}|${mobile.color ?? ''}`;
  }
  if (dd && 'ram' in dd) {
    const laptop = dd as AppleLaptopDeviceDetails;
    return `laptop:${laptop.ram ?? ''}|${laptop.storage ?? ''}`;
  }
  if (item.mode === 'non_serialized') {
    const spec = accessorySpecFromDescription(item.description);
    return spec ? `acc:${spec.toLowerCase()}` : 'acc:stock';
  }
  const fromDesc = variantLabelFromDescription(item.description);
  return fromDesc !== 'Standard' ? `desc:${fromDesc.toLowerCase()}` : 'std';
}

function accessorySpecFromDescription(description?: string): string | undefined {
  if (!description) return undefined;
  return description
    .split(' · ')
    .map(s => s.trim())
    .find(
      p =>
        !['New', 'Used', 'UK Used', 'Refurb'].includes(p) &&
        !p.startsWith('Shelf ') &&
        !/^Grade [ABC]$/.test(p),
    );
}

function variantLabelFromDescription(description?: string): string {
  if (!description) return 'Standard';
  const parts = description
    .split(' · ')
    .map(s => s.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    if (/^\d+\s?(GB|TB)$/i.test(p) || /^\d+GB/i.test(p) || / · /.test(p)) return p;
    if (/\d+(GB|TB)/i.test(p)) return p;
  }
  return 'Standard';
}

export function variantLabelForItem(item: InventoryItem): string {
  const dd = item.deviceDetails;
  if (dd && 'storage' in dd && dd.storage) {
    const mobile = dd as AppleMobileDeviceDetails;
    return [mobile.storage, mobile.color].filter(Boolean).join(' · ') || 'Standard';
  }
  if (dd && ('ram' in dd || 'storage' in dd)) {
    const laptop = dd as AppleLaptopDeviceDetails;
    return [laptop.ram, laptop.storage].filter(Boolean).join(' · ') || 'Standard';
  }
  if (item.mode === 'non_serialized') {
    return accessorySpecFromDescription(item.description) ?? 'Stock';
  }
  return variantLabelFromDescription(item.description);
}

export type InventoryUnitMix = {
  qty: number;
  byCondition: Record<string, number>;
  serviceCount: number;
  priceMin: number;
  priceMax: number;
  costMin: number;
  costMax: number;
  marginMin: number;
  marginMax: number;
};

export function inventoryUnitMix(items: InventoryItem[]): InventoryUnitMix {
  const byCondition: Record<string, number> = {};
  let serviceCount = 0;
  let qty = 0;
  const prices: number[] = [];
  const costs: number[] = [];
  const margins: number[] = [];

  for (const item of items) {
    const itemQty = getItemQty(item);
    if (itemQty <= 0) continue;
    qty += itemQty;

    const cond =
      item.mode === 'serialized' && item.status && item.status !== 'in_stock'
        ? item.status === 'with_engineer'
          ? 'On bench'
          : item.status === 'defective'
            ? 'Service'
            : conditionLabel(item.condition)
        : conditionLabel(item.condition);
    byCondition[cond] = (byCondition[cond] ?? 0) + itemQty;

    if (item.status === 'with_engineer' || item.status === 'defective') {
      serviceCount += itemQty;
    }

    prices.push(item.price);
    costs.push(item.cost_price ?? 0);
    margins.push(getMarginPct(item));
  }

  return {
    qty,
    byCondition,
    serviceCount,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    costMin: costs.length ? Math.min(...costs) : 0,
    costMax: costs.length ? Math.max(...costs) : 0,
    marginMin: margins.length ? Math.min(...margins) : 0,
    marginMax: margins.length ? Math.max(...margins) : 0,
  };
}

export type InventoryVariantSlice = {
  key: string;
  label: string;
  items: InventoryItem[];
  mix: InventoryUnitMix;
  primaryItem: InventoryItem;
};

export type InventoryListGroup = {
  key: string;
  brand: string;
  name: string;
  category: Category;
  items: InventoryItem[];
  variants: InventoryVariantSlice[];
  primaryItem: InventoryItem;
  mix: InventoryUnitMix;
  flags: ReturnType<typeof getInspectionFlags>;
};

export function groupInventoryItems(items: InventoryItem[]): InventoryListGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = productGroupKey(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  const groups: InventoryListGroup[] = [];

  for (const [key, groupItems] of map) {
    const sorted = [...groupItems].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    const primaryItem =
      sorted.find(i => getItemQty(i) > 0 && i.status !== 'sold') ?? sorted[0]!;

    const variantMap = new Map<string, InventoryItem[]>();
    for (const item of groupItems) {
      const vk = variantKeyForItem(item);
      const bucket = variantMap.get(vk) ?? [];
      bucket.push(item);
      variantMap.set(vk, bucket);
    }

    const variants: InventoryVariantSlice[] = [...variantMap.entries()]
      .map(([vk, variantItems]) => {
        const vSorted = [...variantItems].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        const vPrimary =
          vSorted.find(i => getItemQty(i) > 0 && i.status !== 'sold') ?? vSorted[0]!;
        return {
          key: vk,
          label: variantLabelForItem(vPrimary),
          items: variantItems,
          mix: inventoryUnitMix(variantItems),
          primaryItem: vPrimary,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const flagSet = new Set<ReturnType<typeof getInspectionFlags>[number]>();
    for (const item of groupItems) {
      for (const f of getInspectionFlags(item)) flagSet.add(f);
    }

    groups.push({
      key,
      brand: primaryItem.brand,
      name: primaryItem.name,
      category: primaryItem.category,
      items: groupItems,
      variants,
      primaryItem,
      mix: inventoryUnitMix(groupItems),
      flags: [...flagSet],
    });
  }

  return groups.sort((a, b) => {
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    return an.localeCompare(bn);
  });
}

export function formatCurrencyRange(min: number, max: number, compact = false): string {
  if (min === max) return formatCurrency(min);
  if (compact) {
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
      return formatCurrency(n);
    };
    return `${fmt(min)}–${fmt(max)}`;
  }
  return `${formatCurrency(min)}–${formatCurrency(max)}`;
}

export function formatPercentRange(min: number, max: number): string {
  if (min === max) return `${min}%`;
  return `${min}–${max}%`;
}

export function productSpecLine(group: InventoryListGroup): string {
  const parts: string[] = [];
  if (group.brand) parts.push(group.brand);
  if (group.variants.length > 1) {
    parts.push(`${group.variants.length} variants`);
    const preview = group.variants
      .slice(0, 2)
      .map(v => v.label)
      .join(', ');
    if (preview) parts.push(preview);
  } else if (group.variants[0]) {
    const label = group.variants[0].label;
    if (label && label !== 'Standard' && label !== 'Stock') parts.push(label);
  }
  return parts.join(' · ') || group.category;
}

export function sellableItemsInGroup(group: InventoryListGroup): InventoryItem[] {
  return group.items.filter(item => {
    if (item.mode === 'serialized') return item.status === 'in_stock';
    return item.quantity > 0;
  });
}
