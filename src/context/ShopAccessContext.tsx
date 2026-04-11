import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import {
  flushSyncQueue,
  pullAllRemoteShopData,
  pullAllRemoteShopDataIfStale,
  pullRemoteBusinessProfile,
  resetShopBootstrapDedupe,
  subscribeShopRemoteChanges,
  tryConsumeShopBootstrap,
} from '@/lib/sync';
import type { ShopRole } from '@/types';

export type ShopAccessStatus = 'idle' | 'loading' | 'ready';

export interface ShopAccessValue {
  status: ShopAccessStatus;
  /** Shop owner auth user id — all `user_id` foreign keys in retail data. */
  shopOwnerId: string | null;
  /** Signed-in account (owner, manager, or staff). */
  actorUserId: string | null;
  role: ShopRole;
  /**
   * Null or empty = can work in all branches. Non-empty = only these `shop_locations.id` values.
   * Owners always have null here (full access).
   */
  actorAllowedLocationIds: string[] | null;
  /** Shop-wide settings (profile, branches, billing) — not branch-only managers. */
  canManageBusinessSettings: boolean;
  /** Invite or add teammates (owners and all managers, including branch-scoped). */
  canInviteTeamMembers: boolean;
  canViewProfit: boolean;
  canAccessFinancialNav: boolean;
  refetch: () => void;
}

const defaultValue: ShopAccessValue = {
  status: 'idle',
  shopOwnerId: null,
  actorUserId: null,
  role: 'owner',
  actorAllowedLocationIds: null,
  canViewProfit: true,
  canAccessFinancialNav: true,
  canManageBusinessSettings: true,
  canInviteTeamMembers: true,
  refetch: () => {},
};

const ShopAccessContext = createContext<ShopAccessValue>(defaultValue);

