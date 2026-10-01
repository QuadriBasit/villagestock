import type { Category, DeviceCondition } from '@/types';
import type { NetworkState } from '@/lib/networkLock';
import { blankNetworkState } from '@/lib/networkLock';
import { toLocalDatetimeValue } from '@/components/ui/DateTimeField';

export type ProductCat = 'Phone' | 'Tablet' | 'Laptop' | 'Accessory' | 'Part';

export function isHandheldCat(cat: ProductCat) {
  return cat === 'Phone' || cat === 'Tablet';
}

export function isSimpleStockCat(cat: ProductCat) {
  return cat === 'Accessory' || cat === 'Part';
}

export type IntakeCondition = 'New' | 'Used' | 'UK Used' | 'Refurb';

export type VariantRow = {
  label: string;
  attrs: Record<string, string | undefined>;
  qty: number;
  cost: number;
  price: number;
};

export type UnitEconomics = { cost: number; price: number };

export type InspectionState = {
  display: 'Original' | 'Changed';
  battery: 'Original' | 'Changed';
  batteryHealth: number;
  camera: 'Original' | 'Changed';
  faceId: boolean;
  grade: 'A' | 'B' | 'C';
};

export type AddProductState = {
  cat: ProductCat;
  brand: string;
  model: string;
  spec: string;
  condition: IntakeCondition;
  storages: string[];
  colors: string[];
  rams: string[];
  roms: string[];
  processor: string;
  baseCost: number;
  basePrice: number;
  reorder: number;
  shelf: string;
  variants: VariantRow[];
  insp: InspectionState;
  toEngineer: boolean;
  fault: string;
  engineer: string;
  partsEst: number;
  track: boolean;
  serials: Record<string, string[]>;
  /** Per-unit cost/sell when qty &gt; 1 (key = variant label). Falls back to variant row defaults. */
  unitPricing: Record<string, UnitEconomics[]>;
  faults: string[];
  network: NetworkState;
  stockedAt: string;
};

export const INTAKE_FAULTS = [
  'Screen',
  'Back glass',
  'Battery',
  'Camera',
  'Charging port',
  'Speaker',
  'Microphone',
  'Buttons',
  'Face ID',
  'Water damage',
  'Network / IMEI',
  'Software',
] as const;

export const CAT_META: Record<
  ProductCat,
  {
    icon: 'phone' | 'laptop' | 'tag';
    category: Category;
    brands: string[];
    colors?: string[];
    storages?: string[];
    rams?: string[];
    roms?: string[];
  }
