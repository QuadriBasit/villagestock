import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { CreditPayment, CreditsSummary, CreditStatus, PaymentMethod } from '@/types';

export function getCreditStatus(balanceOwed: number, dueDate: string): CreditStatus {
  if (balanceOwed <= 0) return 'paid';
  const due = new Date(dueDate);
  const now = new Date();
  return due < now ? 'overdue' : 'pending';
}

export function useCredits() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const credits = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const rows = await db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .sortBy('due_date');
    return rows.map(record => ({
      ...record,
      status: record.balance_owed <= 0
        ? 'paid'
        : record.amount_paid > 0
        ? (new Date(record.due_date) < new Date() ? 'overdue' : 'partially_paid')
        : getCreditStatus(record.balance_owed, record.due_date),
    }));
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { credits: credits ?? [], isLoading: credits === undefined };
}

export function useOutstandingCreditsSummary() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async (): Promise<CreditsSummary> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { outstanding_amount: 0, overdue_count: 0 };
    const credits = await db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .toArray();
    const outstanding = credits.filter(record => record.status !== 'paid');
    return {
      outstanding_amount: outstanding.reduce((sum, record) => sum + record.balance_owed, 0),
      overdue_count: outstanding.filter(record => record.status === 'overdue').length,
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { summary: summary ?? { outstanding_amount: 0, overdue_count: 0 }, isLoading: summary === undefined };
}

export function useCreditRecord(id: string) {
  const record = useLiveQuery(() => db.credit_records.get(id), [id]);
  return { record, isLoading: record === undefined };
}

export function buildCreditPayment(amount: number, date: string, method?: PaymentMethod): CreditPayment {
  return { amount, date, method };
}

export function computeCreditFromPayments(
  record: Pick<CreditRecord, 'total_amount' | 'due_date'>,
  payments: CreditPayment[],
): Pick<CreditRecord, 'amount_paid' | 'balance_owed' | 'status'> {
  const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceOwed = Math.max(0, record.total_amount - amountPaid);
  const status =
    balanceOwed <= 0
      ? 'paid'
      : amountPaid > 0
        ? new Date(record.due_date) < new Date()
          ? 'overdue'
          : 'partially_paid'
        : getCreditStatus(balanceOwed, record.due_date);
  return { amount_paid: amountPaid, balance_owed: balanceOwed, status };
}
