import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useBusinessProfileQuery } from './useBusinessProfileQuery';
import { hasStockAccountabilityPlan, localSessionDateKey, tradingBlockedMessage } from '@/lib/stockSessionUtils';
import type { InventoryItem, StockSession } from '@/types';

type NoUser = '__nouser__';

export function useTodayStockSessionState(): {
  session: StockSession | null | undefined;
  isLoading: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!user) return '__nouser__';
      const row = await db.stock_sessions
        .where('[user_id+date]')
        .equals([user.id, localSessionDateKey()])
        .first();
      return row ?? null;
    },
    [user?.id]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!user };
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
  const user = useAuthStore((s) => s.user);
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!user) return '__nouser__';
      const today = localSessionDateKey();
      const opens = await db.stock_sessions
        .where('user_id')
        .equals(user.id)
        .filter((s) => s.status === 'open')
        .toArray();
      const stale = opens.filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date));
      return stale[0] ?? null;
    },
    [user?.id]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!user };
  }
  if (raw === '__nouser__') {
    return { session: null, isLoading: false };
  }
  return { session: raw, isLoading: false };
}

export function useMissingSerializedItems(): InventoryItem[] {
  const user = useAuthStore((s) => s.user);
  const rows = useLiveQuery(async () => {
    if (!user) return [];
    return db.inventory_items
      .where('user_id')
      .equals(user.id)
      .filter((i) => !i.deleted && i.mode === 'serialized' && i.status === 'missing')
      .toArray();
  }, [user?.id]);
  return rows ?? [];
}

export function useAllStockSessions(): StockSession[] {
  const user = useAuthStore((s) => s.user);
  const rows = useLiveQuery(async () => {
    if (!user) return [];
    return db.stock_sessions.where('user_id').equals(user.id).sortBy('date');
  }, [user?.id]);
  return rows ? [...rows].reverse() : [];
}

export function useStockSessionById(id: string | undefined): {
  session: StockSession | null | undefined;
  isLoading: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const raw = useLiveQuery(
    async (): Promise<NoUser | StockSession | null> => {
      if (!user || !id) return '__nouser__';
      const s = await db.stock_sessions.get(id);
      if (!s || s.user_id !== user.id) return null;
      return s;
    },
    [user?.id, id]
  );

  if (raw === undefined) {
    return { session: undefined, isLoading: !!(user && id) };
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
  const user = useAuthStore((s) => s.user);
  const profileQ = useBusinessProfileQuery(user?.id);
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
