import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Loader2, Warehouse, X } from 'lucide-react';
import { useStockSessionActions } from '@/hooks/useStockSessionActions';
import type { InventoryItem, StockSessionSummary } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function CloseStockPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { loadCloseState, confirmCloseSession } = useStockSessionActions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<InventoryItem[]>([]);
  const [expectedIds, setExpectedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<StockSessionSummary | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [missingNotes, setMissingNotes] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadCloseState(sessionId);
      setChecklistItems(data.checklistItems);
      setExpectedIds(data.expectedIds);
      setSummary(data.session.summary ?? null);
      setChecked(new Set());
      setMissingNotes({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, loadCloseState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const missingIds = useMemo(
    () => expectedIds.filter((id) => !checked.has(id)),
    [expectedIds, checked]
  );

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onConfirmClose = async () => {
    if (!sessionId) return;
    setClosing(true);
    setError(null);
    try {
      const present = expectedIds.filter((id) => checked.has(id));
      await confirmCloseSession(sessionId, present, { ...missingNotes });
      const m = missingIds.length;
      setDoneMessage(
        m === 0
          ? 'Stock closed. All devices accounted for!'
          : `WARNING: ${m} device(s) unaccounted for — marked as Missing in inventory.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setClosing(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="app-page py-8">
        <p className="text-sm text-muted">Invalid session.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (doneMessage) {
    const isWarn = doneMessage.startsWith('WARNING');
    return (
      <div className="app-page space-y-4 py-6">
        <Card className={isWarn ? 'border-red-300 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/25' : ''}>
          <CardContent className="py-6">
            <p className={`text-center text-sm font-semibold ${isWarn ? 'text-red-700 dark:text-red-200' : 'text-teal dark:text-teal-300'}`}>
              {doneMessage}
            </p>
          </CardContent>
        </Card>
        <Button type="button" className="w-full rounded-xl" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-6">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Warehouse size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Close stock</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Confirm each device still on hand</p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {summary && (
        <Card>
          <CardContent className="space-y-2 py-4 text-sm">
            <SummaryRow label="Opening count" value={summary.opening_count} />
            <SummaryRow label="Sold" value={summary.sold_count} />
            <SummaryRow label="Credit sales" value={summary.credit_sales_count} />
            <SummaryRow label="Sent to engineer" value={summary.sent_engineer_count} />
            <SummaryRow label="Returns received" value={summary.returns_received_count} />
            <SummaryRow label="New stock added" value={summary.new_stock_count} />
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <SummaryRow label="Expected remaining" value={summary.expected_remaining} highlight />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="label-caps mb-2 text-zinc-500">On-hand checklist</p>
        <p className="mb-3 text-xs text-zinc-500">Tap each row when the device is physically present.</p>
        <div className="space-y-2">
          {checklistItems.map((item) => {
            const ok = checked.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  ok
                    ? 'border-teal/30 bg-teal/5 dark:border-teal/25 dark:bg-teal/10'
                    : 'border-red-200 bg-red-50/40 dark:border-red-900/35 dark:bg-red-950/20'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    ok ? 'bg-teal text-white' : 'bg-white text-red-500 ring-1 ring-red-200 dark:bg-zinc-900 dark:ring-red-900/50'
                  }`}
                >
                  {ok ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-[11px] text-zinc-500 capitalize">{item.brand}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono text-zinc-500">
                    {item.imei && <span>IMEI: {item.imei}</span>}
                    {item.serial_number && <span>S/N: {item.serial_number}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {missingIds.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-200">
              {missingIds.length} device(s) not confirmed — add a note for each before closing
            </p>
            {missingIds.map((id) => {
              const item = checklistItems.find((i) => i.id === id);
              return (
                <div key={id} className="space-y-1 rounded-xl bg-white/80 p-3 dark:bg-zinc-900/60">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {item?.name ?? id}
                  </p>
                  {(item?.imei || item?.serial_number) && (
                    <p className="text-[10px] font-mono text-zinc-500">
                      {[item?.imei && `IMEI ${item.imei}`, item?.serial_number && `S/N ${item.serial_number}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <textarea
                    value={missingNotes[id] ?? ''}
                    onChange={(e) => setMissingNotes((m) => ({ ...m, [id]: e.target.value }))}
                    placeholder="What happened?"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        className="h-12 w-full rounded-xl text-base font-semibold"
        disabled={closing || missingIds.some((id) => !(missingNotes[id]?.trim()))}
        onClick={() => void onConfirmClose()}
      >
        {closing ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Closing…
          </>
        ) : (
          'Confirm & close stock'
        )}
      </Button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className={`tabular-nums font-semibold ${highlight ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </span>
    </div>
  );
}
