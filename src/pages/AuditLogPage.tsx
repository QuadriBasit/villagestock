import { format, formatDistanceToNow } from 'date-fns';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuditEvents } from '@/hooks/useAuditEvents';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';

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
  'repair.sent': { label: 'Sent for repair', icon: Wrench },
  'repair.status_updated': { label: 'Repair updated', icon: Wrench },
  'repair.collected': { label: 'Repair collected', icon: Wrench },
  'shop.profile_updated': { label: 'Shop profile updated', icon: Settings },
  'team.member_added': { label: 'Team member added', icon: Users },
  'team.member_removed': { label: 'Team member removed', icon: Users },
  'team.member_invited': { label: 'Team invite sent', icon: Users },
};

const ENTITY_LABELS: Record<string, string> = {
  sale: 'Sale',
  return: 'Return',
  swap: 'Swap',
  credit: 'Credit',
  inventory_item: 'Item',
  repair_record: 'Repair',
  shop_profile: 'Shop',
  business_member: 'Team',
  staff_invite: 'Invite',
  business_profile: 'Business',
};

function formatMetadata(meta: Record<string, unknown> | null | undefined): { key: string; value: string }[] {
  if (!meta || typeof meta !== 'object') return [];
  const out: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    const display =
      typeof v === 'object' ? JSON.stringify(v) : String(v);
    const key = k.replace(/_/g, ' ');
    out.push({ key, value: display.length > 120 ? `${display.slice(0, 117)}…` : display });
  }
  return out;
}

export default function AuditLogPage() {
  const { events, isLoading } = useAuditEvents(300);

  if (isLoading) return <AlertsSkeletonList />;

  return (
    <div className="app-page space-y-5 py-5 md:space-y-6 md:py-8">
      <div>
        <h1 className="font-heading text-lg font-semibold text-zinc-900 dark:text-zinc-50">Audit log</h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Recent actions in your shop. Events sync when you are online; staff actions appear under their signed-in
          account.
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
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-950/80">
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    When
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Action
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Target
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
                  const entityKind = ENTITY_LABELS[ev.entity_type] ?? ev.entity_type;
                  const metaRows = formatMetadata(ev.metadata);
                  const at = new Date(ev.created_at);
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
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-300">
                            <Icon size={16} aria-hidden />
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-700 dark:text-zinc-300">{entityKind}</span>
                        {ev.entity_id ? (
                          <div className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                            {ev.entity_id.slice(0, 8)}…{ev.entity_id.slice(-4)}
                          </div>
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
                                <span className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">{row.key}</span>
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
