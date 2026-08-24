import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { RecurringExpenseRecord } from '@/types';

export function useRecurringExpenses() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const items = useLiveQuery(async (): Promise<RecurringExpenseRecord[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.recurring_expenses
      .where('user_id')
      .equals(shopOwnerId)
      .filter(e => e.location_id === activeLocationId && e.active)
      .toArray();
  }, [shopOwnerId, activeLocationId, locationReady]);

  return {
    items: items ?? [],
    isLoading: items === undefined,
  };
}
