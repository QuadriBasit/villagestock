import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Check, ChevronLeft, Loader2, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useStockSessionById } from '@/hooks/useStockSessions';
import { sessionCode, sessionDiscrepancies } from '@/lib/stockTake';
import type { InventoryItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function StockSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { shopOwnerId } = useShopAccess();
  const { session, isLoading } = useStockSessionById(sessionId);

  const itemIds = useMemo(() => {
    if (!session) return [];
    const ids = new Set<string>();
    for (const id of session.expected_closing_ids ?? []) ids.add(id);
    for (const id of session.actual_closing_ids ?? []) ids.add(id);
    for (const id of session.missing_item_ids ?? []) ids.add(id);
    for (const id of session.opening_snapshot_ids ?? []) ids.add(id);
    return [...ids];
  }, [session]);

  const itemsMap = useLiveQuery(async () => {
    if (!shopOwnerId || itemIds.length === 0) return new Map<string, InventoryItem>();
    const rows = await Promise.all(itemIds.map((id) => db.inventory_items.get(id)));
    const map = new Map<string, InventoryItem>();
    for (const row of rows) {
      if (row && row.user_id === shopOwnerId && !row.deleted) map.set(row.id, row);
    }
    return map;
  }, [shopOwnerId, itemIds.join('|')]);

  const expectedIds = session?.expected_closing_ids ?? [];
  const confirmedIds = new Set(session?.actual_closing_ids ?? []);
  const missingIdSet = new Set(session?.missing_item_ids ?? []);
  const openingConfirmedIds = new Set(session?.opening_confirmed_ids ?? []);
  const openingConfirmedCount = session?.opening_confirmed_ids?.length ?? 0;

  const confirmedItems = useMemo(() => {
    if (!session) return [];
    const ids =
      session.actual_closing_ids.length > 0
        ? session.actual_closing_ids
        : session.status === 'closed' || session.status === 'closed_with_discrepancy'
          ? expectedIds.filter((id) => !missingIdSet.has(id))
          : [];
    return ids.map((id) => itemsMap?.get(id)).filter((i): i is InventoryItem => !!i);
  }, [session, expectedIds, missingIdSet, itemsMap]);

  const missingItems = useMemo(() => {
    if (!session?.missing_item_ids?.length || !itemsMap) return [];
    return session.missing_item_ids.map((id) => itemsMap.get(id)).filter((i): i is InventoryItem => !!i);
  }, [session, itemsMap]);

  if (!sessionId) {
    return <div className="app-page py-8 text-sm text-shell-muted">Invalid session.</div>;
  }

  if (isLoading || session === undefined || itemsMap === undefined) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-300" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="app-page space-y-4 py-8">
        <p className="text-sm text-shell-muted">Session not found.</p>
        <Button
          variant="outline"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => navigate('/reports/stock-sessions')}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const sum = session.summary;
  const discrepancies = sessionDiscrepancies(session);
  const isClosed = session.status !== 'open';

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <button
        type="button"
        onClick={() => navigate('/reports/stock-sessions')}
        className="inline-flex items-center gap-1 text-xs font-semibold text-shell-muted transition-colors hover:text-shell-ink"
      >
        <ChevronLeft size={14} />
        Back to stock-takes
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-shell-muted">Stock-take</p>
        <h2 className="font-display text-lg font-semibold text-shell-ink">
          {format(parseISO(session.date), 'EEEE, d MMMM yyyy')}
        </h2>
        <p className="mt-1 text-xs text-shell-muted">
          {sessionCode(session)} · opened {format(parseISO(session.opened_at), 'HH:mm')}
          {session.closed_at ? ` · closed ${format(parseISO(session.closed_at), 'HH:mm')}` : ''}
        </p>
        <div className="mt-2">
          <Badge
            className={
              session.status === 'open'
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                : discrepancies === 0
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/25 bg-red-500/10 text-red-300'
            }
          >
            {session.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {sum ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="divide-y divide-shell-line py-0 text-sm">
            <Row k="Opening count" v={sum.opening_count} />
            <Row k="Sold" v={sum.sold_count} />
            <Row k="Credit sales" v={sum.credit_sales_count} />
            <Row k="Out for repair" v={sum.sent_engineer_count} />
            <Row k="Returns received" v={sum.returns_received_count} />
            <Row k="New stock" v={sum.new_stock_count} />
            <Row k="Expected remaining" v={sum.expected_remaining} bold />
          </CardContent>
        </Card>
      ) : null}

      {session.opening_snapshot_ids.length > 0 ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-shell-ink">
              Opened with ({session.opening_snapshot_ids.length})
            </p>
            <p className="mt-1 text-xs text-shell-muted">
              {openingConfirmedCount > 0
                ? `${openingConfirmedCount} of ${session.opening_snapshot_ids.length} devices confirmed at open.`
                : session.status === 'open'
                  ? 'Confirm these devices from the opening checklist.'
                  : 'Devices on the books when this session started.'}
            </p>
            <ul className="mt-3 space-y-2">
              {session.opening_snapshot_ids.map((id) => {
                const item = itemsMap?.get(id);
                if (!item) return null;
                return (
                  <DeviceRow key={id} item={item} ok={openingConfirmedIds.has(id)} />
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isClosed && confirmedItems.length > 0 ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-shell-ink">
              Confirmed on shelf ({confirmedItems.length})
            </p>
            <p className="mt-1 text-xs text-shell-muted">
              Devices physically counted and matched during this stock-take.
            </p>
            <ul className="mt-3 space-y-2">
              {confirmedItems.map((item) => (
                <DeviceRow key={item.id} item={item} ok />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isClosed && expectedIds.length > 0 && confirmedItems.length === 0 && missingItems.length === 0 ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="py-4 text-sm text-shell-muted">
            This count was posted before device lists were saved on the session. Summary numbers above
            still apply.
          </CardContent>
        </Card>
      ) : null}

      {session.status === 'open' && expectedIds.length > 0 ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-shell-ink">Expected on shelf ({expectedIds.length})</p>
            <p className="mt-1 text-xs text-shell-muted">Finish the count to confirm each device.</p>
            <ul className="mt-3 space-y-2">
              {expectedIds.map((id) => {
                const item = itemsMap?.get(id);
                if (!item) return null;
                return <DeviceRow key={id} item={item} ok={confirmedIds.has(id)} />;
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {missingItems.length > 0 ? (
        <Card className="border-red-500/30 bg-red-500/[0.06] shadow-none">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-red-300">Missing at close ({missingItems.length})</p>
            <ul className="mt-3 space-y-2">
              {missingItems.map((item) => (
                <li key={item.id} className="rounded-lg border border-shell-line bg-shell-surface/80 px-3 py-2">
                  <DeviceRow item={item} ok={false} inline />
                  {session.missing_notes_by_item_id?.[item.id] ? (
                    <p className="mt-1 text-[11px] text-shell-muted">
                      Note: {session.missing_notes_by_item_id[item.id]}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-shell-line bg-shell-surface shadow-none">
        <CardContent className="py-4">
          <p className="text-sm font-semibold text-shell-ink">Audit trail</p>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {session.audit_log.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="border-b border-shell-line pb-2 last:border-0">
                <span className="font-mono text-[10px] text-shell-muted">
                  {format(parseISO(entry.at), 'dd MMM yyyy, HH:mm')}
                </span>
                <span className="ml-2 font-medium capitalize text-brand-300">{entry.action.replace(/_/g, ' ')}</span>
                {entry.detail ? <p className="mt-0.5 text-shell-muted">{entry.detail}</p> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceRow({
  item,
  ok,
  inline,
}: {
  item: InventoryItem;
  ok: boolean;
  inline?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md',
          ok ? 'bg-emerald-400 text-[#04231d]' : 'bg-shell-surface text-shell-muted ring-1 ring-shell-line'
        )}
      >
        {ok ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-shell-ink">{item.name}</p>
        <p className="text-[11px] capitalize text-shell-muted">{item.brand}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-shell-muted">
          {item.imei ? <span>IMEI: {item.imei}</span> : null}
          {item.serial_number ? <span>S/N: {item.serial_number}</span> : null}
        </div>
      </div>
    </>
  );

  if (inline) {
    return <div className="flex items-start gap-2.5">{content}</div>;
  }

  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-shell-line bg-shell-surface-2/30 px-3 py-2.5">
      {content}
    </li>
  );
}

function Row({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 px-4 py-3">
      <span className="text-shell-muted">{k}</span>
      <span
        className={cn(
          'font-mono tabular-nums',
          bold ? 'font-bold text-brand-300' : 'font-medium text-shell-ink'
        )}
      >
        {v}
      </span>
    </div>
  );
}
