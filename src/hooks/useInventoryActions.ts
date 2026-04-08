import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { getCategoryMode } from '@/types';
import type { InventoryItem, InventoryItemInput, SerializedItemStatus } from '@/types';

export function useInventoryActions() {
  const { user } = useAuthStore();

  async function addItem(input: InventoryItemInput): Promise<string> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);

    const mode = getCategoryMode(input.category);
    const now = new Date().toISOString();

    const item: InventoryItem = {
      ...input,
      id: uuidv4(),
      user_id: user.id,
      mode,
      // Serialized items: always quantity=1, status=in_stock
      // Non-serialized: quantity from input, no status
      quantity: mode === 'serialized' ? 1 : input.quantity,
      low_stock_threshold: mode === 'serialized' ? 0 : input.low_stock_threshold,
      status: mode === 'serialized' ? 'in_stock' : undefined,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
      deleted: false,
    };

    await db.inventory_items.add(item);
    await queueSync('inventory_items', 'insert', item as unknown as Record<string, unknown>);
    return item.id;
  }

  async function updateItem(id: string, changes: Partial<InventoryItemInput>): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const now = new Date().toISOString();
    const updates = { ...changes, updated_at: now, sync_status: 'pending' as const };
    await db.inventory_items.update(id, updates);
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
  }

  async function updateSerializedStatus(id: string, status: SerializedItemStatus): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const now = new Date().toISOString();
    await db.inventory_items.update(id, { status, updated_at: now, sync_status: 'pending' as const });
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
  }

  async function deleteItem(id: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    await db.inventory_items.update(id, {
      deleted: true,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    await queueSync('inventory_items', 'delete', { id });
  }

  async function adjustStock(id: string, delta: number, note?: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const item = await db.inventory_items.get(id);
    if (!item) throw new Error('Item not found');
    if (item.mode === 'serialized') throw new Error('Use updateSerializedStatus for serialized items');

    const newQty = Math.max(0, item.quantity + delta);
    await updateItem(id, { quantity: newQty });

    const movement = {
      id: uuidv4(),
      item_id: id,
      user_id: user!.id,
      type: (delta >= 0 ? 'in' : 'out') as 'in' | 'out',
      quantity: Math.abs(delta),
      note,
      created_at: new Date().toISOString(),
    };

    await db.stock_movements.add(movement);
    await queueSync('stock_movements', 'insert', movement as unknown as Record<string, unknown>);
  }

  return { addItem, updateItem, updateSerializedStatus, deleteItem, adjustStock };
}
