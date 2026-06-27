import { db } from '@/lib/db';
import type { Category, InventoryItem } from '@/types';
import { categoryToProductCat } from '@/components/inventory/addProduct/parseItem';
import {
  blankAddProductState,
  type AddProductState,
  type ProductCat,
  variantLabel,
  syncVariants,
} from '@/components/inventory/addProduct/types';
import { variantKeyForItem, variantLabelForItem } from '@/lib/inventoryGrouping';
import { getItemQty } from '@/lib/inventoryDisplay';

export async function fetchExistingProductItems(
  shopOwnerId: string,
  locationId: string,
  brand: string,
  name: string,
  category: Category,
): Promise<InventoryItem[]> {
  const b = brand.trim();
  const n = name.trim();
  if (!b || !n) return [];
  return db.inventory_items
    .where('user_id')
    .equals(shopOwnerId)
    .filter(
      i =>
        !i.deleted &&
        i.location_id === locationId &&
        i.brand.trim().toLowerCase() === b.toLowerCase() &&
        i.name.trim().toLowerCase() === n.toLowerCase() &&
        i.category === category,
    )
    .toArray();
}

/** In-stock count per variant label for the Variants step. */
export function existingStockByVariantLabel(items: InventoryItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const qty = getItemQty(item);
    if (qty <= 0) continue;
    const label = variantLabelForItem(item);
    out[label] = (out[label] ?? 0) + qty;
  }
  return out;
}

export function applyExistingProductToState(
  state: AddProductState,
  existing: InventoryItem[],
): AddProductState {
  if (!existing.length) return state;

  const sample = [...existing].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0]!;

  if (state.cat === 'Accessory') {
    const spec =
      sample.description?.split(' · ').find(p => !['New', 'Used', 'UK Used', 'Refurb'].includes(p)) ??
      state.spec;
    return {
      ...state,
      spec: state.spec.trim() ? state.spec : spec ?? '',
      baseCost: state.baseCost || sample.cost_price || 0,
      basePrice: state.basePrice || sample.price || 0,
      reorder: state.reorder || sample.low_stock_threshold || 2,
    };
  }

  const storages = new Set<string>();
  const colors = new Set<string>();
  const rams = new Set<string>();
  const roms = new Set<string>();
  const variantByKey = new Map<string, { label: string; attrs: Record<string, string | undefined>; cost: number; price: number }>();

  for (const item of existing) {
    const dd = item.deviceDetails;
    if (dd && 'storage' in dd && dd.storage) {
      storages.add(dd.storage);
      if ('color' in dd && dd.color) colors.add(dd.color);
    }
    if (dd && 'ram' in dd && dd.ram) {
      rams.add(String(dd.ram));
      if ('storage' in dd && dd.storage) roms.add(dd.storage);
    }

    const label = variantLabelForItem(item);
    const key = variantKeyForItem(item);
    if (!variantByKey.has(key)) {
      const attrs: Record<string, string | undefined> = {};
      if (state.cat === 'Phone' && dd && 'storage' in dd) {
        attrs.storage = dd.storage;
        if ('color' in dd) attrs.color = dd.color;
      }
      if (state.cat === 'Laptop' && dd && 'ram' in dd) {
        attrs.ram = dd.ram ? String(dd.ram) : undefined;
        if ('storage' in dd) attrs.rom = dd.storage;
      }
      variantByKey.set(key, {
        label,
        attrs,
        cost: item.cost_price ?? 0,
        price: item.price,
      });
    }
  }

  let next: AddProductState = {
    ...state,
    brand: state.brand.trim() || sample.brand,
    processor:
      state.processor.trim() ||
      (sample.deviceDetails && 'chip' in sample.deviceDetails ? sample.deviceDetails.chip ?? '' : ''),
    baseCost: state.baseCost || sample.cost_price || 0,
    basePrice: state.basePrice || sample.price || 0,
    storages: [...new Set([...state.storages, ...storages])],
    colors: [...new Set([...state.colors, ...colors])],
    rams: [...new Set([...state.rams, ...rams])],
    roms: [...new Set([...state.roms, ...roms])],
  };

  next = syncVariants(next, {});

  const mergedVariants = next.variants.map(v => {
    const match = [...variantByKey.values()].find(x => x.label === v.label);
    if (!match) return v;
    return {
      ...v,
      cost: match.cost || v.cost,
      price: match.price || v.price,
      qty: v.qty || 1,
    };
  });

  for (const entry of variantByKey.values()) {
    if (!mergedVariants.some(v => v.label === entry.label)) {
      mergedVariants.push({
        label: entry.label,
        attrs: entry.attrs,
        qty: 1,
        cost: entry.cost,
        price: entry.price,
      });
    }
  }

  return { ...next, variants: mergedVariants };
}

export function productCatFromCategory(category: Category): ProductCat | null {
  return categoryToProductCat(category);
}

export function resetStateForExistingModel(
  cat: ProductCat,
  brand: string,
  model: string,
  engineerDefault: string,
): AddProductState {
  return { ...blankAddProductState(engineerDefault), cat, brand, model };
}

/** Labels for variant rows from attrs — re-export for tests. */
export { variantLabel };
