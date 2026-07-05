import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { effectiveCreditStatus } from '@/lib/creditUtils';
import type { CreditsSummary } from '@/types';

export { getCreditStatus, buildCreditPayment, computeCreditFromPayments, effectiveCreditStatus } from '@/lib/creditUtils';

export function useCredits() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const credits = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return [];
    const rows = await db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .sortBy('due_date');
    return rows.map(record => ({
      ...record,
      status: effectiveCreditStatus(record),
    }));
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { credits: credits ?? [], isLoading: credits === undefined };
}

export function useOutstandingCreditsSummary() {
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  const summary = useLiveQuery(async (): Promise<CreditsSummary> => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return { outstanding_amount: 0, overdue_count: 0 };
    const credits = await db.credit_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(r => r.location_id === activeLocationId)
      .toArray();
    const outstanding = credits.filter(record => record.balance_owed > 0);
    return {
      outstanding_amount: outstanding.reduce((sum, record) => sum + record.balance_owed, 0),
      overdue_count: outstanding.filter(record => effectiveCreditStatus(record) === 'overdue').length,
    };
  }, [shopOwnerId, activeLocationId, locationReady]);

  return { summary: summary ?? { outstanding_amount: 0, overdue_count: 0 }, isLoading: summary === undefined };
}

export function useCreditRecord(id: string) {
  const { shopOwnerId } = useShopAccess();
  const record = useLiveQuery(async () => {
    const row = await db.credit_records.get(id);
    if (!row || !shopOwnerId || row.user_id !== shopOwnerId) return undefined;
    return { ...row, status: effectiveCreditStatus(row) };
  }, [id, shopOwnerId]);
  return { record, isLoading: record === undefined };
}
