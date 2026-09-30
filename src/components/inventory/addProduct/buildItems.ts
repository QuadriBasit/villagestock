import {
  isAppleLaptopDevice,
  isAppleMobileDevice,
  type AppleLaptopDeviceDetails,
  type AppleMobileDeviceDetails,
  type InventoryItemInput,
  type PurchaseLine,
} from '@/types';
import { blankNetworkState, formatNetworkDescription, mobileNetworkDeviceDetails } from '@/lib/networkLock';
import { toLocalDatetimeValue } from '@/components/ui/DateTimeField';
import { normalizeImeiDigits } from '@/lib/serializedIdentifiers';
import {
  CAT_META,
  isHandheldCat,
  isSimpleStockCat,
  mapIntakeCondition,
  syncVariants,
  type AddProductState,
  type ProductCat,
  type VariantRow,
} from './types';

function needsInspect(state: AddProductState): boolean {
  return (isHandheldCat(state.cat) || state.cat === 'Laptop') && state.condition !== 'New';
}

function buildDescription(state: AddProductState, variant: VariantRow): string | undefined {
  const parts: string[] = [];
  if (state.condition !== 'New') parts.push(state.condition);
  if (isSimpleStockCat(state.cat) && state.spec.trim()) parts.push(state.spec.trim());
  if (state.shelf.trim()) parts.push(`Shelf ${state.shelf.trim()}`);
  if (needsInspect(state)) parts.push(`Grade ${state.insp.grade}`);
  if (state.cat === 'Laptop' && state.processor.trim()) parts.push(state.processor.trim());
  if (state.cat !== 'Accessory' && variant.label !== 'Stock' && variant.label !== 'Standard') {
    parts.push(variant.label);
  }
  if (isHandheldCat(state.cat)) {
    const networkDesc = formatNetworkDescription(mobileNetworkDeviceDetails(state.network));
    if (networkDesc) parts.push(networkDesc);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function phoneSpecDetails(variant: VariantRow): Pick<AppleMobileDeviceDetails, 'ram' | 'storage' | 'color'> {
  return {
    ...(variant.attrs.ram ? { ram: variant.attrs.ram } : {}),
    ...(variant.attrs.storage
      ? { storage: variant.attrs.storage as AppleMobileDeviceDetails['storage'] }
      : {}),
    ...(variant.attrs.color ? { color: variant.attrs.color } : {}),
  };
}

function buildAppleMobileDetails(state: AddProductState, variant: VariantRow): AppleMobileDeviceDetails {
  return {
    ...phoneSpecDetails(variant),
    battery_health: state.insp.batteryHealth,
    biometric_status: state.insp.faceId ? 'working' : 'not_working',
    ...mobileNetworkDeviceDetails(state.network),
    ...(state.insp.display === 'Changed' ? { important_display_message: true, mdm_idm: true } : {}),
    ...(state.insp.battery === 'Changed'
      ? {
          important_battery_message: true,
          mdm_ibm: true,
          ...(state.insp.batteryHealth < 80 ? { serviced_battery_third_party: true } : {}),
        }
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
  if (isHandheldCat(state.cat)) {
    const specs = phoneSpecDetails(variant);
    const network = state.network.status ? mobileNetworkDeviceDetails(state.network) : {};
    const details = { ...specs, ...network };
    return Object.values(details).some(v => v !== undefined && v !== '') ? details : undefined;
  }
  if (state.cat === 'Laptop') return buildAppleLaptopDetails(state, variant);
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
  const variants = isSimpleStockCat(state.cat) ? ensureAccessoryVariant(state) : state.variants;

  for (const variant of variants) {
    if (isSimpleStockCat(state.cat)) {
      items.push({
        name: state.model.trim(),
        category,
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
        if (isHandheldCat(state.cat)) {
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

export function flowSteps(state: AddProductState, options?: { skipSerials?: boolean }): string[] {
  const hasVariants = !isSimpleStockCat(state.cat);
  const tracks = (isHandheldCat(state.cat) || state.cat === 'Laptop') && state.track && !options?.skipSerials;
  const inspect = needsInspect(state);
  return [
    'Identify',
    hasVariants ? 'Variants' : 'Stock',
    ...(tracks ? ['Serials'] : []),
    ...(isHandheldCat(state.cat) ? ['Network'] : []),
    ...(inspect ? ['Inspect'] : []),
    'Review',
  ];
}

export function idTypeFor(state: AddProductState): 'IMEI' | 'Serial' {
  return state.cat === 'Laptop' ? 'Serial' : 'IMEI';
}

export function isIdmFlagged(state: AddProductState): boolean {
  return isHandheldCat(state.cat) && needsInspect(state) && state.insp.display === 'Changed';
}

export function totalUnits(state: AddProductState): number {
  const variants = isSimpleStockCat(state.cat) ? ensureAccessoryVariant(state) : state.variants;
  return variants.reduce((a, v) => a + (v.qty || 0), 0);
}

export function stockValue(state: AddProductState): number {
  const variants = isSimpleStockCat(state.cat) ? ensureAccessoryVariant(state) : state.variants;
  return variants.reduce((a, v) => a + (v.qty || 0) * (v.price || 0), 0);
}

export function switchCategory(state: AddProductState, cat: ProductCat): AddProductState {
  if (cat === state.cat) return state;
  const fresh = resetForCategory(cat, state.engineer);
  const cost = state.variants[0]?.cost || state.baseCost;
  const price = state.variants[0]?.price || state.basePrice;
  const qty = state.variants.reduce((sum, variant) => sum + (variant.qty || 0), 0) || 1;
  const kept: AddProductState = {
    ...fresh,
    brand: state.brand,
    model: state.model,
    condition: state.condition,
    baseCost: cost,
    basePrice: price,
    reorder: state.reorder,
    shelf: state.shelf,
    spec: isSimpleStockCat(cat) ? state.spec : '',
    stockedAt: state.stockedAt,
    serials: isSimpleStockCat(cat) ? {} : state.serials,
    track: isSimpleStockCat(cat) ? false : state.track,
  };
  if (isSimpleStockCat(cat)) {
    return {
      ...kept,
      variants: [{ label: 'Stock', attrs: {}, qty, cost, price }],
    };
  }
  return syncVariants(kept, {});
}

export function purchaseLinesFromIntake(state: AddProductState): PurchaseLine[] {
  const category = CAT_META[state.cat].category;
  const variants = isSimpleStockCat(state.cat) ? ensureAccessoryVariant(state) : state.variants;
  const serialized = category === 'phones' || category === 'laptops' || category === 'tablets';
  return variants
    .filter(variant => variant.qty > 0)
    .map(variant => ({
      name: state.model.trim(),
      brand: state.brand.trim(),
      category,
      qty: variant.qty,
      unit_cost: variant.cost,
      sell_price: variant.price,
      unit_ids: serialized ? (state.serials[variant.label] ?? []).slice(0, variant.qty) : undefined,
    }));
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
    track: !isSimpleStockCat(cat),
    serials: {},
    faults: [],
    network: blankNetworkState(),
    stockedAt: toLocalDatetimeValue(new Date()),
  };
}
