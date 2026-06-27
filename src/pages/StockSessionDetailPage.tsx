import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
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
  const user = useAuthStore(s => s.user);
  const { session, isLoading } = useStockSessionById(sessionId);

  const itemsMap = useLiveQuery(async () => {
    if (!user) return new Map<string, InventoryItem>();
    const rows = await db.inventory_items.where('user_id').equals(user.id).filter(i => !i.deleted).toArray();
    return new Map(rows.map(i => [i.id, i]));
  }, [user?.id]);

  const missingItems = useMemo(() => {
    if (!session?.missing_item_ids?.length || !itemsMap) return [];
    return session.missing_item_ids.map(id => itemsMap.get(id)).filter((i): i is InventoryItem => !!i);
  }, [session, itemsMap]);

  if (!sessionId) {
    return <div className="app-page py-8 text-sm text-shell-muted">Invalid session.</div>;
  }

  if (isLoading || session === undefined) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-violet-300" />
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

      {missingItems.length > 0 ? (
        <Card className="border-red-500/30 bg-red-500/[0.06] shadow-none">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-red-300">Missing at close ({missingItems.length})</p>
            <ul className="mt-3 space-y-2 text-xs">
              {missingItems.map(item => (
                <li key={item.id} className="rounded-lg border border-shell-line bg-shell-surface/80 px-3 py-2">
                  <span className="font-medium text-shell-ink">{item.name}</span>
                  <span className="text-shell-muted"> · {item.brand}</span>
                  <div className="font-mono text-[10px] text-shell-muted">
                    {[item.imei && `IMEI ${item.imei}`, item.serial_number && `S/N ${item.serial_number}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
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
                <span className="ml-2 font-medium capitalize text-violet-300">{entry.action.replace(/_/g, ' ')}</span>
                {entry.detail ? <p className="mt-0.5 text-shell-muted">{entry.detail}</p> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 px-4 py-3">
      <span className="text-shell-muted">{k}</span>
      <span
        className={cn(
          'font-mono tabular-nums',
          bold ? 'font-bold text-violet-300' : 'font-medium text-shell-ink'
        )}
      >
        {v}
      </span>
    </div>
  );
}
