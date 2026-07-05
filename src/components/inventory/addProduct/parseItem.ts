import type { Category, InventoryItem } from '@/types';
import {
  blankAddProductState,
  CAT_META,
  variantLabel,
  type AddProductState,
  type IntakeCondition,
  type ProductCat,
  type VariantRow,
} from './types';
import { networkStateFromDeviceDetails } from '@/lib/networkLock';
import { toLocalDatetimeValue } from '@/components/ui/DateTimeField';

export function categoryToProductCat(category: Category): ProductCat | null {
  if (category === 'phones' || category === 'tablets') return 'Phone';
  if (category === 'laptops') return 'Laptop';
  if (category === 'accessories') return 'Accessory';
  return null;
}

export function supportsWizardEdit(category: Category): boolean {
  return categoryToProductCat(category) !== null;
}

function parseIntakeCondition(descParts: string[]): IntakeCondition {
  const head = descParts[0];
  if (head === 'New') return 'New';
  if (head === 'UK Used') return 'UK Used';
  if (head === 'Refurb') return 'Refurb';
  if (head === 'Used') return 'Used';
  return 'Used';
}

function parseInspection(item: InventoryItem): AddProductState['insp'] {
  const dd = item.deviceDetails;
  const gradeMatch = (item.description ?? '').match(/Grade ([ABC])\b/);
  const grade = (gradeMatch?.[1] as 'A' | 'B' | 'C' | undefined) ?? 'A';

  if (!dd) {
    return {
      display: 'Original',
      battery: 'Original',
      batteryHealth: 100,
      camera: 'Original',
      faceId: true,
      grade,
    };
  }

  return {
    display:
      ('important_display_message' in dd && dd.important_display_message) ||
      ('screen_condition' in dd && dd.screen_condition === 'replaced')
        ? 'Changed'
        : 'Original',
    battery: 'important_battery_message' in dd && dd.important_battery_message ? 'Changed' : 'Original',
    batteryHealth: typeof dd.battery_health === 'number' ? dd.battery_health : 100,
    camera: 'mdm_icm' in dd && dd.mdm_icm ? 'Changed' : 'Original',
    faceId: 'biometric_status' in dd ? dd.biometric_status !== 'not_working' : true,
    grade,
  };
}

export function itemToAddProductState(item: InventoryItem, engineerDefault = ''): AddProductState | null {
  const cat = categoryToProductCat(item.category);
  if (!cat) return null;

  const descParts = (item.description ?? '')
    .split(' · ')
    .map(s => s.trim())
    .filter(Boolean);
  const condition = parseIntakeCondition(descParts);

  let shelf = '';
  const shelfPart = descParts.find(p => p.startsWith('Shelf '));
  if (shelfPart) shelf = shelfPart.replace(/^Shelf\s+/, '');

  const dd = item.deviceDetails;
  let storages: string[] = [];
  let colors: string[] = [];
  let rams: string[] = [];
  let roms: string[] = [];
  let processor = '';

  if (dd && 'storage' in dd && dd.storage) {
    if (cat === 'Phone') storages = [dd.storage];
    if (cat === 'Laptop') roms = [dd.storage];
  }
  if (dd && 'color' in dd && dd.color) colors = [dd.color];
  if (dd && 'ram' in dd && dd.ram) rams = [String(dd.ram)];
  if (dd && 'chip' in dd && dd.chip) processor = dd.chip;

  let spec = '';
  if (cat === 'Accessory') {
    spec = descParts
      .filter(
        p =>
          !['New', 'Used', 'UK Used', 'Refurb'].includes(p) &&
          !p.startsWith('Shelf ') &&
          !/^Grade [ABC]$/.test(p),
      )
      .join(' · ');
  }

  const attrs: Record<string, string | undefined> = {
    storage: storages[0],
    color: colors[0],
    ram: rams[0],
    rom: roms[0],
  };
  const label = variantLabel(cat, attrs);

  const variant: VariantRow = {
    label,
    attrs,
    qty: cat === 'Accessory' ? item.quantity : 1,
    cost: item.cost_price ?? 0,
    price: item.price,
  };

  const serialCode = item.imei || item.serial_number || '';
  const track = cat === 'Accessory' ? false : Boolean(serialCode) || cat === 'Phone' || cat === 'Laptop';

  const base = blankAddProductState(engineerDefault);
  return {
    ...base,
    cat,
    brand: item.brand,
    model: item.name,
    spec,
    condition,
    storages,
    colors,
    rams,
    roms,
    processor,
    baseCost: item.cost_price ?? 0,
    basePrice: item.price,
    reorder: item.low_stock_threshold ?? 2,
    shelf,
    variants: [variant],
    insp: parseInspection(item),
    track,
    serials: serialCode ? { [label]: [serialCode] } : {},
    network:
      cat === 'Phone' && dd && typeof dd === 'object'
        ? networkStateFromDeviceDetails(dd as Parameters<typeof networkStateFromDeviceDetails>[0])
        : base.network,
    stockedAt: toLocalDatetimeValue(new Date(item.created_at)),
  };
}

export function productCatToCategory(cat: ProductCat): Category {
  return CAT_META[cat].category;
}
