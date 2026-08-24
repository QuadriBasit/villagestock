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
import {
  editSalesAllowed,
  editSwapsAllowed,
  financialNavAllowed,
  hasAnyShopPermission,
  inviteTeamAllowed,
  manageBusinessSettingsAllowed,
  manageRolesAllowed,
  normalizeShopPermissions,
  permissionsFromLegacyRole,
  resolveMemberPermissions,
  viewProfitAllowed,
  type ShopPermissionKey,
  type ShopPermissions,
} from '@/lib/shopPermissions';
import type { ShopRole } from '@/types';

export type ShopAccessStatus = 'idle' | 'loading' | 'ready';

export interface ShopAccessValue {
  status: ShopAccessStatus;
  /** Shop owner auth user id — all `user_id` foreign keys in retail data. */
  shopOwnerId: string | null;
  /** Signed-in account (owner, manager, or staff). */
  actorUserId: string | null;
  role: ShopRole;
  /** Display name for the assigned shop role (Owner, Staff, custom role, …). */
  roleName: string;
  roleId: string | null;
  permissions: ShopPermissions;
  /**
   * Null or empty = can work in all branches. Non-empty = only these `shop_locations.id` values.
   * Owners always have null here (full access).
   */
  actorAllowedLocationIds: string[] | null;
  isOwner: boolean;
  canManageBusinessSettings: boolean;
  canInviteTeamMembers: boolean;
  canManageRoles: boolean;
  canViewProfit: boolean;
  canAccessFinancialNav: boolean;
  canEditSales: boolean;
  canEditSwaps: boolean;
  hasPermission: (key: ShopPermissionKey | ShopPermissionKey[]) => boolean;
  refetch: () => void;
}

const defaultPermissions = permissionsFromLegacyRole('owner');

const defaultValue: ShopAccessValue = {
  status: 'idle',
  shopOwnerId: null,
  actorUserId: null,
  role: 'owner',
  roleName: 'Owner',
  roleId: null,
  permissions: defaultPermissions,
  actorAllowedLocationIds: null,
  isOwner: true,
  canViewProfit: true,
  canAccessFinancialNav: true,
  canManageBusinessSettings: true,
  canInviteTeamMembers: true,
  canManageRoles: true,
  canEditSales: true,
  canEditSwaps: true,
  hasPermission: () => true,
  refetch: () => {},
};

const ShopAccessContext = createContext<ShopAccessValue>(defaultValue);

type MemberLookupRow = {
  business_id: string;
  role: string;
  allowed_location_ids: string[] | null;
  role_id: string | null;
  shop_roles: {
    name: string;
    slug: string | null;
    permissions: unknown;
  } | null;
};

function deriveLegacyRole(role: string, slug: string | null): ShopRole {
  if (role === 'owner') return 'owner';
  if (slug === 'manager' || role === 'manager') return 'manager';
  if (slug === 'staff' || role === 'staff') return 'staff';
  return 'staff';
}

function buildCapabilityFlags(
  permissions: ShopPermissions,
  isOwner: boolean,
  branchRestricted: boolean,
) {
  const effective = resolveMemberPermissions({
    isOwner,
    rolePermissions: permissions,
    branchRestricted,
  });
  return {
    permissions: effective,
    canViewProfit: viewProfitAllowed(effective),
    canAccessFinancialNav: financialNavAllowed(effective),
    canManageBusinessSettings: manageBusinessSettingsAllowed(effective),
    canInviteTeamMembers: inviteTeamAllowed(effective),
    canManageRoles: manageRolesAllowed(effective),
    canEditSales: editSalesAllowed(effective),
    canEditSwaps: editSwapsAllowed(effective),
  };
}

