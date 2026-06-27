import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Box, ClipboardList, History, Printer, ShoppingCart, Tag } from 'lucide-react';
import { useAuditEvents } from '@/hooks/useAuditEvents';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuthStore } from '@/store/auth';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import {
  AUDIT_CATEGORIES,
  auditActionMeta,
  auditActorLabel,
  auditEventCode,
  auditRelativeTime,
  auditStats,
  auditTargetDescription,
  auditTimeLabel,
  filterAuditEvents,
  groupAuditEventsByDay,
  type AuditCategory,
} from '@/lib/auditDisplay';
import type { AuditEvent } from '@/types';

export default function AuditLogPage() {
  const { events, isLoading } = useAuditEvents(300);
  const { shopOwnerId } = useShopAccess();
  const businessProfileQ = useBusinessProfileQuery(shopOwnerId ?? undefined);
  const businessProfile = businessProfileQ.status === 'ready' ? businessProfileQ.profile : null;
  const { members: teamMembers } = useTeamMembers();
  const viewer = useAuthStore(s => s.user);
  const [category, setCategory] = useState<AuditCategory>('all');
  const [query, setQuery] = useState('');

  const memberDisplayByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of teamMembers) {
      const name = row.display_name?.trim();
      if (name) map.set(row.member_user_id, name);
    }
    return map;
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
        if (row && !row.deleted) map.set(id, `${row.brand} ${row.name}`.trim());
      })
    );
    return map;
  }, [shopOwnerId, events]);

  const filtered = useMemo(
    () => filterAuditEvents(events, category, query),
    [events, category, query]
  );
  const groups = useMemo(() => groupAuditEventsByDay(filtered), [filtered]);
  const stats = useMemo(() => auditStats(events), [events]);

  if (isLoading) return <AlertsSkeletonList />;

  const nameMap = inventoryNames ?? new Map();

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Audit log"
        subtitle="Every change, who made it, and when — across your shop"
      >
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Export
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Changes today" value={String(stats.todayCount)} icon={History} />
        <StatCard
          label="Sales logged"
          value={String(stats.salesCount)}
          icon={ShoppingCart}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        />
        <StatCard label="Stock moves" value={String(stats.stockCount)} icon={Box} />
        <StatCard
          label="Money logged"
          value={String(stats.moneyCount)}
          icon={Tag}
          iconClassName="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
        />
      </StatGrid>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="relative min-w-0 flex-1">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the log — item, person, amount…"
            className="shell-inset-field h-10 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 py-2 pl-3 pr-3 text-sm text-shell-ink outline-none placeholder:text-shell-muted focus:border-shell-muted/60"
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
          <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Audit category">
            {AUDIT_CATEGORIES.map(tab => {
              const active = category === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(tab.value)}
                  className={cn(
                    'relative shrink-0 px-3 py-2.5 text-xs font-medium transition-colors',
                    active
                      ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-shell-ink/70'
                      : 'text-shell-muted hover:text-shell-ink'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-violet-400/10">
            <ClipboardList size={28} className="text-violet-300" />
          </div>
          <h2 className="font-display text-lg font-semibold text-shell-ink">No activity matches</h2>
          <p className="mt-1 max-w-sm text-sm text-shell-muted">
            {events.length === 0
              ? 'Sales and inventory changes will show here as you use the app.'
              : 'Try a different filter or search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <section key={group.day}>
              <div className="mb-2.5 flex items-center gap-3 px-0.5">
                <span className="font-display text-xs font-bold tracking-wide text-shell-ink">{group.day}</span>
                <span className="h-px flex-1 bg-shell-line" />
                <span className="font-mono text-[11px] tabular-nums text-shell-muted">
                  {group.items.length} change{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
                {group.items.map((event, index) => (
                  <AuditRow
                    key={event.id}
                    event={event}
                    inventoryNames={nameMap}
                    shopOwnerId={shopOwnerId}
                    ownerName={businessProfile?.owner_name}
                    memberDisplayByUserId={memberDisplayByUserId}
                    viewer={viewer}
                    bordered={index > 0}
                  />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({
  event,
  inventoryNames,
  shopOwnerId,
  ownerName,
  memberDisplayByUserId,
  viewer,
  bordered,
}: {
  event: AuditEvent;
  inventoryNames: Map<string, string>;
  shopOwnerId: string | null;
  ownerName?: string;
  memberDisplayByUserId: Map<string, string>;
  viewer: { id: string; email?: string | null; phone?: string | null } | null;
  bordered: boolean;
}) {
  const meta = auditActionMeta(event.action);
  const Icon = meta.icon;
  const who = auditActorLabel(
    event,
    shopOwnerId,
    ownerName,
    memberDisplayByUserId,
    viewer?.id,
    viewer?.email ?? undefined,
    viewer?.phone ?? undefined
  );
  const target = auditTargetDescription(event, inventoryNames);
  const initial = who.trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'flex gap-3.5 px-4 py-3.5',
        bordered && 'border-t border-shell-line'
      )}
    >
      <span
        className="mt-0.5 grid size-[34px] shrink-0 place-items-center rounded-[10px]"
        style={{
          color: meta.tone,
          background: `color-mix(in oklch, ${meta.tone} 16%, transparent)`,
        }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-shell-ink">{meta.label}</p>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-shell-muted">
            {auditTimeLabel(event.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-shell-muted">{target.title}</p>
        {target.detail ? <p className="mt-1 text-xs text-shell-muted">{target.detail}</p> : null}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-violet-400/15 text-[10px] font-bold text-violet-300">
            {initial}
          </span>
          <span className="text-xs font-semibold text-shell-ink">{who}</span>
          <span className="ml-auto font-mono text-[10px] text-shell-muted">{auditEventCode(event.id)}</span>
        </div>
        <p className="mt-1 text-[10px] text-shell-muted">{auditRelativeTime(event.created_at)}</p>
      </div>
    </div>
  );
}
