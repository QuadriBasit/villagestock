import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfileQuery } from './useBusinessProfileQuery';
import { hasStockAccountabilityPlan, localSessionDateKey, tradingBlockedMessage } from '@/lib/stockSessionUtils';
import type { InventoryItem, StockSession } from '@/types';

type NoUser = '__nouser__';

export function useTodayStockSessionState(): {
  session: StockSession | null | undefined;
  isLoading: boolean;
} {
  const { shopOwnerId } = useShopAccess();
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!shopOwnerId) return '__nouser__';
      const row = await db.stock_sessions
        .where('[user_id+date]')
        .equals([shopOwnerId, localSessionDateKey()])
        .first();
      return row ?? null;
    },
    [shopOwnerId]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!shopOwnerId };
  }
  if (raw === '__nouser__') {
    return { session: null, isLoading: false };
  }
  return { session: raw, isLoading: false };
}

export function usePriorOpenStockSessionState(): {
  session: StockSession | null | undefined;
  isLoading: boolean;
} {
  const { shopOwnerId } = useShopAccess();
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!shopOwnerId) return '__nouser__';
      const today = localSessionDateKey();
      const opens = await db.stock_sessions
        .where('user_id')
        .equals(shopOwnerId)
        .filter((s) => s.status === 'open')
        .toArray();
      const stale = opens.filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date));
      return stale[0] ?? null;
    },
    [shopOwnerId]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!shopOwnerId };
  }
  if (raw === '__nouser__') {
    return { session: null, isLoading: false };
  }
  return { session: raw, isLoading: false };
}

export function useMissingSerializedItems(): InventoryItem[] {
  const { shopOwnerId } = useShopAccess();
  const rows = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    return db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter((i) => !i.deleted && i.mode === 'serialized' && i.status === 'missing')
      .toArray();
  }, [shopOwnerId]);
  return rows ?? [];
}

export function useAllStockSessions(): StockSession[] {
  const { shopOwnerId } = useShopAccess();
  const rows = useLiveQuery(async () => {
    if (!shopOwnerId) return [];
    return db.stock_sessions.where('user_id').equals(shopOwnerId).sortBy('date');
  }, [shopOwnerId]);
  return rows ? [...rows].reverse() : [];
}

export function useStockSessionById(id: string | undefined): {
  session: StockSession | null | undefined;
  isLoading: boolean;
} {
  const { shopOwnerId } = useShopAccess();
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!shopOwnerId || !id) return '__nouser__';
      const s = await db.stock_sessions.get(id);
      if (!s || s.user_id !== shopOwnerId) return null;
      return s;
    },
    [shopOwnerId, id]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!(shopOwnerId && id) };
  }
  if (raw === '__nouser__') {
    return { session: null, isLoading: false };
  }
  return { session: raw, isLoading: false };
}

/** Business plan: must have an open session for today before trading mutations. */
export function useTradingGateState(): {
  isReady: boolean;
  gateApplies: boolean;
  tradingBlocked: boolean;
  message: string;
  todaySession: StockSession | null | undefined;
} {
  const { shopOwnerId } = useShopAccess();
  const profileQ = useBusinessProfileQuery(shopOwnerId ?? undefined);
  const { session: todaySession, isLoading } = useTodayStockSessionState();

  const isReady = profileQ.status === 'ready' && !isLoading;
  const gateApplies =
    profileQ.status === 'ready' && profileQ.profile != null && hasStockAccountabilityPlan(profileQ.profile);
  const tradingBlocked =
    gateApplies && (todaySession == null || todaySession.status !== 'open');

  return {
    isReady,
    gateApplies,
    tradingBlocked,
    message: tradingBlockedMessage,
    todaySession: todaySession ?? null,
  };
}
