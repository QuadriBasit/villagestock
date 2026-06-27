import {
  isAppleLaptopDevice,
  isAppleMobileDevice,
  type AppleLaptopDeviceDetails,
  type AppleMobileDeviceDetails,
  type InventoryItemInput,
} from '@/types';
import { normalizeImeiDigits } from '@/lib/serializedIdentifiers';
import {
  CAT_META,
  mapIntakeCondition,
  type AddProductState,
  type ProductCat,
  type VariantRow,
} from './types';

function needsInspect(state: AddProductState): boolean {
  return (state.cat === 'Phone' || state.cat === 'Laptop') && state.condition !== 'New';
}

function buildDescription(state: AddProductState, variant: VariantRow): string | undefined {
  const parts: string[] = [];
  if (state.condition !== 'New') parts.push(state.condition);
  if (state.cat === 'Accessory' && state.spec.trim()) parts.push(state.spec.trim());
  if (state.shelf.trim()) parts.push(`Shelf ${state.shelf.trim()}`);
  if (needsInspect(state)) parts.push(`Grade ${state.insp.grade}`);
  if (state.cat === 'Laptop' && state.processor.trim()) parts.push(state.processor.trim());
  if (state.cat !== 'Accessory' && variant.label !== 'Stock' && variant.label !== 'Standard') {
    parts.push(variant.label);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function buildAppleMobileDetails(state: AddProductState, variant: VariantRow): AppleMobileDeviceDetails {
  const storage = variant.attrs.storage as AppleMobileDeviceDetails['storage'] | undefined;
  return {
    storage,
    color: variant.attrs.color,
    battery_health: state.insp.batteryHealth,
    biometric_status: state.insp.faceId ? 'working' : 'not_working',
    ...(state.insp.display === 'Changed' ? { important_display_message: true, mdm_idm: true } : {}),
    ...(state.insp.battery === 'Changed'
      ? { important_battery_message: true, mdm_ibm: true, serviced_battery_third_party: state.insp.batteryHealth < 80 }
      : state.insp.batteryHealth < 80
        ? { serviced_battery_third_party: true }
        : {}),
    ...(state.insp.camera === 'Changed' ? { mdm_icm: true } : {}),
  };
}

function buildAppleLaptopDetails(state: AddProductState, variant: VariantRow): AppleLaptopDeviceDetails {
  const storage = variant.attrs.rom as AppleLaptopDeviceDetails['storage'] | undefined;
  const ram = variant.attrs.ram as AppleLaptopDeviceDetails['ram'] | undefined;
  return {
    ram,
    storage,
    chip: state.processor.trim() || undefined,
    battery_health: state.insp.batteryHealth,
    screen_condition: state.insp.display === 'Changed' ? 'replaced' : 'perfect',
  };
}

function buildDeviceDetails(state: AddProductState, variant: VariantRow) {
  const category = CAT_META[state.cat].category;
  const brand = state.brand;
  if (isAppleMobileDevice(brand, category)) return buildAppleMobileDetails(state, variant);
  if (isAppleLaptopDevice(brand, category)) return buildAppleLaptopDetails(state, variant);
  return undefined;
}

function ensureAccessoryVariant(state: AddProductState): VariantRow[] {
  if (state.variants.length > 0) return state.variants;
  return [{ label: 'Stock', attrs: {}, qty: 1, cost: state.baseCost, price: state.basePrice }];
}

/** First row only — for editing a single inventory record. */
export function buildSingleIntakeItem(state: AddProductState): InventoryItemInput {
  const items = buildIntakeItems(state);
  const first = items[0];
  if (!first) throw new Error('Nothing to save');
  return first;
}

export function buildIntakeItems(state: AddProductState): InventoryItemInput[] {
  const category = CAT_META[state.cat].category;
  const condition = mapIntakeCondition(state.condition);
  const items: InventoryItemInput[] = [];
  const variants = state.cat === 'Accessory' ? ensureAccessoryVariant(state) : state.variants;

  for (const variant of variants) {
    if (state.cat === 'Accessory') {
      items.push({
        name: state.model.trim(),
        category: 'accessories',
        brand: state.brand,
        price: variant.price,
        cost_price: variant.cost || undefined,
        quantity: variant.qty,
        low_stock_threshold: state.reorder,
        condition,
        description: buildDescription(state, variant),
      });
      continue;
    }

    for (let u = 0; u < variant.qty; u++) {
      const codes = state.serials[variant.label] ?? [];
      const code = (codes[u] ?? '').trim();
      const input: InventoryItemInput = {
        name: state.model.trim(),
        category,
        brand: state.brand,
        price: variant.price,
        cost_price: variant.cost || undefined,
        quantity: 1,
        low_stock_threshold: 0,
        condition,
        description: buildDescription(state, variant),
        deviceDetails: buildDeviceDetails(state, variant),
      };

      if (state.track) {
        if (state.cat === 'Phone') {
          const digits = normalizeImeiDigits(code);
          if (digits) input.imei = digits;
        } else if (state.cat === 'Laptop' && code) {
          input.serial_number = code;
        }
      }

      items.push(input);
    }
  }

  return items;
}

export function flowSteps(state: AddProductState): string[] {
  const hasVariants = state.cat !== 'Accessory';
  const tracks = (state.cat === 'Phone' || state.cat === 'Laptop') && state.track;
  const inspect = needsInspect(state);
  return [
    'Identify',
    hasVariants ? 'Variants' : 'Stock',
    ...(tracks ? ['Serials'] : []),
    ...(inspect ? ['Inspect'] : []),
    'Review',
  ];
}

export function idTypeFor(state: AddProductState): 'IMEI' | 'Serial' {
  return state.cat === 'Phone' ? 'IMEI' : 'Serial';
}

export function isIdmFlagged(state: AddProductState): boolean {
  return state.cat === 'Phone' && needsInspect(state) && state.insp.display === 'Changed';
}

export function totalUnits(state: AddProductState): number {
  const variants = state.cat === 'Accessory' ? ensureAccessoryVariant(state) : state.variants;
  return variants.reduce((a, v) => a + (v.qty || 0), 0);
}

export function stockValue(state: AddProductState): number {
  const variants = state.cat === 'Accessory' ? ensureAccessoryVariant(state) : state.variants;
  return variants.reduce((a, v) => a + (v.qty || 0) * (v.price || 0), 0);
}

export function resetForCategory(cat: ProductCat, engineerDefault: string): AddProductState {
  return {
    cat,
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
    track: cat !== 'Accessory',
    serials: {},
    faults: [],
  };
}
