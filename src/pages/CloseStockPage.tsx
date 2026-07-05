import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStockSessionActions } from '@/hooks/useStockSessionActions';
import type { InventoryItem, StockSessionSummary } from '@/types';
import { findItemByScannedValue } from '@/lib/serializedIdentifiers';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

const BarcodeScanner = lazy(() => import('@/components/inventory/BarcodeScanner'));

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
  const [scanOpen, setScanOpen] = useState(false);

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
    () => expectedIds.filter(id => !checked.has(id)),
    [expectedIds, checked]
  );

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleScan = (raw: string) => {
    setScanOpen(false);
    const match = findItemByScannedValue(checklistItems, raw);
    if (!match) {
      toast.error('No matching device on this checklist');
      return;
    }
    if (checked.has(match.id)) {
      toast.message(`${match.name} already confirmed`);
      return;
    }
    setChecked(prev => new Set(prev).add(match.id));
    toast.success(`${match.name} confirmed`);
  };

  const onConfirmClose = async () => {
    if (!sessionId) return;
    setClosing(true);
    setError(null);
    try {
      const present = expectedIds.filter(id => checked.has(id));
      await confirmCloseSession(sessionId, present, { ...missingNotes });
      const m = missingIds.length;
      setDoneMessage(
        m === 0
          ? 'Stock-take posted. Everything matched the system.'
          : `Stock-take posted with ${m} discrepanc${m === 1 ? 'y' : 'ies'} — devices marked missing in inventory.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setClosing(false);
    }
  };

  if (!sessionId) {
    return <div className="app-page py-8 text-sm text-shell-muted">Invalid session.</div>;
  }

  if (loading) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center py-8">
        <Loader2 className="size-8 animate-spin text-violet-300" />
      </div>
    );
  }

  if (doneMessage) {
    const isWarn = doneMessage.includes('discrepanc');
    return (
      <div className="app-page flex flex-col items-center px-4 py-16 text-center">
        <div
          className={cn(
            'mb-4 grid size-14 place-items-center rounded-full',
            isWarn ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'
          )}
        >
          <Check size={28} strokeWidth={2.4} />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">Stock-take posted</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-shell-muted">{doneMessage}</p>
        <Button
          className="mt-6 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
          onClick={() => navigate('/reports/stock-sessions')}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <button
        type="button"
        onClick={() => navigate('/reports/stock-sessions')}
        className="inline-flex items-center gap-1 text-xs font-semibold text-shell-muted transition-colors hover:text-shell-ink"
      >
        <ChevronLeft size={14} />
        Cancel count
      </button>

      <div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">Counting stock</h2>
        <p className="text-xs text-shell-muted">Confirm each device physically on the shelf</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : null}

      {summary ? (
        <Card className="border-shell-line bg-shell-surface shadow-none">
          <CardContent className="divide-y divide-shell-line py-0 text-sm">
            <SummaryRow label="Opening count" value={summary.opening_count} />
            <SummaryRow label="Sold" value={summary.sold_count} />
            <SummaryRow label="Credit sales" value={summary.credit_sales_count} />
            <SummaryRow label="Out for repair" value={summary.sent_engineer_count} />
            <SummaryRow label="Returns received" value={summary.returns_received_count} />
            <SummaryRow label="New stock added" value={summary.new_stock_count} />
            <SummaryRow label="Expected remaining" value={summary.expected_remaining} highlight />
          </CardContent>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-shell-muted">On-hand checklist</p>
            <p className="text-xs text-shell-muted">Tap each row or scan IMEI / S/N to confirm.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine size={14} />
            Scan device
          </Button>
        </div>
        <div className="space-y-2">
          {checklistItems.map(item => {
            const ok = checked.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                  ok
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-shell-line bg-shell-surface-2/30'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                    ok ? 'bg-emerald-400 text-[#160a2e]' : 'bg-shell-surface text-shell-muted ring-1 ring-shell-line'
                  )}
                >
                  {ok ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-shell-ink">{item.name}</p>
                  <p className="text-[11px] capitalize text-shell-muted">{item.brand}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10px] text-shell-muted">
                    {item.imei ? <span>IMEI: {item.imei}</span> : null}
                    {item.serial_number ? <span>S/N: {item.serial_number}</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {missingIds.length > 0 ? (
        <Card className="border-red-500/30 bg-red-500/[0.06] shadow-none">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-semibold text-red-300">
              {missingIds.length} device(s) not confirmed — add a note for each
            </p>
            {missingIds.map(id => {
              const item = checklistItems.find(i => i.id === id);
              return (
                <div key={id} className="space-y-1 rounded-lg border border-shell-line bg-shell-surface/80 p-3">
                  <p className="text-xs font-medium text-shell-ink">{item?.name ?? id}</p>
                  {(item?.imei || item?.serial_number) && (
                    <p className="font-mono text-[10px] text-shell-muted">
                      {[item?.imei && `IMEI ${item.imei}`, item?.serial_number && `S/N ${item.serial_number}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <Textarea
                    value={missingNotes[id] ?? ''}
                    onChange={e => setMissingNotes(m => ({ ...m, [id]: e.target.value }))}
                    placeholder="What happened?"
                    rows={2}
                    className="shell-inset-field mt-1 min-h-0 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-2 py-1.5 text-xs text-shell-ink outline-none placeholder:text-shell-muted"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-shell-line bg-shell-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-5">
          <Stat label="Lines" value={checklistItems.length} />
          <Stat label="Discrepancies" value={missingIds.length} warn={missingIds.length > 0} />
          <Stat label="Confirmed" value={checked.size} />
        </div>
        <Button
          className="bg-violet-400 text-[#160a2e] hover:bg-violet-300"
          disabled={closing || missingIds.some(id => !(missingNotes[id]?.trim()))}
          onClick={() => void onConfirmClose()}
        >
          {closing ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Posting…
            </>
          ) : (
            <>
              <ScanLine size={16} />
              Post {missingIds.length || 'no'} adjustment{missingIds.length === 1 ? '' : 's'}
            </>
          )}
        </Button>
      </div>

      {scanOpen ? (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleScan} onClose={() => setScanOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-shell-muted">{label}</span>
      <span
        className={cn(
          'font-mono tabular-nums font-semibold',
          highlight ? 'text-violet-300' : 'text-shell-ink'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-shell-muted">{label}</p>
      <p className={cn('font-mono text-base font-bold tabular-nums', warn ? 'text-amber-300' : 'text-shell-ink')}>
        {value}
      </p>
    </div>
  );
}