> = {
  Tablet: {
    icon: 'phone',
    category: 'tablets',
    brands: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi', 'Lenovo'],
    colors: ['Black', 'White', 'Blue', 'Green', 'Gold', 'Silver', 'Purple', 'Grey'],
    storages: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
    rams: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB'],
  },
  Part: {
    icon: 'tag',
    category: 'parts',
    brands: ['Apple', 'Samsung', 'Generic', 'Oraimo'],
  },
  Phone: {
    icon: 'phone',
    category: 'phones',
    brands: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi', 'Oppo', 'Itel'],
    colors: ['Black', 'White', 'Blue', 'Green', 'Gold', 'Silver', 'Purple', 'Titanium'],
    storages: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    rams: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'],
  },
  Laptop: {
    icon: 'laptop',
    category: 'laptops',
    brands: ['Apple', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Microsoft'],
    rams: ['4GB', '8GB', '16GB', '32GB', '64GB'],
    roms: ['128GB', '256GB', '512GB', '1TB', '2TB'],
  },
  Accessory: {
    icon: 'tag',
    category: 'accessories',
    brands: ['Oraimo', 'Anker', 'JBL', 'Baseus', 'Generic', 'Samsung'],
  },
};

export function blankAddProductState(engineerDefault = ''): AddProductState {
  return {
    cat: 'Phone',
    brand: '',
    model: '',
    spec: '',
    condition: 'Used',
    storages: [],
    colors: [],
    rams: [],
    roms: [],
    processor: '',
    baseCost: 0,
    basePrice: 0,
    reorder: 2,
    shelf: '',
    variants: [],
    insp: {
      display: 'Original',
      battery: 'Original',
      batteryHealth: 100,
      camera: 'Original',
      faceId: true,
      grade: 'A',
    },
    toEngineer: false,
    fault: '',
    engineer: engineerDefault,
    partsEst: 0,
    track: true,
    serials: {},
    unitPricing: {},
    faults: [],
    network: blankNetworkState(),
    stockedAt: toLocalDatetimeValue(new Date()),
  };
}

export function resizeUnitPricing(
  prev: Record<string, UnitEconomics[]>,
  label: string,
  qty: number,
  fallback: UnitEconomics,
): Record<string, UnitEconomics[]> {
  const arr = [...(prev[label] ?? [])];
  while (arr.length < qty) arr.push({ ...fallback });
  return { ...prev, [label]: arr.slice(0, qty) };
}

export function unitEconomicsForVariant(
  state: Pick<AddProductState, 'unitPricing'>,
  variant: VariantRow,
): UnitEconomics[] {
  const fallback = { cost: variant.cost, price: variant.price };
  const stored = state.unitPricing[variant.label];
  return Array.from({ length: Math.max(0, variant.qty) }, (_, i) => ({
    cost: stored?.[i]?.cost ?? fallback.cost,
    price: stored?.[i]?.price ?? fallback.price,
  }));
}

export function mapIntakeCondition(condition: IntakeCondition): DeviceCondition {
  return condition === 'New' ? 'working' : 'working';
}

export function cartesian(axes: { key: string; vals: string[] }[]): Record<string, string>[] {
  return axes
    .map(a => (a.vals.length ? a.vals.map(v => ({ [a.key]: v })) : [{}]))
    .reduce<Record<string, string>[]>((acc, list) => acc.flatMap(a => list.map(b => ({ ...a, ...b }))), [{}]);
}

export function variantLabel(cat: ProductCat, attrs: Record<string, string | undefined>): string {
  if (isHandheldCat(cat)) return [attrs.ram, attrs.storage, attrs.color].filter(Boolean).join(' · ') || 'Standard';
  if (cat === 'Laptop') return [attrs.ram, attrs.rom].filter(Boolean).join(' · ') || 'Standard';
  return 'Stock';
}

export function syncVariants(state: AddProductState, patch: Partial<AddProductState>): AddProductState {
  let st = { ...state, ...patch };
  let combos: Record<string, string>[];
  if (isHandheldCat(st.cat)) {
    combos = cartesian([
      { key: 'ram', vals: st.rams },
      { key: 'storage', vals: st.storages },
      { key: 'color', vals: st.colors },
    ]);
  } else if (st.cat === 'Laptop') {
    combos = cartesian([
      { key: 'ram', vals: st.rams },
      { key: 'rom', vals: st.roms },
    ]);
  } else {
    combos = [{}];
  }

  const prev = Object.fromEntries(st.variants.map(v => [v.label, v]));
  const variants: VariantRow[] = combos.map(c => {
    const label = variantLabel(st.cat, c);
    return (
      prev[label] ?? {
        label,
        attrs: c,
        qty: 1,
        cost: st.baseCost,
        price: st.basePrice,
      }
    );
  });

  let serials = st.serials;
  if (st.variants.length === 1 && variants.length === 1 && st.variants[0].label !== variants[0].label) {
    const previous = st.variants[0];
    variants[0] = {
      ...variants[0],
      qty: previous.qty,
      cost: previous.cost,
      price: previous.price,
    };
    const carried = st.serials[previous.label];
    const already = (serials[variants[0].label] ?? []).some(code => code.trim());
    if (carried?.some(code => code.trim()) && !already) {
      serials = { ...serials, [variants[0].label]: carried };
    }
    const carriedPricing = st.unitPricing[previous.label];
    if (carriedPricing?.length && !st.unitPricing[variants[0].label]?.length) {
      st = {
        ...st,
        unitPricing: { ...st.unitPricing, [variants[0].label]: carriedPricing },
      };
    }
  }

  const unitPricing = { ...st.unitPricing };
  for (const v of variants) {
    Object.assign(
      unitPricing,
      resizeUnitPricing(unitPricing, v.label, v.qty, { cost: v.cost, price: v.price }),
    );
  }

  return { ...st, variants, serials, unitPricing };
}

/** Edit uses the same variant rows as add, including quantity and each row's prices. */
export function syncVariantsForEdit(state: AddProductState, patch: Partial<AddProductState>): AddProductState {
  return syncVariants(state, patch);
}
