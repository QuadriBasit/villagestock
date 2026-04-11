import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { ReturnsSummary } from '@/types';

// All returns for the current user, newest first
export function useReturnsHistory() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const returns = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.return_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .reverse()
      .sortBy('returned_at');
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { returns: returns ?? [], isLoading: returns === undefined };
}

// Today's returns summary
export function useTodayReturnsSummary(): { summary: ReturnsSummary; isLoading: boolean } {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { count: 0, refund_value: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const records = await db.return_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        r => new Date(r.returned_at) >= startOfDay && r.location_id === activeLocationId
      )
      .toArray();

    return {
      count: records.length,
      refund_value: records.reduce((acc, r) => acc + r.refund_amount, 0),
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { summary: summary ?? { count: 0, refund_value: 0 }, isLoading: summary === undefined };
}
