import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { getCategoryMode } from '@/types';
import type { InventoryItem, InventoryItemInput, SerializedItemStatus } from '@/types';

export function useInventoryActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();

  async function addItem(input: InventoryItemInput): Promise<string> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(shopOwnerId);

    const mode = getCategoryMode(input.category);
    const now = new Date().toISOString();

    const item: InventoryItem = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      mode,
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
    await flushSyncQueue();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_created',
      entityType: 'inventory_item',
      entityId: item.id,
      metadata: { name: item.name, category: item.category },
    });
    return item.id;
  }

  async function updateItem(id: string, changes: Partial<InventoryItemInput>): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(shopOwnerId);
    const now = new Date().toISOString();
    const updates = { ...changes, updated_at: now, sync_status: 'pending' as const };
    await db.inventory_items.update(id, updates);
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_updated',
      entityType: 'inventory_item',
      entityId: id,
      metadata: { keys: Object.keys(changes) },
    });
  }

  async function updateSerializedStatus(id: string, status: SerializedItemStatus): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(shopOwnerId);
    const now = new Date().toISOString();
    await db.inventory_items.update(id, { status, updated_at: now, sync_status: 'pending' as const });
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.status_changed',
      entityType: 'inventory_item',
      entityId: id,
      metadata: { status },
    });
  }

  async function deleteItem(id: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(shopOwnerId);
    await db.inventory_items.update(id, {
      deleted: true,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    await queueSync('inventory_items', 'delete', { id });
    await flushSyncQueue();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_archived',
      entityType: 'inventory_item',
      entityId: id,
    });
  }

  async function adjustStock(id: string, delta: number, note?: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(shopOwnerId);
    const item = await db.inventory_items.get(id);
    if (!item) throw new Error('Item not found');
    if (item.mode === 'serialized') throw new Error('Use updateSerializedStatus for serialized items');

    const newQty = Math.max(0, item.quantity + delta);
    const now = new Date().toISOString();
    await db.inventory_items.update(id, { quantity: newQty, updated_at: now, sync_status: 'pending' });
    const after = await db.inventory_items.get(id);
    if (after) {
      await queueSync('inventory_items', 'update', after as unknown as Record<string, unknown>);
    }

    const movement = {
      id: uuidv4(),
      item_id: id,
      user_id: shopOwnerId,
      type: (delta >= 0 ? 'in' : 'out') as 'in' | 'out',
      quantity: Math.abs(delta),
      note,
      created_at: new Date().toISOString(),
    };

    await db.stock_movements.add(movement);
    await queueSync('stock_movements', 'insert', movement as unknown as Record<string, unknown>);
    await flushSyncQueue();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.stock_adjusted',
      entityType: 'inventory_item',
      entityId: id,
      metadata: { delta, note },
    });
  }

  return { addItem, updateItem, updateSerializedStatus, deleteItem, adjustStock };
}
