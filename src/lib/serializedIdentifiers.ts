import { getCategoryMode, type Category, type InventoryItem } from '@/types';

/** Strip non-digits for IMEI checks. */
export function normalizeImeiDigits(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D/g, '');
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
