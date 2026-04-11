import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { ShopLocation } from '@/types';

export interface ShopLocationValue {
  locations: ShopLocation[];
  activeLocationId: string | null;
  setActiveLocationId: (id: string) => void;
  /** True when a branch is selected and rows exist (after sync/bootstrap). */
  ready: boolean;
}

const Ctx = createContext<ShopLocationValue | null>(null);

function storageKey(businessId: string) {
  return `vs_active_location_${businessId}`;
}

export function ShopLocationProvider({ children }: { children: ReactNode }) {
  const { shopOwnerId, status, actorAllowedLocationIds } = useShopAccess();
  const [activeLocationId, setActiveState] = useState<string | null>(null);

  const locations = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    const all = await db.shop_locations.where('business_id').equals(shopOwnerId).sortBy('sort_order');
    const allow = actorAllowedLocationIds;
    if (allow && allow.length > 0) {
      const set = new Set(allow);
      return all.filter(l => set.has(l.id));
    }
    return all;
  }, [shopOwnerId, actorAllowedLocationIds]);

  useEffect(() => {
    if (status !== 'ready' || !shopOwnerId) {
      setActiveState(null);
      return;
    }
    const list = locations ?? [];
    if (!list.length) {
      setActiveState(null);
      return;
    }
    const key = storageKey(shopOwnerId);
    const stored = localStorage.getItem(key);
    const valid = stored && list.some(l => l.id === stored);
    if (valid) {
      setActiveState(stored);
      return;
    }
    const first = list[0].id;
    setActiveState(first);
    localStorage.setItem(key, first);
  }, [status, shopOwnerId, locations]);

  const setActiveLocationId = useCallback(
    (id: string) => {
      if (!shopOwnerId) return;
      setActiveState(id);
      localStorage.setItem(storageKey(shopOwnerId), id);
    },
    [shopOwnerId]
  );

  const ready = !!(shopOwnerId && locations && locations.length > 0 && activeLocationId);

  const value = useMemo<ShopLocationValue>(
    () => ({
      locations: locations ?? [],
      activeLocationId,
      setActiveLocationId,
      ready,
    }),
    [locations, activeLocationId, setActiveLocationId, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShopLocation(): ShopLocationValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useShopLocation must be used within ShopLocationProvider');
  }
  return v;
}
