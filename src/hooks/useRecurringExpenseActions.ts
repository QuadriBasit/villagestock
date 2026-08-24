import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { RecurringExpenseInput, RecurringExpenseRecord } from '@/types';

export function useRecurringExpenseActions() {
  const { user } = useAuthStore();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function addRecurringExpense(input: RecurringExpenseInput): Promise<RecurringExpenseRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');

    const record: RecurringExpenseRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      active: input.active ?? true,
      created_at: new Date().toISOString(),
    };
    await db.recurring_expenses.add(record);
    return record;
  }

  async function removeRecurringExpense(id: string): Promise<void> {
    await db.recurring_expenses.update(id, { active: false });
  }

  return { addRecurringExpense, removeRecurringExpense };
}
