import type { Category, DeviceCondition } from '@/types';
import type { NetworkState } from '@/lib/networkLock';
import { blankNetworkState } from '@/lib/networkLock';

export type ProductCat = 'Phone' | 'Laptop' | 'Accessory';

export type IntakeCondition = 'New' | 'Used' | 'UK Used' | 'Refurb';

export type VariantRow = {
  label: string;
  attrs: Record<string, string | undefined>;
  qty: number;
  cost: number;
  price: number;
};

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
  faults: string[];
  network: NetworkState;
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
  Phone: {
    icon: 'phone',
    category: 'phones',
    brands: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi', 'Oppo', 'Itel'],
    colors: ['Black', 'White', 'Blue', 'Green', 'Gold', 'Silver', 'Purple', 'Titanium'],
    storages: ['64GB', '128GB', '256GB', '512GB', '1TB'],
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
    faults: [],
    network: blankNetworkState(),
  };
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
  if (cat === 'Phone') return [attrs.storage, attrs.color].filter(Boolean).join(' · ') || 'Standard';
  if (cat === 'Laptop') return [attrs.ram, attrs.rom].filter(Boolean).join(' · ') || 'Standard';
  return 'Stock';
}

export function syncVariants(state: AddProductState, patch: Partial<AddProductState>): AddProductState {
  const st = { ...state, ...patch };
  let combos: Record<string, string>[];
  if (st.cat === 'Phone') {
    combos = cartesian([
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

  return { ...st, variants };
}

/** Edit mode: keep a single variant row (qty 1 for serialized). */
export function syncVariantsForEdit(state: AddProductState, patch: Partial<AddProductState>): AddProductState {
  const synced = syncVariants(state, patch);
  if (synced.cat === 'Accessory') return synced;
  const primary = synced.variants[0] ?? {
    label: 'Standard',
    attrs: {},
    qty: 1,
    cost: synced.baseCost,
    price: synced.basePrice,
  };
  return { ...synced, variants: [{ ...primary, qty: 1 }] };
}
