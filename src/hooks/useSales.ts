import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { SalesSummary } from '@/types';

// Returns all sales for the current user, newest first
export function useSalesHistory() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const sales = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter((s) => s.location_id === activeLocationId)
      .reverse()
      .sortBy('sold_at');
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { sales: sales ?? [], isLoading: sales === undefined };
}

// Returns today's sales summary (count, revenue, profit)
export function useTodaySalesSummary(): { summary: SalesSummary; isLoading: boolean } {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { count: 0, revenue: 0, profit: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        s => new Date(s.sold_at) >= startOfDay && s.location_id === activeLocationId
      )
      .toArray();

    return {
      count: sales.reduce((acc, s) => acc + s.quantity_sold, 0),
      revenue: sales.reduce((acc, s) => acc + s.sale_price * s.quantity_sold, 0),
      profit: sales.reduce((acc, s) => acc + s.profit, 0),
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { summary: summary ?? { count: 0, revenue: 0, profit: 0 }, isLoading: summary === undefined };
}
