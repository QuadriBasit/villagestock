import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
// import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { ReturnRecord, ReturnRecordInput } from '@/types';

export function useReturnActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();

  async function processReturn(input: ReturnRecordInput): Promise<ReturnRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
    const saleRow = await db.sales_records.get(input.sale_id);
    const location_id = saleRow?.location_id;
    if (!location_id) throw new Error('Original sale is missing branch — sync and try again');

    const record: ReturnRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id,
      sync_status: 'pending',
    };

    await db.return_records.add(record);

    // Mark the original sale as returned
    await db.sales_records.update(input.sale_id, {
      returned: true,
      return_id: record.id,
    });

    const item = await db.inventory_items.get(input.item_id);
    if (item) {
      if (item.mode === 'serialized') {
        // Restore unit status based on return type
        const newStatus = input.return_type === 'refund' ? 'in_stock' : 'returned';
        await db.inventory_items.update(input.item_id, {
          status: newStatus,
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        });
      } else if (input.return_type === 'refund') {
        // Non-serialized refund: restock quantity
        const sale = await db.sales_records.get(input.sale_id);
        const qty = sale?.quantity_sold ?? 1;
        await db.inventory_items.update(input.item_id, {
          quantity: item.quantity + qty,
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        });
      }

      const updatedItem = await db.inventory_items.get(input.item_id);
      if (updatedItem) {
        await queueSync('inventory_items', 'update', updatedItem as unknown as Record<string, unknown>);
      }
    }

    await queueSync('return_records', 'insert', record as unknown as Record<string, unknown>);

    const updatedSale = await db.sales_records.get(input.sale_id);
    if (updatedSale) {
      await queueSync('sales_records', 'update', updatedSale as unknown as Record<string, unknown>);
    }

    await flushSyncQueue();
    if (actorUserId) {
      const sale = await db.sales_records.get(input.sale_id);
      const retItem = await db.inventory_items.get(input.item_id);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'return.processed',
        entityType: 'return_record',
        entityId: record.id,
        metadata: {
          receipt: sale?.receipt_number,
          item: retItem ? `${retItem.brand} ${retItem.name}`.trim() : undefined,
          return_type: input.return_type,
          refund_amount: input.refund_amount,
        },
        actorLabel,
      });
    }
    return record;
  }

  return { processReturn };
}
