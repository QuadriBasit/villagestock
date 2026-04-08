import { v4 as uuidv4 } from 'uuid';
import { db, generateReceiptNumber } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import type { SalesRecord, SalesRecordInput } from '@/types';

export function useSalesActions() {
  const { user } = useAuthStore();

  async function recordSale(input: SalesRecordInput): Promise<SalesRecord> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    await assertTradingAllowedForStockPolicy(user.id);

    const receipt_number = await generateReceiptNumber(user.id);

    const record: SalesRecord = {
      ...input,
      id: uuidv4(),
      user_id: user.id,
      sale_type: input.sale_type ?? 'sale',
      payment_status: input.payment_status ?? 'paid',
      device_details: input.device_details,
      receipt_number,
      sync_status: 'pending',
    };

    await db.sales_records.add(record);

    const item = await db.inventory_items.get(input.item_id);
    if (item) {
      if (item.mode === 'serialized') {
        // Mark the individual unit as sold — do NOT touch quantity
        await db.inventory_items.update(input.item_id, {
          status: 'sold',
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        });
      } else {
        // Non-serialized: decrement quantity
        const newQty = Math.max(0, item.quantity - input.quantity_sold);
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
    }

    await queueSync('sales_records', 'insert', record as unknown as Record<string, unknown>);
    return record;
  }

  return { recordSale };
}
