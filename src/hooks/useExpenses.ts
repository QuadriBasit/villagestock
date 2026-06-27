import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { ExpenseRecord, PaymentMethod } from '@/types';

function startOfDayIso(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDayIso(d = new Date()): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export function useTodayExpenses() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const expenses = useLiveQuery(async (): Promise<ExpenseRecord[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const start = startOfDayIso();
    const end = endOfDayIso();
    return db.expense_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        e =>
          e.location_id === activeLocationId &&
          e.recorded_at >= start &&
          e.recorded_at <= end
      )
      .toArray();
  }, [shopOwnerId, activeLocationId, locationReady]);

  const summary = useLiveQuery(async () => {
    const rows = expenses ?? [];
    const byMethod = (m: PaymentMethod) =>
      rows.filter(e => e.payment_method === m).reduce((s, e) => s + e.amount, 0);
    return {
      total: rows.reduce((s, e) => s + e.amount, 0),
      cash: byMethod('cash'),
      transfer: byMethod('bank_transfer'),
      pos: byMethod('pos'),
      count: rows.length,
    };
  }, [expenses]);

  return {
    expenses: expenses ?? [],
    summary: summary ?? { total: 0, cash: 0, transfer: 0, pos: 0, count: 0 },
    isLoading: expenses === undefined,
  };
}
