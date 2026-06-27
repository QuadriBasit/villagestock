import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { PurchaseRecord } from '@/types';

export function usePurchases() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const purchases = useLiveQuery(async (): Promise<PurchaseRecord[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.purchase_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(p => p.location_id === activeLocationId)
      .reverse()
      .sortBy('purchased_at');
  }, [shopOwnerId, activeLocationId, locationReady]);

  const supplierDebt = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return 0;
    const suppliers = await db.contacts
      .where('user_id')
      .equals(shopOwnerId)
      .filter(c => c.type === 'supplier' && (c.location_id === activeLocationId || !c.location_id))
      .toArray();
    return suppliers.reduce((s, c) => s + c.balance_owed, 0);
  }, [shopOwnerId, activeLocationId, locationReady]);

  return {
    purchases: purchases ?? [],
    supplierDebt: supplierDebt ?? 0,
    isLoading: purchases === undefined,
  };
}
