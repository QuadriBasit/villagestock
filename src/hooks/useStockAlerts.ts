import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { computeStockAlerts, type StockAlertsBundle } from '@/lib/stockAlerts';

const EMPTY: StockAlertsBundle = {
  lowStock: [],
  outOfStock: [],
  lastUnits: [],
  total: 0,
};

export function useStockAlerts() {
  const { user } = useAuthStore();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const alerts = useLiveQuery(async () => {
    if (!user || !shopOwnerId || !locationReady || !activeLocationId) return null;
    const items = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(i => !i.deleted && i.location_id === activeLocationId)
      .toArray();
    return computeStockAlerts(items);
  }, [user?.id, shopOwnerId, activeLocationId, locationReady]);

  return {
    alerts: alerts ?? EMPTY,
    isLoading: alerts === undefined,
  };
}
