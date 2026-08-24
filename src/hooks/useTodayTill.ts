import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { PaymentMethod } from '@/types';

export function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type TodayTill = {
  openingFloat: number;
  cashSales: number;
  transferSales: number;
  posSales: number;
  cashCollected: number;
  transferCollected: number;
  cashExpenses: number;
  nonCashExpenses: number;
  expected: number;
};

export function useTodayTill(expenses: { amount: number; payment_method: PaymentMethod }[]) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const till = useLiveQuery(async (): Promise<TodayTill | null> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return null;

    const { start, end } = todayRange();
    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        s =>
          s.location_id === activeLocationId &&
          s.sold_at >= start &&
          s.sold_at <= end &&
          s.payment_status === 'paid'
      )
      .toArray();

    const byMethod = (m: PaymentMethod) =>
      sales
        .filter(s => s.payment_method === m)
        .reduce((a, s) => a + s.sale_price * s.quantity_sold, 0);

    const cashSales = byMethod('cash');
    const transferSales = byMethod('bank_transfer');
    const posSales = byMethod('pos');

    let cashCollected = 0;
    let transferCollected = 0;
    const credits = await db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(c => c.location_id === activeLocationId)
      .toArray();
    for (const credit of credits) {
      for (const p of credit.payments) {
        if (p.date >= start && p.date <= end) {
          if (p.method === 'cash') cashCollected += p.amount;
          else if (p.method === 'bank_transfer') transferCollected += p.amount;
        }
      }
    }

    const cashExpenses = expenses
      .filter(e => e.payment_method === 'cash')
      .reduce((a, e) => a + e.amount, 0);
    const nonCashExpenses = expenses
      .filter(e => e.payment_method !== 'cash')
      .reduce((a, e) => a + e.amount, 0);

    const openingFloat = await getSetting<number>('opening_float', 0);

    return {
      openingFloat,
      cashSales,
      transferSales,
      posSales,
      cashCollected,
      transferCollected,
      cashExpenses,
      nonCashExpenses,
      expected: openingFloat + cashSales + cashCollected - cashExpenses,
    };
  }, [shopOwnerId, activeLocationId, locationReady, expenses]);

  return { till: till ?? null, isLoading: till === undefined };
}
