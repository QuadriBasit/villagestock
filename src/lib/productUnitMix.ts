import {
  appleMobileShowsServicedBattery,
  isAppleMobileDevice,
  type AppleMobileDeviceDetails,
  type InventoryItem,
} from '@/types';
import { getItemQty, getInspectionFlags } from '@/lib/inventoryDisplay';
import { variantLabelForItem } from '@/lib/inventoryGrouping';

const LEGACY_USED_LABELS = ['UK Used', 'Refurb', 'Used'] as const;

/** Human intake label stored at the start of `description` (from add-product wizard). */
export function intakeLabelFromItem(item: InventoryItem): string {
  if (!item.description) return 'Used';
  const head = item.description.split(' · ')[0]?.trim();
  if (head === 'New') return 'New';
  if (head && (LEGACY_USED_LABELS as readonly string[]).includes(head)) return 'Used';
  return 'Used';
}

export function gradeFromItem(item: InventoryItem): string | undefined {
  const match = item.description?.match(/Grade ([ABC])\b/);
  return match?.[1];
}

export function batteryHealthFromItem(item: InventoryItem): number | undefined {
  const dd = item.deviceDetails;
  if (dd && 'battery_health' in dd && typeof dd.battery_health === 'number') {
    return dd.battery_health;
  }
  return undefined;
}

export function unitNeedsService(item: InventoryItem): boolean {
  if (item.status === 'with_engineer' || item.status === 'defective') return true;
  const health = batteryHealthFromItem(item);
  if (health != null && health < 80 && item.status === 'in_stock') return true;
  const mobile =
    isAppleMobileDevice(item.brand, item.category) && item.deviceDetails
      ? (item.deviceDetails as AppleMobileDeviceDetails)
      : undefined;
  if (mobile && appleMobileShowsServicedBattery(mobile) && item.status === 'in_stock') return true;
  return false;
}

export function unitHasIdm(item: InventoryItem): boolean {
  return getInspectionFlags(item).includes('IDM');
}

export type ProductUnitMix = {
  total: number;
  sellable: number;
  onBench: number;
  serviceCount: number;
  idmCount: number;
  byIntake: Record<string, number>;
  batteryMin: number | null;
  batteryMax: number | null;
  costMin: number;
  costMax: number;
  priceMin: number;
  priceMax: number;
};

export function computeProductUnitMix(units: InventoryItem[]): ProductUnitMix {
  const byIntake: Record<string, number> = {};
  let sellable = 0;
  let onBench = 0;
  let serviceCount = 0;
  let idmCount = 0;
  const batteries: number[] = [];
  const costs: number[] = [];
  const prices: number[] = [];

  for (const unit of units) {
    const intake = intakeLabelFromItem(unit);
    byIntake[intake] = (byIntake[intake] ?? 0) + 1;

    const qty = getItemQty(unit);
    if (unit.status === 'in_stock') sellable += qty;
    if (unit.status === 'with_engineer' || unit.status === 'defective') onBench += 1;
    if (unitNeedsService(unit)) serviceCount += 1;
    if (unitHasIdm(unit)) idmCount += 1;

    const batt = batteryHealthFromItem(unit);
    if (batt != null) batteries.push(batt);
    costs.push(unit.cost_price ?? 0);
    prices.push(unit.price);
  }

  return {
    total: units.length,
    sellable,
    onBench,
    serviceCount,
    idmCount,
    byIntake,
    batteryMin: batteries.length ? Math.min(...batteries) : null,
    batteryMax: batteries.length ? Math.max(...batteries) : null,
    costMin: costs.length ? Math.min(...costs) : 0,
    costMax: costs.length ? Math.max(...costs) : 0,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
  };
}

export function unitRegisterMeta(item: InventoryItem): {
  intake: string;
  grade?: string;
  variant: string;
  battery?: number;
  needsService: boolean;
  idm: boolean;
  flags: ReturnType<typeof getInspectionFlags>;
} {
  return {
    intake: intakeLabelFromItem(item),
    grade: gradeFromItem(item),
    variant: variantLabelForItem(item),
    battery: batteryHealthFromItem(item),
    needsService: unitNeedsService(item),
    idm: unitHasIdm(item),
    flags: getInspectionFlags(item),
  };
}
