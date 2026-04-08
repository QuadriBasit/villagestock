import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import type { CreditPayment, CreditsSummary, CreditStatus, PaymentMethod } from '@/types';

export function getCreditStatus(balanceOwed: number, dueDate: string): CreditStatus {
  if (balanceOwed <= 0) return 'paid';
  const due = new Date(dueDate);
  const now = new Date();
  return due < now ? 'overdue' : 'pending';
}

export function useCredits() {
  const { user } = useAuthStore();

  const credits = useLiveQuery(async () => {
    if (!user) return [];
    const rows = await db.credit_records
      .where('user_id')
      .equals(user.id)
      .sortBy('due_date');
    return rows.map(record => ({
      ...record,
      status: record.balance_owed <= 0
        ? 'paid'
        : record.amount_paid > 0
        ? (new Date(record.due_date) < new Date() ? 'overdue' : 'partially_paid')
        : getCreditStatus(record.balance_owed, record.due_date),
    }));
  }, [user?.id]);

  return { credits: credits ?? [], isLoading: credits === undefined };
}

export function useOutstandingCreditsSummary() {
  const { user } = useAuthStore();

  const summary = useLiveQuery(async (): Promise<CreditsSummary> => {
    if (!user) return { outstanding_amount: 0, overdue_count: 0 };
    const credits = await db.credit_records.where('user_id').equals(user.id).toArray();
    const outstanding = credits.filter(record => record.status !== 'paid');
    return {
      outstanding_amount: outstanding.reduce((sum, record) => sum + record.balance_owed, 0),
      overdue_count: outstanding.filter(record => record.status === 'overdue').length,
    };
  }, [user?.id]);

  return { summary: summary ?? { outstanding_amount: 0, overdue_count: 0 }, isLoading: summary === undefined };
}

export function useCreditRecord(id: string) {
  const record = useLiveQuery(() => db.credit_records.get(id), [id]);
  return { record, isLoading: record === undefined };
}

export function buildCreditPayment(amount: number, date: string, method?: PaymentMethod): CreditPayment {
  return { amount, date, method };
}
