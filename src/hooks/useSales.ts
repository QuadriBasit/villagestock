import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import type { SalesSummary } from '@/types';

// Returns all sales for the current user, newest first
export function useSalesHistory() {
  const { user } = useAuthStore();

  const sales = useLiveQuery(async () => {
    if (!user) return [];
    return db.sales_records
      .where('user_id')
      .equals(user.id)
      .reverse()
      .sortBy('sold_at');
  }, [user?.id]);

  return { sales: sales ?? [], isLoading: sales === undefined };
}

// Returns today's sales summary (count, revenue, profit)
export function useTodaySalesSummary(): { summary: SalesSummary; isLoading: boolean } {
  const { user } = useAuthStore();

  const summary = useLiveQuery(async () => {
    if (!user) return { count: 0, revenue: 0, profit: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sales = await db.sales_records
      .where('user_id')
      .equals(user.id)
      .filter(s => new Date(s.sold_at) >= startOfDay)
      .toArray();

    return {
      count: sales.reduce((acc, s) => acc + s.quantity_sold, 0),
      revenue: sales.reduce((acc, s) => acc + s.sale_price * s.quantity_sold, 0),
      profit: sales.reduce((acc, s) => acc + s.profit, 0),
    };
  }, [user?.id]);

  return { summary: summary ?? { count: 0, revenue: 0, profit: 0 }, isLoading: summary === undefined };
}
