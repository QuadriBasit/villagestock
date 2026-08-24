import { Loader2, Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { useShopRoles } from '@/hooks/useShopRoles';
import { RoleAccordionItem } from '@/components/settings/RoleAccordionItem';
import { settingsBtnOutline, settingsBtnPrimary } from '@/components/settings/settingsUi';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ShopRoleRecord } from '@/lib/shopPermissions';

type ShopRolesPanelProps = {
  fieldClass: string;
  labelClass: string;
};

export function ShopRolesPanel({ fieldClass, labelClass }: ShopRolesPanelProps) {
  const rolesApi = useShopRoles();
  const [creating, setCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

  const toggleRole = (roleId: string) => {
    setOpenRoleId(current => (current === roleId ? null : roleId));
  };

  const createRole = async () => {
    setSaving(true);
    try {
      const created = await rolesApi.createRole({
        name: newRoleName,
        permissions: rolesApi.emptyPermissions(),
      });
      setCreating(false);
      setNewRoleName('');
      setOpenRoleId(created.id);
      toast.success('Role created — expand it to set permissions.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create role');
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (
    role: ShopRoleRecord,
    payload: {
      name: string;
      description: string | null;
      permissions: ShopRoleRecord['permissions'];
    },
  ) => {
    setSaving(true);
    try {
      await rolesApi.updateRole(role, payload);
      toast.success('Role updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save role');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: ShopRoleRecord) => {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setSaving(true);
    try {
      await rolesApi.deleteRole(role);
      if (openRoleId === role.id) setOpenRoleId(null);
      toast.success('Role deleted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="shell-accent-icon grid size-9 shrink-0 place-items-center rounded-[10px]">
            <Shield size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-shell-ink">Roles & permissions</p>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-shell-muted">
              Define what each role can access. Assign roles when inviting people on the People tab.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={cn(settingsBtnOutline, 'inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px]')}
          onClick={() => setCreating(current => !current)}
        >
          <Plus size={14} />
          New role
        </button>
      </div>

      {creating ? (
        <div className="space-y-2 rounded-xl border border-shell-line bg-shell-surface-2/40 p-3">
          <label className={labelClass} htmlFor="new-role-name">
            Role name
          </label>
          <Input
            id="new-role-name"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="e.g. Front desk"
            className={fieldClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !newRoleName.trim()}
              className={cn(settingsBtnPrimary, 'px-3 py-1.5 text-xs')}
              onClick={() => void createRole()}
            >
              Create role
            </button>
            <button
              type="button"
              className={cn(settingsBtnOutline, 'px-3 py-1.5 text-xs')}
              onClick={() => {
                setCreating(false);
                setNewRoleName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {rolesApi.loading ? (
        <p className="flex items-center gap-2 text-xs text-shell-muted">
          <Loader2 size={14} className="animate-spin" />
          Loading roles…
        </p>
      ) : rolesApi.error ? (
        <p className="text-xs text-amber-200">{rolesApi.error}</p>
      ) : rolesApi.roles.length === 0 ? (
        <p className="text-xs text-shell-muted">No roles yet. Run the latest migration in Supabase.</p>
      ) : (
        <div className="space-y-2">
          {rolesApi.roles.map(role => (
            <RoleAccordionItem
              key={role.id}
              role={role}
              open={openRoleId === role.id}
              saving={saving}
              onToggle={() => toggleRole(role.id)}
              onSave={payload => saveRole(role, payload)}
              onDelete={deleteRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
