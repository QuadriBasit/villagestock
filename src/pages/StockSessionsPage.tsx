import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarDays, ChevronRight } from 'lucide-react';
import { useAllStockSessions } from '@/hooks/useStockSessions';
import type { StockSession } from '@/types';

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export default function StockSessionsPage() {
  const navigate = useNavigate();
  const sessions = useAllStockSessions();

  const byMonth = useMemo(() => {
    const map = new Map<string, StockSession[]>();
    for (const s of sessions) {
      const k = monthKey(s.date);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  return (
    <div className="app-page space-y-5 py-4 md:py-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <CalendarDays size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Stock sessions</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Daily open & close history (Business plan)</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">No sessions yet. Open stock from the dashboard to start.</p>
      ) : (
        <div className="space-y-6">
          {byMonth.map(([ym, monthSessions]) => {
            const label = format(parseISO(`${ym}-01`), 'MMMM yyyy');
            return (
              <section key={ym}>
                <h3 className="label-caps mb-2 text-zinc-500">{label}</h3>
                <div className="space-y-2">
                  {monthSessions
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((s) => (
                      <SessionRow key={s.id} session={s} onOpen={() => navigate(`/reports/stock-sessions/${s.id}`)} />
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: StockSession; onOpen: () => void }) {
  const disc = session.status === 'closed_with_discrepancy';
  const openCount = session.opening_snapshot_ids.length;
  const closedCount = session.actual_closing_ids?.length ?? 0;
  const dayLabel = format(parseISO(session.date), 'EEE d MMM');

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
        disc ? 'border-red-300 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20' : 'border-zinc-200/80 dark:border-zinc-800'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{dayLabel}</span>
          {disc && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle size={11} /> Discrepancy
            </span>
          )}
          {session.status === 'open' && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
              Open
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Opened {openCount} · {session.status === 'open' ? 'Not closed' : `Closed · ${closedCount} confirmed on hand`}
          {session.missing_item_ids?.length ? ` · ${session.missing_item_ids.length} missing` : ''}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
    </button>
  );
}