export function ShopAccessProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore(s => s.user?.id ?? null);
  const latestUserIdRef = useRef<string | null>(userId);
  latestUserIdRef.current = userId;

  const loadInFlight = useRef(false);
  const loadCoalesceRef = useRef<{ userId: string; promise: Promise<void>; token: symbol } | null>(null);
  const completedForUserIdRef = useRef<string | null>(null);
  const [state, setState] = useState<
    Omit<
      ShopAccessValue,
      | 'refetch'
      | 'canViewProfit'
      | 'canAccessFinancialNav'
      | 'canManageBusinessSettings'
      | 'canInviteTeamMembers'
      | 'canManageRoles'
      | 'canEditSales'
      | 'canEditSwaps'
      | 'hasPermission'
      | 'permissions'
    > & { rolePermissions: unknown }
  >({
    status: 'idle',
    shopOwnerId: null,
    actorUserId: null,
    role: 'owner',
    roleName: 'Owner',
    roleId: null,
    actorAllowedLocationIds: null,
    isOwner: true,
    rolePermissions: permissionsFromLegacyRole('owner'),
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
        roleName: 'Owner',
        roleId: null,
        actorAllowedLocationIds: null,
        isOwner: true,
        rolePermissions: permissionsFromLegacyRole('owner'),
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
          roleName: 'Owner',
          roleId: null,
          actorAllowedLocationIds: null,
          isOwner: true,
          rolePermissions: permissionsFromLegacyRole('owner'),
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
        roleName: string;
        roleId: string | null;
        actorAllowedLocationIds: string[] | null;
        isOwner: boolean;
        rolePermissions: unknown;
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
        roleName: string;
        roleId: string | null;
        actorAllowedLocationIds: string[] | null;
        isOwner: boolean;
        rolePermissions: unknown;
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
          .select('business_id, role, allowed_location_ids, role_id, shop_roles(name, slug, permissions)')
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
            roleName: 'Owner',
            roleId: null,
            actorAllowedLocationIds: null,
            isOwner: true,
            rolePermissions: permissionsFromLegacyRole('owner'),
          });
          return;
        }

        if (!data) {
          await finishWithPatch({
            shopOwnerId: capturedUserId,
            actorUserId: capturedUserId,
            role: 'owner',
            roleName: 'Owner',
            roleId: null,
            actorAllowedLocationIds: null,
            isOwner: true,
            rolePermissions: permissionsFromLegacyRole('owner'),
          });
          return;
        }

        const row = data as MemberLookupRow;
        const isOwner = row.role === 'owner' || row.business_id === capturedUserId;
        const raw = row.allowed_location_ids;
        const actorAllowedLocationIds =
          isOwner ? null : raw && raw.length > 0 ? raw : null;
        const roleName = isOwner
          ? 'Owner'
          : row.shop_roles?.name?.trim() || (row.role === 'manager' ? 'Manager' : row.role === 'staff' ? 'Staff' : 'Team member');
        const rolePermissions = isOwner
          ? permissionsFromLegacyRole('owner')
          : row.shop_roles?.permissions ?? permissionsFromLegacyRole(row.role);
        await finishWithPatch({
          shopOwnerId: row.business_id,
          actorUserId: capturedUserId,
          role: isOwner ? 'owner' : deriveLegacyRole(row.role, row.shop_roles?.slug ?? null),
          roleName,
          roleId: isOwner ? null : row.role_id,
          actorAllowedLocationIds,
          isOwner,
          rolePermissions,
        });
      } catch (e) {
        console.warn('[shop access] business_members network error; using solo-owner fallback', e);
        await finishWithPatch({
          shopOwnerId: capturedUserId,
          actorUserId: capturedUserId,
          role: 'owner',
          roleName: 'Owner',
          roleId: null,
          actorAllowedLocationIds: null,
          isOwner: true,
          rolePermissions: permissionsFromLegacyRole('owner'),
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
    const branchRestricted =
      !state.isOwner &&
      !!state.actorAllowedLocationIds &&
      state.actorAllowedLocationIds.length > 0;
    const rawPermissions = normalizeShopPermissions(state.rolePermissions);
    const caps = buildCapabilityFlags(rawPermissions, state.isOwner, branchRestricted);
    return {
      ...state,
      ...caps,
      hasPermission: (key: ShopPermissionKey | ShopPermissionKey[]) =>
        state.isOwner ? true : hasAnyShopPermission(caps.permissions, key),
      refetch: () => { void load(); },
    };
  }, [state, load]);

  return <ShopAccessContext.Provider value={value}>{children}</ShopAccessContext.Provider>;
}

export function useShopAccess() {
  return useContext(ShopAccessContext);
}

export function ShopSyncEffects() {
  const { shopOwnerId, status, actorUserId } = useShopAccess();

  useEffect(() => {
    if (!actorUserId || status !== 'ready' || !shopOwnerId) return;

    const runInitialPull = async () => {
      const allowed = tryConsumeShopBootstrap(actorUserId, shopOwnerId);
      if (!allowed) return;
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