export function ShopAccessProvider({ children }: { children: ReactNode }) {
  /** Use stable id only — `user` from Supabase is a new object on every auth event / token refresh. */
  const userId = useAuthStore(s => s.user?.id ?? null);
  const latestUserIdRef = useRef<string | null>(userId);
  latestUserIdRef.current = userId;

  const loadInFlight = useRef(false);
  const loadCoalesceRef = useRef<{ userId: string; promise: Promise<void>; token: symbol } | null>(null);
  /** After first successful `business_members` resolution for this login — do not flip `loading` again (avoids unmounting the whole app on every auth heartbeat → request storm). */
  const completedForUserIdRef = useRef<string | null>(null);
  const [state, setState] = useState<
    Omit<
      ShopAccessValue,
      | 'refetch'
      | 'canViewProfit'
      | 'canAccessFinancialNav'
      | 'canManageBusinessSettings'
      | 'canInviteTeamMembers'
    >
  >({
    status: 'idle',
    shopOwnerId: null,
    actorUserId: null,
    role: 'owner',
    actorAllowedLocationIds: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      resetShopBootstrapDedupe();
      completedForUserIdRef.current = null;
      loadCoalesceRef.current = null;
      setState({
        status: 'idle',
        shopOwnerId: null,
        actorUserId: null,
        role: 'owner',
        actorAllowedLocationIds: null,
      });
      return;
    }

    const coalesced = loadCoalesceRef.current;
    if (coalesced?.userId === userId) {
      await coalesced.promise;
      return;
    }

    const capturedUserId = userId;
    const coalesceToken = Symbol('shopAccessLoad');

    const loadPromise = (async () => {
      loadInFlight.current = true;

      /** Owner invite: accept before `business_members` lookup so staff are not treated as solo owners. */
      try {
        const { data: sessionData } = await supabase.auth.getUser();
        const u = sessionData?.user;
        if (u?.id === capturedUserId) {
          const rawToken = u.user_metadata?.staff_invite_token;
          const tokenStr = typeof rawToken === 'string' ? rawToken.trim() : '';
          if (tokenStr) {
            const { error: accErr } = await supabase.rpc('accept_staff_invite', { p_token: tokenStr });
            if (!accErr) {
              await supabase.auth.updateUser({ data: { staff_invite_token: null } });
            } else {
              console.warn('[shop access] accept_staff_invite', accErr.message);
              const msg = accErr.message ?? '';
              if (
                msg.includes('Invalid or expired') ||
                msg.includes('same email') ||
                msg.includes('no email')
              ) {
                await supabase.auth.updateUser({ data: { staff_invite_token: null } });
              }
            }
          }
        }
      } catch (e) {
        console.warn('[shop access] staff invite accept step', e);
      }

      const firstResolveForSession = completedForUserIdRef.current !== capturedUserId;
      if (firstResolveForSession && latestUserIdRef.current === capturedUserId) {
        setState({
          status: 'loading',
          shopOwnerId: null,
          actorUserId: capturedUserId,
          role: 'owner',
          actorAllowedLocationIds: null,
        });
      }

      const markResolved = () => {
        if (latestUserIdRef.current === capturedUserId) {
          completedForUserIdRef.current = capturedUserId;
        }
      };

      const applyReady = (patch: {
        shopOwnerId: string;
        actorUserId: string;
        role: ShopRole;
        actorAllowedLocationIds: string[] | null;
      }) => {
        if (latestUserIdRef.current !== capturedUserId) return;
        setState({
          status: 'ready',
          ...patch,
        });
      };

      const finishWithPatch = async (patch: {
        shopOwnerId: string;
        actorUserId: string;
        role: ShopRole;
        actorAllowedLocationIds: string[] | null;
      }) => {
        try {
          await pullRemoteBusinessProfile(patch.shopOwnerId);
        } catch (bpErr) {
          console.warn('[shop access] pullRemoteBusinessProfile failed', bpErr);
        }
        markResolved();
        applyReady(patch);
      };

      try {
        const { data, error } = await supabase
          .from('business_members')
          .select('business_id, role, allowed_location_ids')
          .eq('member_user_id', capturedUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('[shop access] business_members lookup failed; using solo-owner fallback', error);
          await finishWithPatch({
            shopOwnerId: capturedUserId,
            actorUserId: capturedUserId,
            role: 'owner',
            actorAllowedLocationIds: null,
          });
          return;
        }

        if (!data) {
          await finishWithPatch({
            shopOwnerId: capturedUserId,
            actorUserId: capturedUserId,
            role: 'owner',
            actorAllowedLocationIds: null,
          });
          return;
        }

        const role = data.role as ShopRole;
        const raw = data.allowed_location_ids as string[] | null | undefined;
        const actorAllowedLocationIds =
          raw && raw.length > 0 ? raw : null;
        await finishWithPatch({
          shopOwnerId: data.business_id,
          actorUserId: capturedUserId,
          role: role === 'manager' || role === 'staff' ? role : 'owner',
          actorAllowedLocationIds: role === 'owner' ? null : actorAllowedLocationIds,
        });
      } catch (e) {
        console.warn('[shop access] business_members network error; using solo-owner fallback', e);
        await finishWithPatch({
          shopOwnerId: capturedUserId,
          actorUserId: capturedUserId,
          role: 'owner',
          actorAllowedLocationIds: null,
        });
      } finally {
        loadInFlight.current = false;
        const cur = loadCoalesceRef.current;
        if (cur?.token === coalesceToken) loadCoalesceRef.current = null;
      }
    })();

    loadCoalesceRef.current = { userId: capturedUserId, promise: loadPromise, token: coalesceToken };
    await loadPromise;
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<ShopAccessValue>(() => {
    const role = state.role;
    const staffLike = role === 'staff';
    const branchRestrictedManager =
      role === 'manager' &&
      !!state.actorAllowedLocationIds &&
      state.actorAllowedLocationIds.length > 0;
    return {
      ...state,
      canViewProfit: !staffLike,
      canAccessFinancialNav: !staffLike,
      canManageBusinessSettings:
        role === 'owner' || (role === 'manager' && !branchRestrictedManager),
      canInviteTeamMembers: role === 'owner' || role === 'manager',
      refetch: () => { void load(); },
    };
  }, [state, load]);

  return <ShopAccessContext.Provider value={value}>{children}</ShopAccessContext.Provider>;
}

export function useShopAccess() {
  return useContext(ShopAccessContext);
}

/**
 * Sync + Realtime. Initial full pull is module-deduped (`tryConsumeShopBootstrap`) so remounts / effect
 * churn cannot spam Supabase; sign-out clears the set via `resetShopBootstrapDedupe`.
 */
export function ShopSyncEffects() {
  const { shopOwnerId, status, actorUserId } = useShopAccess();

  useEffect(() => {
    if (!actorUserId || status !== 'ready' || !shopOwnerId) return;

    const runInitialPull = async () => {
      if (!tryConsumeShopBootstrap(actorUserId, shopOwnerId)) return;
      try {
        await flushSyncQueue();
      } catch (err) {
        console.error('[sync] flush failed', err);
      }
      await pullAllRemoteShopData(shopOwnerId);
    };

    const syncAfterReconnect = async () => {
      try {
        await flushSyncQueue();
      } catch (err) {
        console.error('[sync] flush failed', err);
      }
      await pullAllRemoteShopDataIfStale(shopOwnerId, 25_000);
    };

    const onOnline = () => {
      void syncAfterReconnect();
    };

    void runInitialPull();

    window.addEventListener('online', onOnline);
    const unsubscribeRealtime = subscribeShopRemoteChanges(shopOwnerId);

    return () => {
      window.removeEventListener('online', onOnline);
      unsubscribeRealtime();
    };
  }, [actorUserId, shopOwnerId, status]);

  return null;
}
