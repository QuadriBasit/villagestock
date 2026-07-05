import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wrench } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useActiveRepairs, useCollectedRepairs } from '@/hooks/useRepairs';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn, formatCurrency } from '@/lib/utils';
import { daysOut, isRepairOverdue, REPAIR_STATUS_LABEL } from '@/lib/repair';
import { formatIdentifier, identifierKindForItem, primaryIdentifier } from '@/lib/inventoryDisplay';
import type { InventoryItem, RepairRecord, RepairStatus } from '@/types';

const RepairDetailModal = lazy(() => import('@/components/repair/RepairDetailModal'));

type ViewMode = 'board' | 'engineer' | 'collected';

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'engineer', label: 'By engineer' },
  { value: 'collected', label: 'Collected' },
];

const KANBAN_COLS: { key: RepairStatus; label: string; dot: string }[] = [
  { key: 'sent', label: 'Diagnosing', dot: 'bg-violet-400' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-blue-400' },
  { key: 'completed', label: 'Ready for pickup', dot: 'bg-emerald-400' },
];

export default function RepairPage() {
  const navigate = useNavigate();
  const { repairs, isLoading: activeLoading } = useActiveRepairs();
  const { repairs: collectedRepairs, isLoading: collectedLoading } = useCollectedRepairs();
  const [view, setView] = useState<ViewMode>('board');
  const [selected, setSelected] = useState<RepairRecord | null>(null);
  const isLoading = activeLoading || collectedLoading;

  const itemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of repairs) ids.add(record.item_id);
    for (const record of collectedRepairs) ids.add(record.item_id);
    return [...ids];
  }, [repairs, collectedRepairs]);
  const items = useLiveQuery(async (): Promise<InventoryItem[]> => {
    if (!itemIds.length) return [];
    const rows = await db.inventory_items.bulkGet(itemIds);
    return rows.filter((item): item is InventoryItem => !!item);
  }, [itemIds.join('|')]);
  const itemMap = new Map((items ?? []).map(item => [item.id, item]));

  const groups = useMemo(() => {
    const map = new Map<string, RepairRecord[]>();
    for (const record of repairs) {
      if (!map.has(record.engineer_name)) map.set(record.engineer_name, []);
      map.get(record.engineer_name)!.push(record);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [repairs]);

  if (isLoading) {
    return <div className="app-page py-8 text-sm text-shell-muted">Loading repairs…</div>;
  }

  if (repairs.length === 0 && collectedRepairs.length === 0) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-violet-400/10">
          <Wrench size={28} className="text-violet-300" />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">No items out for repair</h2>
        <p className="mt-1 max-w-sm text-sm text-shell-muted">
          Send a device from inventory to a repair shop or technician to track it here.
        </p>
        <Button
          className="mt-4 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
          onClick={() => navigate('/inventory')}
        >
          <Plus size={16} />
          Send item
        </Button>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Repairs & refurb"
        subtitle={
          view === 'collected'
            ? `${collectedRepairs.length} collected`
            : `${repairs.length} active ticket${repairs.length === 1 ? '' : 's'}`
        }
      >
        <Button
          size="sm"
          className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
          onClick={() => navigate('/inventory')}
        >
          <Plus size={16} />
          Send item
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
        <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Repairs view">
          {VIEW_TABS.map(t => {
            const active = view === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.value)}
                className={cn(
                  'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-shell-ink/70'
                    : 'text-shell-muted hover:text-shell-ink'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {KANBAN_COLS.map(col => {
            const records = repairs.filter(r => r.repair_status === col.key);
            return (
              <div key={col.key} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn('size-2 rounded-full', col.dot)} />
                  <span className="text-sm font-semibold text-shell-ink">{col.label}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-shell-muted">{records.length}</span>
                </div>
                {records.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-shell-line px-3 py-8 text-center text-xs text-shell-muted">
                    No tickets
                  </div>
                ) : (
                  records.map(record => (
                    <RepairCard
                      key={record.id}
                      record={record}
                      item={itemMap.get(record.item_id)}
                      onOpen={() => setSelected(record)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : view === 'engineer' ? (
        <div className="space-y-4">
          {groups.map(([engineerName, records]) => (
            <Card key={engineerName} className="border-shell-line bg-shell-surface p-0 shadow-none">
              <div className="border-b border-shell-line px-4 py-3">
                <h3 className="font-display text-sm font-semibold text-shell-ink">{engineerName}</h3>
                <p className="text-xs text-shell-muted">
                  {records.length} item{records.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="divide-y divide-shell-line">
                {records.map(record => {
                  const overdue = isRepairOverdue(record);
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelected(record)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-shell-surface-2/50',
                        overdue && 'bg-red-500/[0.06]'
                      )}
                    >
                      <RepairCardContent record={record} item={itemMap.get(record.item_id)} compact />
                      <span
                        className={cn(
                          'shrink-0 font-mono text-xs tabular-nums',
                          overdue ? 'text-red-400' : 'text-shell-muted'
                        )}
                      >
                        {daysOut(record.date_sent)}d
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {collectedRepairs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-shell-line px-4 py-12 text-center text-sm text-shell-muted">
              No collected repairs yet. When a device is returned to stock, it appears here so you can fix the collection date if needed.
            </div>
          ) : (
            collectedRepairs.map(record => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelected(record)}
                className="flex w-full items-start gap-3 rounded-lg border border-shell-line bg-shell-surface p-3.5 text-left transition-colors hover:border-shell-muted/40 hover:bg-shell-surface-2/30"
              >
                <RepairCardContent record={record} item={itemMap.get(record.item_id)} compact />
                <span className="shrink-0 text-right text-[11px] text-shell-muted">
                  {record.date_returned
                    ? new Date(record.date_returned).toLocaleDateString('en-NG')
                    : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {selected ? (
        <Suspense fallback={null}>
          <RepairDetailModal
            record={selected}
            item={itemMap.get(selected.item_id)}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function RepairCard({
  record,
  item,
  onOpen,
}: {
  record: RepairRecord;
  item?: InventoryItem;
  onOpen: () => void;
}) {
  const overdue = isRepairOverdue(record);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'rounded-lg border border-shell-line bg-shell-surface p-3.5 text-left transition-colors hover:border-shell-muted/40 hover:bg-shell-surface-2/30',
        overdue && 'border-red-500/30'
      )}
    >
      <RepairCardContent record={record} item={item} />
    </button>
  );
}

function RepairCardContent({
  record,
  item,
  compact,
}: {
  record: RepairRecord;
  item?: InventoryItem;
  compact?: boolean;
}) {
  const title = item ? `${item.brand} ${item.name}`.trim() : 'Unknown item';
  const idCode = item ? primaryIdentifier(item) : undefined;
  const idKind = item ? identifierKindForItem(item) : null;

  return (
    <div className={cn('min-w-0 flex-1', compact && 'flex flex-col gap-0.5')}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-shell-ink">{title}</p>
        {!compact ? (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-shell-muted">
            {daysOut(record.date_sent)}d
          </span>
        ) : null}
      </div>
      <p className={cn('line-clamp-2 text-xs text-shell-muted', !compact && 'mt-1')}>{record.issue_description}</p>
      <div className={cn('flex items-center justify-between gap-2', !compact ? 'mt-2.5 border-t border-shell-line pt-2.5' : 'mt-1')}>
        <span className="text-xs text-shell-muted">{record.engineer_name}</span>
        <div className="flex items-center gap-2">
          {idCode && idKind ? (
            <span className="font-mono text-[10px] text-shell-muted">{formatIdentifier(idCode, idKind)}</span>
          ) : null}
          {(record.repair_cost ?? 0) > 0 ? (
            <span className="font-mono text-xs font-semibold tabular-nums text-shell-ink">
              {formatCurrency(record.repair_cost!)}
            </span>
          ) : (
            <Badge variant="secondary" className="border-shell-line bg-shell-surface-2 text-[10px] text-shell-muted">
              {REPAIR_STATUS_LABEL[record.repair_status]}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
