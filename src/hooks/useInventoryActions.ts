import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
// import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { getCategoryMode } from '@/types';
import { inventoryMissingRequiredIdentifiers } from '@/lib/serializedIdentifiers';
import type { InventoryItem, InventoryItemInput, SerializedItemStatus } from '@/types';

export function useInventoryActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId, actorAllowedLocationIds } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function addItem(input: InventoryItemInput, options?: { deferIdentifiers?: boolean }): Promise<string> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    // await assertTrialAllowsMutations(shopOwnerId);

    const mode = getCategoryMode(input.category);
    if (!options?.deferIdentifiers) {
      const idErr = inventoryMissingRequiredIdentifiers(input.category, input.imei, input.serial_number);
      if (idErr) throw new Error(idErr);
    }

    const now = new Date().toISOString();

    if (mode === 'non_serialized') {
      const existing = await db.inventory_items
        .where('user_id')
        .equals(shopOwnerId)
        .filter(
          i =>
            !i.deleted &&
            i.location_id === activeLocationId &&
            i.brand === input.brand &&
            i.name === input.name &&
            i.category === input.category &&
            (i.description ?? '') === (input.description ?? ''),
        )
        .first();
      if (existing) {
        const quantity = existing.quantity + input.quantity;
        await updateItem(existing.id, { quantity, price: input.price, cost_price: input.cost_price });
        return existing.id;
      }
    }

    const item: InventoryItem = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
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
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_created',
      entityType: 'inventory_item',
      entityId: item.id,
      metadata: { item: `${item.brand} ${item.name}`.trim(), category: item.category },
      actorLabel,
    });
    return item.id;
  }

  async function updateItem(
    id: string,
    changes: Partial<InventoryItemInput>,
    options?: { deferIdentifiers?: boolean },
  ): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
    const existing = await db.inventory_items.get(id);
    if (!existing) throw new Error('Item not found');
    const now = new Date().toISOString();
    const { location_id, ...rest } = changes as Partial<InventoryItemInput> & {
      location_id?: string;
    };
    void location_id;
    const merged = { ...existing, ...rest };
    if (!options?.deferIdentifiers) {
      const idErr = inventoryMissingRequiredIdentifiers(merged.category, merged.imei, merged.serial_number);
      if (idErr) throw new Error(idErr);
    }
    const updates = { ...rest, updated_at: now, sync_status: 'pending' as const };
    await db.inventory_items.update(id, updates);
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    const inv = await db.inventory_items.get(id);
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_updated',
      entityType: 'inventory_item',
      entityId: id,
      metadata: {
        item: inv ? `${inv.brand} ${inv.name}`.trim() : undefined,
        fields_updated: Object.keys(rest).join(', '),
      },
      actorLabel,
    });
  }

  async function updateSerializedStatus(id: string, status: SerializedItemStatus): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
    const now = new Date().toISOString();
    await db.inventory_items.update(id, { status, updated_at: now, sync_status: 'pending' as const });
    const updated = await db.inventory_items.get(id);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    const inv2 = await db.inventory_items.get(id);
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.status_changed',
      entityType: 'inventory_item',
      entityId: id,
      metadata: {
        item: inv2 ? `${inv2.brand} ${inv2.name}`.trim() : undefined,
        status,
      },
      actorLabel,
    });
  }

  async function deleteItem(id: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
    await db.inventory_items.update(id, {
      deleted: true,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    await queueSync('inventory_items', 'delete', { id });
    await flushSyncQueue();
    const archived = await db.inventory_items.get(id);
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_archived',
      entityType: 'inventory_item',
      entityId: id,
      metadata: archived ? { item: `${archived.brand} ${archived.name}`.trim() } : {},
      actorLabel,
    });
  }

  async function adjustStock(id: string, delta: number, note?: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    // await assertTrialAllowsMutations(shopOwnerId);
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
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.stock_adjusted',
      entityType: 'inventory_item',
      entityId: id,
      metadata: { item: `${item.brand} ${item.name}`.trim(), delta, note },
      actorLabel,
    });
  }

  async function transferItemToBranch(itemId: string, targetLocationId: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady) throw new Error('Select a branch first');
    // await assertTrialAllowsMutations(shopOwnerId);
    const item = await db.inventory_items.get(itemId);
    if (!item || item.user_id !== shopOwnerId || item.deleted) throw new Error('Item not found');
    const fromId = item.location_id;
    if (!fromId) throw new Error('Item has no branch assigned');
    if (fromId === targetLocationId) return;

    const scope = actorAllowedLocationIds;
    const unrestricted = actorUserId === shopOwnerId || !scope || scope.length === 0;
    const canAccess = (loc: string) => unrestricted || scope!.includes(loc);
    if (!canAccess(fromId) || !canAccess(targetLocationId)) {
      throw new Error('You cannot move stock to or from that branch.');
    }

    const now = new Date().toISOString();
    await db.inventory_items.update(itemId, {
      location_id: targetLocationId,
      updated_at: now,
      sync_status: 'pending',
    });
    const updated = await db.inventory_items.get(itemId);
    if (updated) {
      await queueSync('inventory_items', 'update', updated as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    const [fromLoc, toLoc] = await Promise.all([
      db.shop_locations.get(fromId),
      db.shop_locations.get(targetLocationId),
    ]);
    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'inventory.item_transferred_branch',
      entityType: 'inventory_item',
      entityId: itemId,
      metadata: {
        item: `${item.brand} ${item.name}`.trim(),
        from_branch: fromLoc?.name ?? 'Branch',
        to_branch: toLoc?.name ?? 'Branch',
      },
      actorLabel,
    });
  }

  return {
    addItem,
    updateItem,
    updateSerializedStatus,
    deleteItem,
    adjustStock,
    transferItemToBranch,
  };
}
