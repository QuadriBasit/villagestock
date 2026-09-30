import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { purchaseLineBrand, purchaseLineStockError } from '@/lib/purchasing';
import { normalizeImeiDigits } from '@/lib/serializedIdentifiers';
import { getCategoryMode, type PurchaseArrival, type PurchaseLine, type PurchaseRecord, type PurchaseRecordInput } from '@/types';
import { useInventoryActions } from '@/hooks/useInventoryActions';

export function usePurchaseActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId, hasPermission } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const { addItem } = useInventoryActions();

  async function stockPurchaseLines(lines: PurchaseLine[]): Promise<PurchaseLine[]> {
    for (const line of lines) {
      const err = purchaseLineStockError(line);
      if (err) throw new Error(err);
    }
    const seen = new Set<string>();
    for (const line of lines) {
      if (!line.category || getCategoryMode(line.category) !== 'serialized') continue;
      for (const raw of line.unit_ids ?? []) {
        const key = line.category === 'laptops' ? raw.trim().toLowerCase() : normalizeImeiDigits(raw);
        if (seen.has(key)) throw new Error(`${line.name} repeats ${raw.trim()}.`);
        seen.add(key);
      }
    }
    if (shopOwnerId && seen.size > 0) {
      const existing = await db.inventory_items.where('user_id').equals(shopOwnerId).toArray();
      const taken = new Set<string>();
      for (const item of existing) {
        if (item.deleted) continue;
        const imei = normalizeImeiDigits(item.imei);
        const imei2 = normalizeImeiDigits(item.imei2);
        const serial = (item.serial_number ?? '').trim().toLowerCase();
        if (imei) taken.add(imei);
        if (imei2) taken.add(imei2);
        if (serial) taken.add(serial);
      }
      for (const key of seen) {
        if (taken.has(key)) throw new Error(`${key} is already in stock.`);
      }
    }

    const stocked: PurchaseLine[] = [];
    for (const line of lines) {
      const category = line.category!;
      const brand = purchaseLineBrand(line);
      const name = line.name.trim();
      const price = line.sell_price!;
      if (getCategoryMode(category) === 'serialized') {
        for (const raw of line.unit_ids ?? []) {
          await addItem({
            name,
            category,
            brand,
            price,
            cost_price: line.unit_cost,
            quantity: 1,
            low_stock_threshold: 0,
            ...(category === 'laptops'
              ? { serial_number: raw.trim() }
              : { imei: normalizeImeiDigits(raw) }),
          });
        }
      } else {
        await addItem({
          name,
          category,
          brand,
          price,
          cost_price: line.unit_cost,
          quantity: line.qty,
          low_stock_threshold: 5,
        });
      }
      stocked.push({ ...line, name, brand });
    }
    return stocked;
  }

  async function recordPurchase(
    input: PurchaseRecordInput & { arrival?: PurchaseArrival; alreadyStocked?: boolean },
  ): Promise<PurchaseRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    if (!hasPermission('access_purchasing')) throw new Error('You cannot record purchases.');
    const now = new Date().toISOString();
    const { arrival = 'on_the_way', alreadyStocked = false, ...rest } = input;
    if ((arrival === 'in_shop' || alreadyStocked) && !hasPermission('add_items')) {
      throw new Error('You can record the bill. Adding these to stock needs Add products.');
    }
    const items = arrival === 'in_shop' && !alreadyStocked ? await stockPurchaseLines(rest.items) : rest.items;
    const record: PurchaseRecord = {
      ...rest,
      items,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      created_at: now,
      received_at: arrival === 'in_shop' || alreadyStocked ? now : undefined,
      sync_status: 'pending',
    };
    await db.purchase_records.add(record);
    await queueSync('purchase_records', 'insert', record as unknown as Record<string, unknown>);

    const owed = input.total - input.paid;
    if (input.supplier_contact_id) {
      const supplier = await db.contacts.get(input.supplier_contact_id);
      if (supplier) {
        await db.contacts.update(input.supplier_contact_id, {
          balance_owed: supplier.balance_owed + Math.max(0, owed),
          deal_count: supplier.deal_count + 1,
          updated_at: now,
          sync_status: 'pending',
        });
        const latest = await db.contacts.get(input.supplier_contact_id);
        if (latest) await queueSync('contacts', 'update', latest as unknown as Record<string, unknown>);
      }
    }

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'purchase.recorded',
      entityType: 'purchase',
      entityId: record.id,
      metadata: { supplier: input.supplier_name, total: input.total, paid: input.paid },
      actorLabel,
    });

    void flushSyncQueue();
    return record;
  }

  async function receivePurchase(id: string, items: PurchaseLine[]): Promise<PurchaseRecord> {
    const row = await db.purchase_records.get(id);
    if (!row) throw new Error('Purchase not found');
    if (row.received_at) return row;
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    if (!hasPermission('access_purchasing') || !hasPermission('add_items')) {
      throw new Error('Receiving a purchase into stock needs Purchasing and Add products.');
    }
    if (row.location_id !== activeLocationId) {
      throw new Error('Switch to the branch this purchase belongs to.');
    }
    const stocked = await stockPurchaseLines(items);
    const now = new Date().toISOString();
    await db.purchase_records.update(id, {
      items: stocked,
      received_at: now,
      sync_status: 'pending',
    });
    const latest = await db.purchase_records.get(id);
    if (!latest) throw new Error('Purchase not found');
    await queueSync('purchase_records', 'update', latest as unknown as Record<string, unknown>);
    void flushSyncQueue();
    return latest;
  }

  async function paySupplier(contactId: string, amount: number): Promise<void> {
    if (!hasPermission('access_purchasing')) throw new Error('You cannot pay suppliers.');
    const supplier = await db.contacts.get(contactId);
    if (!supplier) throw new Error('Supplier not found');
    const paid = Math.min(amount, supplier.balance_owed);
    await db.contacts.update(contactId, {
      balance_owed: supplier.balance_owed - paid,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    });
    const latestSupplier = await db.contacts.get(contactId);
    if (latestSupplier) await queueSync('contacts', 'update', latestSupplier as unknown as Record<string, unknown>);

    let remaining = paid;
    const owing = (await db.purchase_records
      .where('user_id')
      .equals(supplier.user_id)
      .toArray())
      .filter(p => p.supplier_contact_id === contactId && p.total - p.paid > 0)
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
    for (const order of owing) {
      if (remaining <= 0) break;
      const owed = Math.max(0, order.total - order.paid);
      const apply = Math.min(remaining, owed);
      await db.purchase_records.update(order.id, { paid: order.paid + apply, sync_status: 'pending' });
      const latest = await db.purchase_records.get(order.id);
      if (latest) await queueSync('purchase_records', 'update', latest as unknown as Record<string, unknown>);
      remaining -= apply;
    }
    void flushSyncQueue();
  }

  return { recordPurchase, paySupplier, receivePurchase };
}
