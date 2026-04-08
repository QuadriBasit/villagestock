import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import type { ReturnsSummary } from '@/types';

// All returns for the current user, newest first
export function useReturnsHistory() {
  const { user } = useAuthStore();

  const returns = useLiveQuery(async () => {
    if (!user) return [];
    return db.return_records
      .where('user_id')
      .equals(user.id)
      .reverse()
      .sortBy('returned_at');
  }, [user?.id]);

  return { returns: returns ?? [], isLoading: returns === undefined };
}

// Today's returns summary
export function useTodayReturnsSummary(): { summary: ReturnsSummary; isLoading: boolean } {
  const { user } = useAuthStore();

  const summary = useLiveQuery(async () => {
    if (!user) return { count: 0, refund_value: 0 };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const records = await db.return_records
      .where('user_id')
      .equals(user.id)
      .filter(r => new Date(r.returned_at) >= startOfDay)
      .toArray();

    return {
      count: records.length,
      refund_value: records.reduce((acc, r) => acc + r.refund_amount, 0),
    };
  }, [user?.id]);

  return { summary: summary ?? { count: 0, refund_value: 0 }, isLoading: summary === undefined };
}
