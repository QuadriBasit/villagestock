import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { getMoneyPeriodRange, recurringCostInRange, type MoneyPeriod } from '@/lib/moneyPeriods';
import type { ExpenseRecord, RecurringExpenseRecord } from '@/types';

export type MoneyOverview = {
  rangeLabel: string;
  revenue: number;
  loggedExpenses: number;
  recurringEstimate: number;
  totalCosts: number;
  net: number;
  expenses: ExpenseRecord[];
};

export function useMoneyOverview(period: MoneyPeriod) {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const range = getMoneyPeriodRange(period);

  const overview = useLiveQuery(async (): Promise<MoneyOverview | null> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return null;

    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();

    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        s =>
          s.location_id === activeLocationId &&
          s.sold_at >= startIso &&
          s.sold_at <= endIso &&
          s.payment_status === 'paid' &&
          !s.returned,
      )
      .toArray();

    const revenue = sales.reduce((sum, s) => sum + s.sale_price * s.quantity_sold, 0);

    const expenses = await db.expense_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        e =>
          e.location_id === activeLocationId &&
          e.recorded_at >= startIso &&
          e.recorded_at <= endIso,
      )
      .toArray();

    const loggedExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const recurring = await db.recurring_expenses
      .where('user_id')
      .equals(shopOwnerId)
      .filter((e: RecurringExpenseRecord) => e.location_id === activeLocationId && e.active)
      .toArray();

    const recurringEstimate = recurring.reduce(
      (sum, item) => sum + recurringCostInRange(item.amount, item.recurrence, range.start, range.end),
      0,
    );

    const totalCosts = loggedExpenses + recurringEstimate;
    const net = revenue - totalCosts;

    return {
      rangeLabel: range.label,
      revenue,
      loggedExpenses,
      recurringEstimate,
      totalCosts,
      net,
      expenses,
    };
  }, [shopOwnerId, activeLocationId, locationReady, period, range.start.getTime(), range.end.getTime()]);

  return {
    overview: overview ?? null,
    isLoading: overview === undefined,
  };
}
