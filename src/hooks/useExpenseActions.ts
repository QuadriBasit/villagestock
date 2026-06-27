import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { ExpenseRecord, ExpenseRecordInput } from '@/types';

export function useExpenseActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function recordExpense(input: ExpenseRecordInput): Promise<ExpenseRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    const now = new Date().toISOString();
    const record: ExpenseRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      created_at: now,
    };
    await db.expense_records.add(record);

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'expense.recorded',
      entityType: 'expense',
      entityId: record.id,
      metadata: { label: record.label, amount: record.amount, category: record.category },
      actorLabel,
    });

    return record;
  }

  return { recordExpense };
}
