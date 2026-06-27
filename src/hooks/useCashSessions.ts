import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { CashSessionInput, CashSessionRecord } from '@/types';

export function useCashSessions() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const sessions = useLiveQuery(async (): Promise<CashSessionRecord[]> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    return db.cash_sessions
      .where('user_id')
      .equals(shopOwnerId)
      .filter(s => s.location_id === activeLocationId)
      .reverse()
      .sortBy('closed_at');
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { sessions: sessions ?? [], isLoading: sessions === undefined };
}

export function useCashSessionActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function closeCashDay(input: CashSessionInput): Promise<CashSessionRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    const record: CashSessionRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      closed_at: new Date().toISOString(),
      closed_by_label: input.closed_by_label ?? actorLabel,
    };

    await db.cash_sessions.add(record);

    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'cashup.closed',
      entityType: 'cash_session',
      entityId: record.id,
      metadata: {
        expected: record.expected,
        counted: record.counted,
        variance: record.variance,
      },
      actorLabel,
    });

    return record;
  }

  return { closeCashDay };
}
