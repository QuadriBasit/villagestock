import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import type { DeviceCondition, RepairRecord, RepairRecordInput, RepairStatus } from '@/types';

export function useRepairActions() {
  const { user } = useAuthStore();

  async function sendToEngineer(input: RepairRecordInput): Promise<RepairRecord> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    await assertTradingAllowedForStockPolicy(user.id);

    const record: RepairRecord = {
      ...input,
      id: uuidv4(),
      user_id: user.id,
      repair_status: 'sent',
      sync_status: 'pending',
    };

    await db.repair_records.add(record);
    await db.inventory_items.update(input.item_id, {
      status: 'with_engineer',
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    });

    await queueSync('repair_records', 'insert', record as unknown as Record<string, unknown>);
    const item = await db.inventory_items.get(input.item_id);
    if (item) {
      await queueSync('inventory_items', 'update', item as unknown as Record<string, unknown>);
    }
    return record;
  }

  async function updateRepairStatus(id: string, repairStatus: Exclude<RepairStatus, 'collected'>): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    await db.repair_records.update(id, { repair_status: repairStatus, sync_status: 'pending' });
    const latest = await db.repair_records.get(id);
    if (latest) {
      await queueSync('repair_records', 'update', latest as unknown as Record<string, unknown>);
    }
  }

  async function markCollected(id: string, itemId: string, condition?: DeviceCondition, notes?: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const now = new Date().toISOString();
    await db.repair_records.update(id, {
      repair_status: 'collected',
      date_returned: now,
      notes,
      sync_status: 'pending',
    });
    await db.inventory_items.update(itemId, {
      status: 'in_stock',
      condition,
      updated_at: now,
      sync_status: 'pending',
    });
    const repair = await db.repair_records.get(id);
    const item = await db.inventory_items.get(itemId);
    if (repair) await queueSync('repair_records', 'update', repair as unknown as Record<string, unknown>);
    if (item) await queueSync('inventory_items', 'update', item as unknown as Record<string, unknown>);
  }

  return { sendToEngineer, updateRepairStatus, markCollected };
}
