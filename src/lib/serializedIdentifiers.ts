import { getCategoryMode, type Category, type InventoryItem } from '@/types';

/** Strip non-digits for IMEI checks. */
export function normalizeImeiDigits(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Keys for matching a scanned value against inventory identifiers. */
export function normalizeScanLookupKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const keys = new Set<string>([trimmed.toLowerCase()]);
  const digits = normalizeImeiDigits(trimmed);
  if (digits.length >= 8) keys.add(digits);
  return [...keys];
}

export function inventoryItemLookupKeys(
  item: Pick<InventoryItem, 'imei' | 'serial_number' | 'barcode'>
): string[] {
  const keys = new Set<string>();
  const imei = normalizeImeiDigits(item.imei);
  if (imei) keys.add(imei);
  const sn = (item.serial_number ?? '').trim().toLowerCase();
  if (sn) keys.add(sn);
  const barcode = (item.barcode ?? '').trim().toLowerCase();
  if (barcode) keys.add(barcode);
  return [...keys];
}

/** Find a checklist row whose IMEI, S/N, or barcode matches the scan. */
export function findItemByScannedValue<T extends Pick<InventoryItem, 'imei' | 'serial_number' | 'barcode'>>(
  items: T[],
  scanned: string
): T | undefined {
  const scanKeys = normalizeScanLookupKeys(scanned);
  if (scanKeys.length === 0) return undefined;
  return items.find(item => {
    const itemKeys = inventoryItemLookupKeys(item);
    return itemKeys.some(k => scanKeys.includes(k));
  });
}

/** ITU E.212 IMEI is 15 digits; allow14–17 to cover entry typos / IMEISV. */
export function isPlausibleImei(digits: string): boolean {
  return digits.length >= 14 && digits.length <= 17;
}

export function categoryRequiresImei(category: Category): boolean {
  return category === 'phones' || category === 'tablets';
}

export function categoryRequiresSerialNumber(category: Category): boolean {
  return category === 'laptops';
}

/** `null` if identifiers are OK for a serialized unit; otherwise a user-facing reason. */
export function saleBlockedMissingIdentifiers(
  item: Pick<InventoryItem, 'mode' | 'category' | 'imei' | 'serial_number'>
): string | null {
  if (item.mode !== 'serialized') return null;
  if (categoryRequiresImei(item.category)) {
    if (!isPlausibleImei(normalizeImeiDigits(item.imei))) {
      return 'This unit needs a valid IMEI (14–17 digits) before it can be sold. Edit the item and add IMEI.';
    }
  }
  if (categoryRequiresSerialNumber(item.category)) {
    if (!(item.serial_number ?? '').trim()) {
      return 'This laptop needs a serial number before it can be sold. Edit the item and add S/N.';
    }
  }
  return null;
}

/** Block create/update when serialized category is missing required identifiers. */
export function inventoryMissingRequiredIdentifiers(
  category: Category,
  imei?: string | null,
  serial_number?: string | null
): string | null {
  if (getCategoryMode(category) !== 'serialized') return null;
  if (categoryRequiresImei(category) && !isPlausibleImei(normalizeImeiDigits(imei))) {
    return 'Phones and tablets need a valid IMEI (14–17 digits).';
  }
  if (categoryRequiresSerialNumber(category) && !(serial_number ?? '').trim()) {
    return 'Laptops need a serial number.';
  }
  return null;
}
