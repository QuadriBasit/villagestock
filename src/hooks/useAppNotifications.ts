import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { computeAppNotifications, type AppNotification } from '@/lib/appNotifications';

const EMPTY: AppNotification[] = [];

export function useAppNotifications(previewLimit = 8) {
  const { user } = useAuthStore();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, locations, ready: locationReady } = useShopLocation();

  const locationName = locations.find(l => l.id === activeLocationId)?.name ?? 'Shop';

  const result = useLiveQuery(async () => {
    if (!user || !shopOwnerId || !locationReady || !activeLocationId) return null;
    return computeAppNotifications(shopOwnerId, activeLocationId, locationName, previewLimit);
  }, [user?.id, shopOwnerId, activeLocationId, locationReady, locationName, previewLimit]);

  return {
    preview: result?.preview ?? EMPTY,
    total: result?.total ?? 0,
    isLoading: result === undefined,
  };
}
