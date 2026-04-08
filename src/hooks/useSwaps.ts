import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';

export function useTodaySwapSummary() {
  const { user } = useAuthStore();

  const summary = useLiveQuery(async () => {
    if (!user) return { count: 0, tradeInValue: 0, averageBalance: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const swaps = await db.swap_records
      .where('user_id')
      .equals(user.id)
      .filter((swap) => new Date(swap.date) >= startOfDay)
      .toArray();

    const totalBalance = swaps.reduce((sum, swap) => sum + swap.balance_paid, 0);
    const tradeInValue = swaps.reduce((sum, swap) => sum + swap.trade_in_value, 0);

    return {
      count: swaps.length,
      tradeInValue,
      averageBalance: swaps.length > 0 ? totalBalance / swaps.length : 0,
    };
  }, [user?.id]);

  return {
    summary: summary ?? { count: 0, tradeInValue: 0, averageBalance: 0 },
    isLoading: summary === undefined,
  };
}
