import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import { buildCreditPayment, getCreditStatus } from '@/hooks/useCredits';
import type { CreditRecord, CreditRecordInput, PaymentMethod } from '@/types';

export function useCreditActions() {
  const { user } = useAuthStore();

  async function createCreditRecord(input: CreditRecordInput): Promise<CreditRecord> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);

    const balanceOwed = Math.max(0, input.total_amount - input.amount_paid);
    const status = balanceOwed <= 0
      ? 'paid'
      : input.amount_paid > 0
      ? (new Date(input.due_date) < new Date() ? 'overdue' : 'partially_paid')
      : getCreditStatus(balanceOwed, input.due_date);

    const record: CreditRecord = {
      ...input,
      id: uuidv4(),
      user_id: user.id,
      balance_owed: balanceOwed,
      status,
      sync_status: 'pending',
    };

    await db.credit_records.add(record);
    await queueSync('credit_records', 'insert', record as unknown as Record<string, unknown>);
    return record;
  }

  async function recordPayment(creditId: string, amount: number, date: string, method?: PaymentMethod): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    const existing = await db.credit_records.get(creditId);
    if (!existing) throw new Error('Credit not found');

    const payments = [...existing.payments, buildCreditPayment(amount, date, method)];
    const amountPaid = existing.amount_paid + amount;
    const balanceOwed = Math.max(0, existing.total_amount - amountPaid);
    const status = balanceOwed <= 0
      ? 'paid'
      : amountPaid > 0
      ? (new Date(existing.due_date) < new Date() ? 'overdue' : 'partially_paid')
      : getCreditStatus(balanceOwed, existing.due_date);

    const updated: Partial<CreditRecord> = {
      amount_paid: amountPaid,
      balance_owed: balanceOwed,
      payments,
      status,
      sync_status: 'pending',
    };

    await db.credit_records.update(creditId, updated);
    const latest = await db.credit_records.get(creditId);
    if (latest) {
      await queueSync('credit_records', 'update', latest as unknown as Record<string, unknown>);
    }
  }

  return { createCreditRecord, recordPayment };
}
