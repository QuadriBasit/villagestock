import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { AnimatedAccordion } from '@/components/ui/AnimatedAccordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  SHOP_PERMISSION_GROUPS,
  applyGroupPreset,
  countEnabledPermissions,
  isGroupFullyEnabled,
  isGroupPartiallyEnabled,
  type ShopPermissionKey,
  type ShopPermissions,
  type ShopRoleRecord,
} from '@/lib/shopPermissions';
import { settingsBtnPrimary } from '@/components/settings/settingsUi';
import { cn } from '@/lib/utils';

const GROUP_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'all', label: 'All' },
] as const;

type RoleAccordionItemProps = {
  role: ShopRoleRecord;
  open: boolean;
  saving?: boolean;
  onToggle: () => void;
  onSave: (payload: {
    name: string;
    description: string | null;
    permissions: ShopPermissions;
  }) => Promise<void>;
  onDelete?: (role: ShopRoleRecord) => Promise<void>;
};

function PermissionGroupAccordion({
  group,
  permissions,
  onPreset,
  onPermissionChange,
}: {
  group: (typeof SHOP_PERMISSION_GROUPS)[number];
  permissions: ShopPermissions;
  onPreset: (enabled: boolean) => void;
  onPermissionChange: (key: ShopPermissionKey, enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const fullyEnabled = isGroupFullyEnabled(permissions, group.id);
  const partiallyEnabled = isGroupPartiallyEnabled(permissions, group.id);
  const selectValue = fullyEnabled ? 'all' : partiallyEnabled ? 'custom' : 'none';
  const enabledInGroup = group.permissions.filter(permission => permissions[permission.key]).length;

  return (
    <AnimatedAccordion
      nested
      open={open}
      onToggle={() => setOpen(current => !current)}
      title={group.label}
      subtitle={`${enabledInGroup} of ${group.permissions.length} enabled · ${group.description}`}
      trailing={
        <Select
          value={selectValue}
          onValueChange={value => {
            if (value === 'custom') return;
            onPreset(value === 'all');
          }}
        >
          <SelectTrigger className="h-8 w-[5.5rem] text-[11px]">
            <SelectValue placeholder="Access" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_PRESETS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {partiallyEnabled ? (
              <SelectItem value="custom" disabled>
                Custom
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-1.5">
        {group.permissions.map(permission => (
          <label
            key={permission.key}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-shell-line/70 bg-shell-surface-2/25 px-2.5 py-2 transition-colors hover:bg-shell-surface-2/45"
          >
            <Checkbox
              checked={permissions[permission.key]}
              onCheckedChange={checked => onPermissionChange(permission.key, checked === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-shell-ink">{permission.label}</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-shell-muted">
                {permission.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </AnimatedAccordion>
  );
}

export function RoleAccordionItem({
  role,
  open,
  saving = false,
  onToggle,
  onSave,
  onDelete,
}: RoleAccordionItemProps) {
  const [draftName, setDraftName] = useState(role.name);
  const [draftDescription, setDraftDescription] = useState(role.description ?? '');
  const [draftPermissions, setDraftPermissions] = useState<ShopPermissions>(role.permissions);

  useEffect(() => {
    if (!open) return;
    setDraftName(role.name);
    setDraftDescription(role.description ?? '');
    setDraftPermissions({ ...role.permissions });
  }, [open, role]);

  const enabledCount = open
    ? countEnabledPermissions(draftPermissions)
    : countEnabledPermissions(role.permissions);

  const setPermission = (key: ShopPermissionKey, enabled: boolean) => {
    setDraftPermissions(prev => ({ ...prev, [key]: enabled }));
  };

  return (
    <AnimatedAccordion
      open={open}
      onToggle={onToggle}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {role.name}
          {role.is_system ? (
            <span className="rounded-full bg-shell-surface-2 px-2 py-0.5 text-[10px] font-medium text-shell-muted">
              Built-in
            </span>
          ) : null}
        </span>
      }
      subtitle={
        role.description?.trim() ||
        `${enabledCount} permission${enabledCount === 1 ? '' : 's'} enabled`
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-1">
            <label className="text-xs font-medium text-shell-ink" htmlFor={`role-name-${role.id}`}>
              Role name
            </label>
            <Input
              id={`role-name-${role.id}`}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              placeholder="e.g. Front desk"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-shell-ink" htmlFor={`role-description-${role.id}`}>
              Description
            </label>
            <Textarea
              id={`role-description-${role.id}`}
              value={draftDescription}
              onChange={e => setDraftDescription(e.target.value)}
              rows={2}
              placeholder="Optional — shown when assigning this role"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-shell-ink">What this role can do</p>
          <div className="space-y-2">
            {SHOP_PERMISSION_GROUPS.map(group => (
              <PermissionGroupAccordion
                key={group.id}
                group={group}
                permissions={draftPermissions}
                onPreset={enabled =>
                  setDraftPermissions(prev => applyGroupPreset(prev, group.id, enabled))
                }
                onPermissionChange={setPermission}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-shell-line pt-3">
          <div>
            {!role.is_system && onDelete ? (
              <button
                type="button"
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/10"
                onClick={() => void onDelete(role)}
              >
                <Trash2 size={13} />
                Delete role
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={saving || !draftName.trim()}
            className={cn(settingsBtnPrimary, 'inline-flex items-center gap-1 px-3 py-1.5 text-[11px]')}
            onClick={() =>
              void onSave({
                name: draftName.trim(),
                description: draftDescription.trim() || null,
                permissions: draftPermissions,
              })
            }
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save role
          </button>
        </div>
      </div>
    </AnimatedAccordion>
  );
}
