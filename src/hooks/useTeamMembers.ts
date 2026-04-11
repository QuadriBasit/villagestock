import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import type { Database } from '@/types/supabase';

export type TeamMemberRow = Database['public']['Tables']['business_members']['Row'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function functionsInvokeErrorMessage(error: unknown, data: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return String((data as { error: unknown }).error);
  }
  return 'Invite request failed';
}

export function useTeamMembers() {
  const { shopOwnerId, actorUserId, canInviteTeamMembers, canManageBusinessSettings } = useShopAccess();
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!shopOwnerId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('business_members')
      .select('*')
      .eq('business_id', shopOwnerId)
      .order('created_at', { ascending: true });

    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    setMembers((data ?? []) as TeamMemberRow[]);
  }, [shopOwnerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * Sends Supabase Auth invite email; user sets password from link, then `accept_staff_invite` runs in ShopAccessProvider.
   */
  const inviteStaff = useCallback(
    async (params: {
      email: string;
      role: 'manager' | 'staff';
      displayName: string;
      /** Omit or null = all branches */
      allowedLocationIds?: string[] | null;
    }) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canInviteTeamMembers) throw new Error('Only owners and managers can invite team members.');
      const displayName = params.displayName.trim();
      if (!displayName) throw new Error('Name on receipts is required.');
      const email = params.email.trim().toLowerCase();
      if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const session = refreshed.session ?? initialSession;
      if (refreshErr && !session?.access_token) {
        throw new Error('You must be signed in to send invites. Sign in again if your session expired.');
      }
      if (!session?.access_token) {
        throw new Error('You must be signed in to send invites. Sign in again if your session expired.');
      }
      const loc = params.allowedLocationIds;
      const allowed_location_ids =
        loc && loc.length > 0 ? loc : null;

      const { data, error: fnErr } = await supabase.functions.invoke('invite-staff', {
        body: {
          business_id: shopOwnerId,
          email,
          role: params.role,
          display_name: displayName,
          allowed_location_ids,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw new Error(functionsInvokeErrorMessage(fnErr, data));
      if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.member_invited',
        entityType: 'staff_invite',
        entityId: email,
        metadata: { role: params.role, name: displayName },
        actorLabel,
      });
    },
    [shopOwnerId, actorUserId, canInviteTeamMembers]
  );

  /** For accounts that already exist in Auth (no email invite). */
  const addMember = useCallback(
    async (params: {
      memberEmail?: string;
      memberUserId?: string;
      role: 'manager' | 'staff';
      displayName: string;
      allowedLocationIds?: string[] | null;
    }) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canInviteTeamMembers) throw new Error('Only owners and managers can add team members.');
      const display_name = params.displayName.trim();
      if (!display_name) throw new Error('Name on receipts is required.');
      const email = params.memberEmail?.trim() ?? '';
      const rawId = params.memberUserId?.trim() ?? '';
      let id: string;
      if (email) {
        const { data, error: rpcErr } = await supabase.rpc('lookup_shop_teammate_user_id', {
          p_business_id: shopOwnerId,
          p_email: email,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        if (!data) {
          throw new Error(
            'No account found for that email. Send an email invite instead, or check the address.'
          );
        }
        id = data;
      } else if (rawId) {
        if (!UUID_RE.test(rawId)) throw new Error('User ID must be a valid UUID.');
        id = rawId;
      } else {
        throw new Error('Enter their email or user ID.');
      }
      if (id === shopOwnerId) throw new Error('The shop owner is already a member.');
      const loc = params.allowedLocationIds;
      const allowed_location_ids = loc && loc.length > 0 ? loc : null;
      const { error: e } = await supabase.from('business_members').insert({
        business_id: shopOwnerId,
        member_user_id: id,
        role: params.role,
        display_name,
        allowed_location_ids,
      } as never);
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.member_added',
        entityType: 'business_member',
        entityId: id,
        metadata: { role: params.role, name: display_name },
        actorLabel,
      });
      await refetch();
    },
    [shopOwnerId, actorUserId, canInviteTeamMembers, refetch]
  );

  const updateMemberBranchAccess = useCallback(
    async (row: TeamMemberRow, allowedLocationIds: string[] | null) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canManageBusinessSettings) {
        throw new Error(
          'Only the shop owner or a manager with access to all branches can change branch access for teammates.'
        );
      }
      if (row.role === 'owner') throw new Error('Cannot change branch access for the owner.');
      const allowed_location_ids =
        allowedLocationIds && allowedLocationIds.length > 0 ? allowedLocationIds : null;
      const { error: e } = await supabase
        .from('business_members')
        .update({ allowed_location_ids } as never)
        .eq('id', row.id);
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.member_branch_scope_updated',
        entityType: 'business_member',
        entityId: row.member_user_id,
        metadata: { allowed_location_ids },
        actorLabel,
      });
      await refetch();
    },
    [shopOwnerId, actorUserId, canManageBusinessSettings, refetch]
  );

  const removeMember = useCallback(
    async (row: TeamMemberRow) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (row.role === 'owner') throw new Error('Cannot remove the shop owner.');
      if (row.member_user_id === shopOwnerId) throw new Error('Cannot remove the owner account.');
      const { error: e } = await supabase.from('business_members').delete().eq('id', row.id);
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.member_removed',
        entityType: 'business_member',
        entityId: row.member_user_id,
        metadata: { role: row.role },
        actorLabel,
      });
      await refetch();
    },
    [shopOwnerId, actorUserId, refetch]
  );

  return {
    members,
    loading,
    error,
    refetch,
    inviteStaff,
    addMember,
    removeMember,
    updateMemberBranchAccess,
  };
}
