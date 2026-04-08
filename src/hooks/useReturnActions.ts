import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import type { ReturnRecord, ReturnRecordInput } from '@/types';

export function useReturnActions() {
  const { user } = useAuthStore();

  async function processReturn(input: ReturnRecordInput): Promise<ReturnRecord> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);

    const record: ReturnRecord = {
      ...input,
      id: uuidv4(),
      user_id: user.id,
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

    return record;
  }

  return { processReturn };
}
