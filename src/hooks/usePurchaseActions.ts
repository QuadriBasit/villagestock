import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
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
    };
    await db.purchase_records.add(record);

    const owed = input.total - input.paid;
    if (input.supplier_contact_id) {
      const supplier = await db.contacts.get(input.supplier_contact_id);
      if (supplier) {
        await db.contacts.update(input.supplier_contact_id, {
          balance_owed: supplier.balance_owed + Math.max(0, owed),
          deal_count: supplier.deal_count + 1,
          updated_at: now,
        });
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

    return record;
  }

  async function paySupplier(contactId: string, amount: number): Promise<void> {
    const supplier = await db.contacts.get(contactId);
    if (!supplier) throw new Error('Supplier not found');
    const paid = Math.min(amount, supplier.balance_owed);
    await db.contacts.update(contactId, {
      balance_owed: supplier.balance_owed - paid,
      updated_at: new Date().toISOString(),
    });
  }

  return { recordPurchase, paySupplier };
}
