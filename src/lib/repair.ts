import type { RepairRecord, RepairStatus } from '@/types';

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  sent: 'Diagnosing',
  in_progress: 'In progress',
  completed: 'Ready for pickup',
  collected: 'Collected',
};

export const REPAIR_FLOW: RepairStatus[] = ['sent', 'in_progress', 'completed', 'collected'];

export function repairFlowIndex(status: RepairStatus): number {
  return REPAIR_FLOW.indexOf(status);
}

export function nextRepairStatus(status: RepairStatus): RepairStatus | null {
  const idx = repairFlowIndex(status);
  if (idx < 0 || idx >= REPAIR_FLOW.length - 1) return null;
  return REPAIR_FLOW[idx + 1]!;
}

export function prevRepairStatus(status: RepairStatus): RepairStatus | null {
  const idx = repairFlowIndex(status);
  if (idx <= 0) return null;
  return REPAIR_FLOW[idx - 1]!;
}

export function daysOut(dateSent: string): number {
  return Math.max(1, Math.ceil((Date.now() - new Date(dateSent).getTime()) / 86400000));
}

export function isRepairOverdue(record: RepairRecord): boolean {
  if (!record.expected_return_date) return false;
  return new Date(record.expected_return_date) < new Date();
}
