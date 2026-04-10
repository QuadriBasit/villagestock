import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { AuditEvent } from '@/types';

export function useAuditEvents(limit = 200): { events: AuditEvent[]; isLoading: boolean } {
  const { shopOwnerId } = useShopAccess();

  const rows = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    const all = await db.audit_events.where('business_id').equals(shopOwnerId).toArray();
    all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return all.slice(0, limit);
  }, [shopOwnerId, limit]);

  return { events: rows ?? [], isLoading: rows === undefined };
}
