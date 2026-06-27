import { v4 as uuidv4 } from 'uuid';
import { db, generateReceiptNumber } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
// import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { saleBlockedMissingIdentifiers } from '@/lib/serializedIdentifiers';
import { defaultWarrantyMonths } from '@/lib/warranty';
import type { SalesRecord, SalesRecordInput } from '@/types';

export function useSalesActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function recordSale(input: SalesRecordInput): Promise<SalesRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    // await assertTrialAllowsMutations(shopOwnerId);
    await assertTradingAllowedForStockPolicy(shopOwnerId, activeLocationId);

    const itemPre = await db.inventory_items.get(input.item_id);
    if (!itemPre) throw new Error('Item not found');
    const idBlock = saleBlockedMissingIdentifiers(itemPre);
    if (idBlock) throw new Error(idBlock);

    const receipt_number = await generateReceiptNumber(shopOwnerId);

    const record: SalesRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      sale_type: input.sale_type ?? 'sale',
      payment_status: input.payment_status ?? 'paid',
      device_details: input.device_details,
      warranty_months: input.warranty_months ?? defaultWarrantyMonths(input.item_category),
      receipt_number,
      sync_status: 'pending',
    };

    await db.sales_records.add(record);

    if (itemPre.mode === 'serialized') {
      await db.inventory_items.update(input.item_id, {
        status: 'sold',
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });
    } else {
      const newQty = Math.max(0, itemPre.quantity - input.quantity_sold);
      await db.inventory_items.update(input.item_id, {
        quantity: newQty,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });
    }
    const updatedItem = await db.inventory_items.get(input.item_id);
    if (updatedItem) {
      await queueSync('inventory_items', 'update', updatedItem as unknown as Record<string, unknown>);
    }

    await queueSync('sales_records', 'insert', record as unknown as Record<string, unknown>);
    await flushSyncQueue();

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    const itemLabel = `${itemPre.brand} ${itemPre.name}`.trim();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'sale.recorded',
      entityType: 'sales_record',
      entityId: record.id,
      metadata: {
        receipt: record.receipt_number,
        item: itemLabel,
        sale_price: record.sale_price,
        quantity_sold: record.quantity_sold,
      },
      actorLabel,
    });

    return record;
  }

  return { recordSale };
}
