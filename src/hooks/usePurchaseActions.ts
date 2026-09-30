import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { PurchaseRecord, PurchaseRecordInput } from '@/types';

export function usePurchaseActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function recordPurchase(input: PurchaseRecordInput): Promise<PurchaseRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    const now = new Date().toISOString();
    const record: PurchaseRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      created_at: now,
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

  async function markPurchaseReceived(id: string): Promise<void> {
    const row = await db.purchase_records.get(id);
    if (!row) throw new Error('Purchase not found');
    if (row.received_at) return;
    await db.purchase_records.update(id, {
      received_at: new Date().toISOString(),
      sync_status: 'pending',
    });
    const latest = await db.purchase_records.get(id);
    if (latest) await queueSync('purchase_records', 'update', latest as unknown as Record<string, unknown>);
    void flushSyncQueue();
  }

  async function paySupplier(contactId: string, amount: number): Promise<void> {
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

  return { recordPurchase, paySupplier, markPurchaseReceived };
}
