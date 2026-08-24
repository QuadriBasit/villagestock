import type { IntakeCondition } from '@/components/inventory/addProduct/types';
import type { AppleMobileDeviceDetails, Category, DeviceCondition, DeviceDetails } from '@/types';

const STORAGE_OPTIONS = new Set(['64GB', '128GB', '256GB', '512GB', '1TB']);

export type SwapIncomingIntake = {
  intake_condition: IntakeCondition;
  grade?: 'A' | 'B' | 'C';
  storage?: string;
  color?: string;
  battery_health?: number;
  condition_notes?: string;
  condition: DeviceCondition;
};

export function buildSwapIncomingDescription(intake: SwapIncomingIntake): string | undefined {
  const parts: string[] = [];
  if (intake.intake_condition !== 'New') parts.push(intake.intake_condition);
  if (intake.intake_condition !== 'New' && intake.grade) parts.push(`Grade ${intake.grade}`);
  if (intake.storage?.trim()) parts.push(intake.storage.trim());
  if (intake.color?.trim()) parts.push(intake.color.trim());
  if (intake.condition_notes?.trim()) parts.push(intake.condition_notes.trim());
  return parts.length ? parts.join(' · ') : undefined;
}

export function buildSwapIncomingDeviceDetails(
  intake: SwapIncomingIntake,
  category: Category,
): DeviceDetails | undefined {
  if (category !== 'phones' && category !== 'tablets') return undefined;

  const details: AppleMobileDeviceDetails = {};
  const storage = intake.storage?.trim();
  if (storage && STORAGE_OPTIONS.has(storage)) {
    details.storage = storage as AppleMobileDeviceDetails['storage'];
  }
  if (intake.color?.trim()) details.color = intake.color.trim();
  if (intake.battery_health != null && !Number.isNaN(intake.battery_health)) {
    details.battery_health = Math.min(100, Math.max(0, Math.round(intake.battery_health)));
  }

  return Object.keys(details).length ? details : undefined;
}
