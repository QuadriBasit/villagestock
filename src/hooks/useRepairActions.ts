import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
// import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { DeviceCondition, RepairRecord, RepairRecordInput, RepairStatus } from '@/types';

export function useRepairActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function sendToEngineer(input: RepairRecordInput): Promise<RepairRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    // await assertTrialAllowsMutations(shopOwnerId);
    await assertTradingAllowedForStockPolicy(shopOwnerId, activeLocationId);

    const record: RepairRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
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
    await flushSyncQueue();
    if (actorUserId) {
      const repItem = await db.inventory_items.get(input.item_id);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'repair.sent',
        entityType: 'repair_record',
        entityId: record.id,
        metadata: {
          item: repItem ? `${repItem.brand} ${repItem.name}`.trim() : undefined,
          engineer: input.engineer_name,
        },
        actorLabel,
      });
    }
    return record;
  }

  async function updateRepairStatus(id: string, repairStatus: Exclude<RepairStatus, 'collected'>): Promise<void> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
    await db.repair_records.update(id, { repair_status: repairStatus, sync_status: 'pending' });
    const latest = await db.repair_records.get(id);
    if (latest) {
      await queueSync('repair_records', 'update', latest as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    if (actorUserId) {
      const rep = await db.repair_records.get(id);
      const repItem = rep ? await db.inventory_items.get(rep.item_id) : undefined;
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'repair.status_updated',
        entityType: 'repair_record',
        entityId: id,
        metadata: {
          item: repItem ? `${repItem.brand} ${repItem.name}`.trim() : undefined,
          status: repairStatus,
        },
        actorLabel,
      });
    }
  }

  async function markCollected(id: string, itemId: string, condition?: DeviceCondition, notes?: string): Promise<void> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
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
    await flushSyncQueue();
    if (actorUserId) {
      const colItem = await db.inventory_items.get(itemId);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'repair.collected',
        entityType: 'repair_record',
        entityId: id,
        metadata: { item: colItem ? `${colItem.brand} ${colItem.name}`.trim() : undefined },
        actorLabel,
      });
    }
  }

  return { sendToEngineer, updateRepairStatus, markCollected };
}
