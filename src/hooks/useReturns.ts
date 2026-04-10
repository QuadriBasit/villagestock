import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { ReturnsSummary } from '@/types';

// All returns for the current user, newest first
export function useReturnsHistory() {
  const { shopOwnerId } = useShopAccess();

  const returns = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    return db.return_records
      .where('user_id')
      .equals(shopOwnerId)
      .reverse()
      .sortBy('returned_at');
  }, [shopOwnerId]);

  return { returns: returns ?? [], isLoading: returns === undefined };
}

// Today's returns summary
export function useTodayReturnsSummary(): { summary: ReturnsSummary; isLoading: boolean } {
  const { shopOwnerId } = useShopAccess();

  const summary = useLiveQuery(async () => {
    if (!shopOwnerId) return { count: 0, refund_value: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const records = await db.return_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => new Date(r.returned_at) >= startOfDay)
      .toArray();

    return {
      count: records.length,
      refund_value: records.reduce((acc, r) => acc + r.refund_amount, 0),
    };
  }, [shopOwnerId]);

  return { summary: summary ?? { count: 0, refund_value: 0 }, isLoading: summary === undefined };
}
