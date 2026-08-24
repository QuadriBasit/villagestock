import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import {
  emptyShopPermissions,
  normalizeShopPermissions,
  type ShopPermissions,
  type ShopRoleRecord,
} from '@/lib/shopPermissions';

function mapRoleRow(row: Record<string, unknown>): ShopRoleRecord {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    name: String(row.name),
    slug: row.slug == null ? null : String(row.slug),
    description: row.description == null ? null : String(row.description),
    permissions: normalizeShopPermissions(row.permissions),
    is_system: row.is_system === true,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    created_at: String(row.created_at),
  };
}

export function useShopRoles() {
  const { shopOwnerId, actorUserId, canManageRoles } = useShopAccess();
  const [roles, setRoles] = useState<ShopRoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!shopOwnerId) {
      setRoles([]);
      return;
    }
    setLoading(true);
    setError(null);
    await supabase.rpc('ensure_default_shop_roles', { p_business_id: shopOwnerId });
    const { data, error: e } = await supabase
      .from('shop_roles')
      .select('*')
      .eq('business_id', shopOwnerId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    setRoles((data ?? []).map(row => mapRoleRow(row as Record<string, unknown>)));
  }, [shopOwnerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createRole = useCallback(
    async (params: { name: string; description?: string; permissions: ShopPermissions }) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canManageRoles) throw new Error('You do not have permission to manage roles.');
      const name = params.name.trim();
      if (!name) throw new Error('Role name is required.');
      const maxSort = roles.reduce((max, role) => Math.max(max, role.sort_order), 0);
      const { data, error: e } = await supabase
        .from('shop_roles')
        .insert({
          business_id: shopOwnerId,
          name,
          description: params.description?.trim() || null,
          permissions: params.permissions,
          is_system: false,
          sort_order: maxSort + 10,
        } as never)
        .select('*')
        .single();
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.role_created',
        entityType: 'shop_role',
        entityId: String((data as { id: string }).id),
        metadata: { name },
        actorLabel,
      });
      await refetch();
      return mapRoleRow(data as Record<string, unknown>);
    },
    [shopOwnerId, actorUserId, canManageRoles, roles, refetch],
  );

  const updateRole = useCallback(
    async (
      role: ShopRoleRecord,
      patch: { name?: string; description?: string | null; permissions?: ShopPermissions },
    ) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canManageRoles) throw new Error('You do not have permission to manage roles.');
      const nextName = patch.name?.trim() ?? role.name;
      if (!nextName.trim()) throw new Error('Role name is required.');
      const { error: e } = await supabase
        .from('shop_roles')
        .update({
          name: nextName,
          description: patch.description === undefined ? role.description : patch.description,
          permissions: patch.permissions ?? role.permissions,
        } as never)
        .eq('id', role.id)
        .eq('business_id', shopOwnerId);
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.role_updated',
        entityType: 'shop_role',
        entityId: role.id,
        metadata: { name: nextName },
        actorLabel,
      });
      await refetch();
    },
    [shopOwnerId, actorUserId, canManageRoles, refetch],
  );

  const deleteRole = useCallback(
    async (role: ShopRoleRecord) => {
      if (!shopOwnerId || !actorUserId) throw new Error('Not authenticated');
      if (!canManageRoles) throw new Error('You do not have permission to manage roles.');
      if (role.is_system) throw new Error('Built-in roles cannot be deleted. Edit their permissions instead.');
      const { error: e } = await supabase
        .from('shop_roles')
        .delete()
        .eq('id', role.id)
        .eq('business_id', shopOwnerId);
      if (e) throw new Error(e.message);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'team.role_deleted',
        entityType: 'shop_role',
        entityId: role.id,
        metadata: { name: role.name },
        actorLabel,
      });
      await refetch();
    },
    [shopOwnerId, actorUserId, canManageRoles, refetch],
  );

  const duplicateRole = useCallback(
    async (role: ShopRoleRecord) => {
      const baseName = `${role.name} copy`;
      let name = baseName;
      let n = 2;
      while (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        name = `${baseName} ${n}`;
        n += 1;
      }
      return createRole({
        name,
        description: role.description ?? undefined,
        permissions: { ...role.permissions },
      });
    },
    [createRole, roles],
  );

  return {
    roles,
    loading,
    error,
    refetch,
    createRole,
    updateRole,
    deleteRole,
    duplicateRole,
    emptyPermissions: emptyShopPermissions,
  };
}
