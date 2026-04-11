import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';

export function useTodaySwapSummary() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { count: 0, tradeInValue: 0, averageBalance: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const swaps = await db.swap_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        (swap) => new Date(swap.date) >= startOfDay && swap.location_id === activeLocationId
      )
      .toArray();

    const totalBalance = swaps.reduce((sum, swap) => sum + swap.balance_paid, 0);
    const tradeInValue = swaps.reduce((sum, swap) => sum + swap.trade_in_value, 0);

    return {
      count: swaps.length,
      tradeInValue,
      averageBalance: swaps.length > 0 ? totalBalance / swaps.length : 0,
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return {
    summary: summary ?? { count: 0, tradeInValue: 0, averageBalance: 0 },
    isLoading: summary === undefined,
  };
}
