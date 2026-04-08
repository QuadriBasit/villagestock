import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { useStockSessionById } from '@/hooks/useStockSessions';
import type { InventoryItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function StockSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { session, isLoading } = useStockSessionById(sessionId);

  const itemsMap = useLiveQuery(async () => {
    if (!user) return new Map<string, InventoryItem>();
    const rows = await db.inventory_items.where('user_id').equals(user.id).filter((i) => !i.deleted).toArray();
    return new Map(rows.map((i) => [i.id, i]));
  }, [user?.id]);

  const missingItems = useMemo(() => {
    if (!session?.missing_item_ids?.length || !itemsMap) return [];
    return session.missing_item_ids
      .map((id) => itemsMap.get(id))
      .filter((i): i is InventoryItem => !!i);
  }, [session, itemsMap]);

  if (!sessionId) {
    return <div className="app-page py-8 text-sm text-muted">Invalid session.</div>;
  }

  if (isLoading || session === undefined) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="app-page space-y-4 py-8">
        <p className="text-sm text-muted">Session not found.</p>
        <Button variant="outline" onClick={() => navigate('/reports/stock-sessions')}>
          Back to list
        </Button>
      </div>
    );
  }

  const sum = session.summary;

  return (
    <div className="app-page space-y-4 py-4 md:py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Session</p>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {format(parseISO(session.date), 'EEEE, d MMMM yyyy')}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Opened {format(parseISO(session.opened_at), 'HH:mm')}
          {session.closed_at ? ` · Closed ${format(parseISO(session.closed_at), 'HH:mm')}` : ''}
        </p>
      </div>

      {sum && (
        <Card>
          <CardContent className="grid gap-2 py-4 text-sm">
            <Row k="Opening count" v={sum.opening_count} />
            <Row k="Sold" v={sum.sold_count} />
            <Row k="Credit sales" v={sum.credit_sales_count} />
            <Row k="Sent to engineer" v={sum.sent_engineer_count} />
            <Row k="Returns received" v={sum.returns_received_count} />
            <Row k="New stock" v={sum.new_stock_count} />
            <Row k="Expected remaining" v={sum.expected_remaining} bold />
          </CardContent>
        </Card>
      )}

      {missingItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-200">Missing at close</p>
            <ul className="mt-2 space-y-2 text-xs">
              {missingItems.map((item) => (
                <li key={item.id} className="rounded-lg bg-red-50/80 px-2 py-1.5 dark:bg-red-950/30">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                  <span className="text-zinc-500"> · {item.brand}</span>
                  <div className="font-mono text-[10px] text-zinc-500">
                    {[item.imei && `IMEI ${item.imei}`, item.serial_number && `S/N ${item.serial_number}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {session.missing_notes_by_item_id?.[item.id] && (
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                      Note: {session.missing_notes_by_item_id[item.id]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Audit trail</p>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {session.audit_log.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
              >
                <span className="font-mono text-[10px] text-zinc-400">
                  {format(parseISO(entry.at), 'dd MMM yyyy, HH:mm')}
                </span>
                <span className="ml-2 font-medium text-primary">{entry.action}</span>
                {entry.detail && <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{entry.detail}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/reports/stock-sessions')}>
        Back to calendar list
      </Button>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-600 dark:text-zinc-400">{k}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-primary' : 'font-medium text-zinc-900 dark:text-zinc-100'}`}>
        {v}
      </span>
    </div>
  );
}
