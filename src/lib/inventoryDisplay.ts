import {
  appleMobileShowsServicedBattery,
  isAppleDevice,
  isAppleMobileDevice,
  type AppleMobileDeviceDetails,
  type DeviceCondition,
  type InventoryItem,
} from '@/types';

export function getItemQty(item: InventoryItem): number {
  if (item.mode === 'serialized') {
    return item.status === 'in_stock' ? 1 : 0;
  }
  return item.quantity;
}

export function getStockValue(items: InventoryItem[]): number {
  return items.reduce((sum, i) => sum + i.price * getItemQty(i), 0);
}

export function getMarginPct(item: InventoryItem): number {
  if (!item.price) return 0;
  const cost = item.cost_price ?? 0;
  return Math.round(((item.price - cost) / item.price) * 100);
}

export function conditionLabel(condition?: DeviceCondition): string {
  if (!condition) return '—';
  const map: Record<DeviceCondition, string> = {
    working: 'Working',
    minor_faults: 'Minor faults',
    major_faults: 'Major faults',
    not_working: 'Not working',
  };
  return map[condition] ?? condition;
}

export type InspectionFlag = 'IDM' | 'IBM' | 'ICM' | 'Repair';

export function getInspectionFlags(item: InventoryItem): InspectionFlag[] {
  const flags: InspectionFlag[] = [];
  if (!isAppleDevice(item.brand, item.category)) return flags;

  const mobile =
    isAppleMobileDevice(item.brand, item.category) && item.deviceDetails
      ? (item.deviceDetails as AppleMobileDeviceDetails)
      : undefined;

  if (mobile?.important_display_message || mobile?.mdm_idm) flags.push('IDM');
  if (mobile?.important_battery_message || mobile?.mdm_ibm) flags.push('IBM');
  if (mobile?.mdm_icm) flags.push('ICM');
  if (item.status === 'defective' || item.status === 'with_engineer') flags.push('Repair');
  if (mobile && appleMobileShowsServicedBattery(mobile) && !flags.includes('IBM')) {
    flags.push('IBM');
  }
  return flags;
}

export function itemSpecLine(item: InventoryItem): string {
  const parts: string[] = [];
  if (item.brand) parts.push(item.brand);
  const mobile = item.deviceDetails as AppleMobileDeviceDetails | undefined;
  if (mobile?.storage) parts.push(mobile.storage);
  if (item.imei) parts.push(`IMEI …${item.imei.slice(-4)}`);
  else if (item.serial_number) parts.push(`S/N …${item.serial_number.slice(-4)}`);
  return parts.join(' · ') || item.category;
}

export type IdentifierKind = 'IMEI' | 'Serial';

export function identifierKindForItem(item: InventoryItem): IdentifierKind | null {
  if (item.mode !== 'serialized') return null;
  if (item.category === 'laptops') return 'Serial';
  return 'IMEI';
}

export function primaryIdentifier(item: InventoryItem): string | undefined {
  const kind = identifierKindForItem(item);
  if (kind === 'IMEI') return item.imei ?? item.imei2;
  if (kind === 'Serial') return item.serial_number;
  return item.imei ?? item.serial_number;
}

export function formatIdentifier(code: string | undefined, kind: IdentifierKind): string {
  if (!code?.trim()) return '— not set';
  if (kind === 'IMEI' && code.length === 15) {
    return code.replace(/(\d{2})(\d{6})(\d{6})(\d)/, '$1 $2 $3 $4');
  }
  return code;
}

export const SERIALIZED_STATUS_LABELS: Record<string, string> = {
  in_stock: 'In stock',
  sold: 'Sold',
  reserved: 'Reserved',
  returned: 'Returned',
  defective: 'Defective',
  with_engineer: 'On bench',
  missing: 'Missing',
};

export const PROTOTYPE_CATEGORIES = [
  { value: 'all' as const, label: 'All' },
  { value: 'phones' as const, label: 'Phones' },
  { value: 'laptops' as const, label: 'Laptops' },
  { value: 'accessories' as const, label: 'Accessories' },
];
