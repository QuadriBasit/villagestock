import { format, formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ClipboardList,
  CreditCard,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
  ArrowRightLeft,
  Warehouse,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuditEvents } from '@/hooks/useAuditEvents';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuthStore } from '@/store/auth';
import { db } from '@/lib/db';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { AuditEvent } from '@/types';

type ActionMeta = { label: string; icon: LucideIcon };

const ACTION_MAP: Record<string, ActionMeta> = {
  'sale.recorded': { label: 'Sale recorded', icon: ShoppingCart },
  'return.processed': { label: 'Return processed', icon: RotateCcw },
  'swap.completed': { label: 'Swap completed', icon: ArrowRightLeft },
  'credit.created': { label: 'Credit created', icon: CreditCard },
  'credit.payment_recorded': { label: 'Credit payment', icon: CreditCard },
  'inventory.item_created': { label: 'Item added', icon: Package },
  'inventory.item_updated': { label: 'Item updated', icon: Package },
  'inventory.status_changed': { label: 'Status changed', icon: Package },
  'inventory.item_archived': { label: 'Item archived', icon: Package },
  'inventory.stock_adjusted': { label: 'Stock adjusted', icon: Warehouse },
  'inventory.item_transferred_branch': { label: 'Moved to another branch', icon: Warehouse },
  'team.member_branch_scope_updated': { label: 'Team branch access updated', icon: Users },
  'repair.sent': { label: 'Sent for repair', icon: Wrench },
  'repair.status_updated': { label: 'Repair updated', icon: Wrench },
  'repair.collected': { label: 'Repair collected', icon: Wrench },
  'shop.profile_updated': { label: 'Shop profile updated', icon: Settings },
  'team.member_added': { label: 'Team member added', icon: Users },
  'team.member_removed': { label: 'Team member removed', icon: Users },
  'team.member_invited': { label: 'Team invite sent', icon: Users },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ENTITY_FALLBACK: Record<string, string> = {
  sale: 'Sale',
  sales_record: 'Sale',
  return: 'Return',
  return_record: 'Return',
  swap: 'Swap',
  swap_record: 'Swap',
  credit: 'Credit',
  credit_record: 'Credit',
  inventory_item: 'Item',
  repair_record: 'Repair',
  shop_profile: 'Shop',
  business_member: 'Team',
  staff_invite: 'Invite',
  business_profile: 'Business',
};

function isUuidLike(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function formatMetadata(
  meta: Record<string, unknown> | null | undefined,
  skipKeys: Set<string>
): { key: string; value: string }[] {
  if (!meta || typeof meta !== 'object') return [];
  const out: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    if (skipKeys.has(k)) continue;
    if (k.endsWith('_id') && typeof v === 'string' && isUuidLike(v)) continue;
    let display = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (typeof v === 'string' && isUuidLike(v)) continue;
    if (Array.isArray(v) && v.every(x => typeof x === 'string' && isUuidLike(x))) {
      display = `${v.length} branch(es)`;
    }
    const key = k.replace(/_/g, ' ');
    out.push({ key, value: display.length > 120 ? `${display.slice(0, 117)}…` : display });
  }
  return out;
}

function actorLabelForEvent(
  ev: AuditEvent,
  shopOwnerId: string | null,
  ownerName: string | undefined,
  memberDisplayByUserId: Map<string, string>,
  viewerUserId: string | undefined,
  viewerEmail: string | undefined,
  viewerPhone: string | undefined
): string {
  const meta = ev.metadata && typeof ev.metadata === 'object' ? (ev.metadata as { actor_name?: unknown }) : null;
  if (meta && typeof meta.actor_name === 'string' && meta.actor_name.trim()) {
    return meta.actor_name.trim();
  }
  const actorId = ev.actor_user_id;
  if (!actorId) return 'Team member';

  if (shopOwnerId && actorId === shopOwnerId) {
    const owner = ownerName?.trim();
    if (owner) return owner;
    const fromRoster = memberDisplayByUserId.get(actorId);
    if (fromRoster) return fromRoster;
    return 'Shop owner';
  }

  const fromRoster = memberDisplayByUserId.get(actorId);
  if (fromRoster) return fromRoster;

  if (viewerUserId === actorId) {
    const u = viewerEmail?.trim() || viewerPhone?.trim();
    if (u) return u;
  }
  return 'Team member';
}

function targetDescription(
  ev: AuditEvent,
  inventoryNames: Map<string, string>
): { primary: string; secondary?: string } {
  const meta = (ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {}) as Record<string, unknown>;

  switch (ev.entity_type) {
    case 'inventory_item': {
      const name =
        (typeof meta.item === 'string' && meta.item) ||
        (ev.entity_id ? inventoryNames.get(ev.entity_id) : undefined);
      return { primary: name || 'Inventory item' };
    }
    case 'sales_record':
      return {
        primary: typeof meta.receipt === 'string' ? `Receipt ${meta.receipt}` : 'Sale',
        secondary: typeof meta.item === 'string' ? meta.item : undefined,
      };
    case 'return_record':
      return {
        primary: typeof meta.receipt === 'string' ? `Return · receipt ${meta.receipt}` : 'Return',
        secondary: typeof meta.item === 'string' ? meta.item : undefined,
      };
    case 'swap_record':
      return {
        primary: typeof meta.receipt === 'string' ? `Swap · ${meta.receipt}` : 'Swap',
        secondary:
          typeof meta.traded_out === 'string'
            ? [meta.traded_out, typeof meta.traded_in === 'string' ? meta.traded_in : null]
                .filter(Boolean)
                .join(' → ')
            : undefined,
      };
    case 'credit_record':
      return {
        primary:
          typeof meta.customer === 'string'
            ? `Credit · ${meta.customer}`
            : 'Credit',
      };
    case 'repair_record':
      return {
        primary: typeof meta.item === 'string' ? meta.item : 'Repair',
        secondary: typeof meta.engineer === 'string' ? meta.engineer : typeof meta.status === 'string' ? meta.status : undefined,
      };
    case 'business_profile':
      return { primary: 'Shop profile' };
    case 'business_member':
      return {
        primary: typeof meta.name === 'string' && meta.name.trim() ? meta.name : 'Team member',
      };
    case 'staff_invite': {
      const inviteName =
        (typeof meta.name === 'string' && meta.name) ||
        (typeof meta.display_name === 'string' && meta.display_name) ||
        undefined;
      return {
        primary: typeof meta.email === 'string' ? `Invite · ${meta.email}` : 'Email invite',
        secondary: inviteName,
      };
    }
    default:
      return { primary: ENTITY_FALLBACK[ev.entity_type] ?? 'Record' };
  }
}

export default function AuditLogPage() {
  const { events, isLoading } = useAuditEvents(300);
  const { shopOwnerId } = useShopAccess();
  const { profile } = useBusinessProfile();
  const { members: teamMembers } = useTeamMembers();
  const viewer = useAuthStore(s => s.user);

  const memberDisplayByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of teamMembers) {
      const n = row.display_name?.trim();
      if (n) m.set(row.member_user_id, n);
    }
    return m;
  }, [teamMembers]);

  const inventoryNames = useLiveQuery(async () => {
    if (!shopOwnerId || !events.length) return new Map<string, string>();
    const ids = new Set<string>();
    for (const ev of events) {
      if (ev.entity_type === 'inventory_item' && ev.entity_id) ids.add(ev.entity_id);
    }
    const map = new Map<string, string>();
    await Promise.all(
      [...ids].map(async id => {
        const row = await db.inventory_items.get(id);
        if (row && !row.deleted) {
          map.set(id, `${row.brand} ${row.name}`.trim());
        }
      })
    );
    return map;
  }, [shopOwnerId, events]);

  if (isLoading) return <AlertsSkeletonList />;

  const nameMap = inventoryNames ?? new Map();

  return (
    <div className="app-page space-y-5 py-5 md:space-y-6 md:py-8">
      <div>
        <h1 className="font-heading text-lg font-semibold text-zinc-900 dark:text-zinc-50">Audit log</h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Recent actions in your shop. Each row shows who did it and what was affected — not internal IDs.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-700">
          <ClipboardList className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No events yet</p>
          <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            Sales and inventory changes will show here after you use the app online, or once data syncs from other
            devices.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-950/80">
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    When
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Who
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Action
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    What
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {events.map(ev => {
                  const meta = ACTION_MAP[ev.action] ?? { label: ev.action, icon: ClipboardList };
                  const Icon = meta.icon;
                  const skipDetailKeys = new Set([
                    'actor_name',
                    'item',
                    'receipt',
                    'email',
                    'name',
                    'display_name',
                    'customer',
                    'engineer',
                    'status',
                    'traded_out',
                    'traded_in',
                  ]);
                  const metaRows = formatMetadata(ev.metadata as Record<string, unknown> | undefined, skipDetailKeys);
                  const at = new Date(ev.created_at);
                  const who = actorLabelForEvent(
                    ev,
                    shopOwnerId,
                    profile?.owner_name,
                    memberDisplayByUserId,
                    viewer?.id,
                    viewer?.email ?? undefined,
                    viewer?.phone ?? undefined
                  );
                  const target = targetDescription(ev, nameMap);
                  return (
                    <tr
                      key={ev.id}
                      className="align-top transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <time
                          dateTime={ev.created_at}
                          className="block font-medium text-zinc-900 dark:text-zinc-100"
                          title={format(at, 'PPpp')}
                        >
                          {formatDistanceToNow(at, { addSuffix: true })}
                        </time>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{format(at, 'MMM d, HH:mm')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            <User size={16} aria-hidden />
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{who}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-300">
                            <Icon size={16} aria-hidden />
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{meta.label}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{target.primary}</span>
                        {target.secondary ? (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{target.secondary}</p>
                        ) : null}
                      </td>
                      <td className="max-w-md px-4 py-3">
                        {metaRows.length === 0 ? (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {metaRows.map(row => (
                              <span
                                key={row.key}
                                className="inline-flex max-w-full items-baseline gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950/50"
                                title={`${row.key}: ${row.value}`}
                              >
                                <span className="shrink-0 font-medium capitalize text-zinc-500 dark:text-zinc-400">
                                  {row.key}
                                </span>
                                <span className="truncate text-zinc-800 dark:text-zinc-200">{row.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
