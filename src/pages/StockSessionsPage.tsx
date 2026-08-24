import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Box, History, ScanLine } from 'lucide-react';
import { db } from '@/lib/db';
import {
  PriorDayStockOpenError,
  useStockSessionActions,
} from '@/hooks/useStockSessionActions';
import {
  useAllStockSessions,
  usePriorOpenStockSessionState,
  useTodayStockSessionState,
} from '@/hooks/useStockSessions';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  lastClosedSession,
  recentDiscrepancyTotal,
  sessionCode,
  sessionDayLabel,
  sessionDiscrepancies,
  sessionIsClean,
  sessionLines,
} from '@/lib/stockTake';
import type { StockSession } from '@/types';

const TABLE_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.65fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] gap-x-3 items-center';

export default function StockSessionsPage() {
  const navigate = useNavigate();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const sessions = useAllStockSessions();
  const { session: todaySession } = useTodayStockSessionState();
  const { session: priorOpen } = usePriorOpenStockSessionState();
  const { openTodaySession } = useStockSessionActions();
  const [starting, setStarting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackedCount = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return 0;
    const rows = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        i =>
          !i.deleted &&
          i.location_id === activeLocationId &&
          i.mode === 'serialized' &&
          (i.status === 'in_stock' || i.status === 'reserved')
      )
      .toArray();
    return rows.length;
  }, [shopOwnerId, activeLocationId, locationReady]);

  const last = useMemo(() => lastClosedSession(sessions), [sessions]);
  const discrepancyTotal = useMemo(() => recentDiscrepancyTotal(sessions), [sessions]);

  const startCount = async () => {
    setError(null);
    if (priorOpen) {
      navigate(`/stock/close/${priorOpen.id}`);
      return;
    }
    if (todaySession?.status === 'open') {
      navigate(`/stock/close/${todaySession.id}`);
      return;
    }
    setStarting(true);
    try {
      const session = await openTodaySession();
      navigate(`/stock/open/${session.id}`);
    } catch (e) {
      if (e instanceof PriorDayStockOpenError) {
        setError('Close the previous open session before starting a new count.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not start count');
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Stock-take"
        subtitle="Count what's on the shelf, reconcile against the system"
      >
        <Button
          size="sm"
          className="bg-brand-400 text-[#04231d] hover:bg-brand-300"
          disabled={starting}
          onClick={() => setConfirmStart(true)}
        >
          <ScanLine size={16} />
          {starting ? 'Starting…' : 'Start a count'}
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Last count" value={last ? sessionDayLabel(last) : '—'} icon={ScanLine} />
        <StatCard label="Devices tracked" value={String(trackedCount ?? 0)} icon={Box} />
        <StatCard label="Counts logged" value={String(sessions.length)} icon={History} />
        <StatCard
          label="Discrepancies (90d)"
          value={String(discrepancyTotal)}
          icon={AlertTriangle}
          iconClassName=" text-amber-600 dark:text-amber-300"
        />
      </StatGrid>

      {error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <ConfirmDialog
        open={confirmStart}
        title="Start a stock count?"
        message="A session will open with a snapshot of your serialized devices, and you'll confirm them on the opening checklist before trading."
        confirmLabel="Start count"
        onConfirm={() => {
          setConfirmStart(false);
          void startCount();
        }}
        onCancel={() => setConfirmStart(false)}
      />

      <Card className="border-shell-line bg-gradient-to-br from-brand-400/[0.14] to-shell-surface p-4 shadow-none md:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-400/15 text-brand-300">
            <ScanLine size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-semibold text-shell-ink">Run a physical count</h3>
            <p className="mt-1 text-sm leading-relaxed text-shell-muted">
              Open today&apos;s session, confirm each serialized device on hand, and post any missing units to
              the audit trail.
            </p>
          </div>
          <Button
            className="bg-brand-400 text-[#04231d] hover:bg-brand-300"
            disabled={starting}
            onClick={() => setConfirmStart(true)}
          >
            <ScanLine size={16} />
            Start a count
          </Button>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 font-display text-sm font-semibold text-shell-ink">Past stock-takes</h3>
        <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div
                className={cn(
                  TABLE_GRID,
                  'border-b border-shell-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-shell-muted'
                )}
              >
                <span>Count</span>
                <span>Date · status</span>
                <span className="text-center">Lines</span>
                <span className="text-center">Discrep.</span>
                <span className="text-right">Result</span>
              </div>
              {sessions.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-shell-muted">No stock-takes logged yet.</div>
              ) : (
                sessions.map(session => (
                  <SessionRow key={session.id} session={session} onOpen={() => navigate(`/reports/stock-sessions/${session.id}`)} />
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: StockSession; onOpen: () => void }) {
  const discrepancies = sessionDiscrepancies(session);
  const clean = sessionIsClean(session);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        TABLE_GRID,
        'w-full border-b border-shell-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-shell-surface-2/40'
      )}
    >
      <div>
        <p className="font-mono text-sm font-semibold text-shell-ink">{sessionCode(session)}</p>
        <p className="text-[11px] text-shell-muted">{sessionDayLabel(session)}</p>
      </div>
      <div>
        <p className="text-sm text-shell-ink">Daily close</p>
        <p className="text-[11px] capitalize text-shell-muted">{session.status.replace(/_/g, ' ')}</p>
      </div>
      <p className="text-center font-mono text-sm tabular-nums text-shell-muted">{sessionLines(session)}</p>
      <div className="text-center">
        {discrepancies === 0 ? (
          <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">Clean</Badge>
        ) : (
          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">{discrepancies}</Badge>
        )}
      </div>
      <p
        className={cn(
          'text-right text-sm font-medium',
          clean ? 'text-emerald-300' : discrepancies > 0 ? 'text-amber-300' : 'text-shell-muted'
        )}
      >
        {session.status === 'open'
          ? 'In progress'
          : clean
            ? 'Matched'
            : `${discrepancies} missing`}
      </p>
    </button>
  );
}
