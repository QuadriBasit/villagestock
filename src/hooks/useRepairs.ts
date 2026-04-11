import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import type { RepairsSummary } from '@/types';

const ACTIVE_STATUSES = new Set(['sent', 'in_progress', 'completed']);

export function useRepairs() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const repairs = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.repair_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .sortBy('date_sent');
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { repairs: repairs ?? [], isLoading: repairs === undefined };
}

export function useActiveRepairs() {
  const { repairs, isLoading } = useRepairs();
  return {
    repairs: repairs.filter(record => ACTIVE_STATUSES.has(record.repair_status)),
    isLoading,
  };
}

export function useActiveRepairsSummary() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async (): Promise<RepairsSummary> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { active_count: 0, overdue_count: 0 };
    const repairs = await db.repair_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .toArray();
    const active = repairs.filter(record => ACTIVE_STATUSES.has(record.repair_status));
    const now = new Date();
    return {
      active_count: active.length,
      overdue_count: active.filter(record => record.expected_return_date && new Date(record.expected_return_date) < now).length,
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { summary: summary ?? { active_count: 0, overdue_count: 0 }, isLoading: summary === undefined };
}

export function useEngineerNames() {
  const { repairs } = useRepairs();
  return [...new Set(repairs.map(record => record.engineer_name).filter(Boolean))];
}
