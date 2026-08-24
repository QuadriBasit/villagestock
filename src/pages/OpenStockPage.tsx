import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useStockSessionActions } from '@/hooks/useStockSessionActions';
import { useStockSessionById } from '@/hooks/useStockSessions';
import { findItemByScannedValue } from '@/lib/serializedIdentifiers';
import type { InventoryItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const BarcodeScanner = lazy(() => import('@/components/inventory/BarcodeScanner'));

/** Opening-stock review: confirm which devices the day starts with, like the close checklist. */
export default function OpenStockPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { status: accessStatus } = useShopAccess();
  const { session, isLoading } = useStockSessionById(sessionId);
  const { confirmOpeningSession } = useStockSessionActions();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [done, setDone] = useState(false);

  const itemsMap = useLiveQuery(async () => {
    const ids = session?.opening_snapshot_ids ?? [];
    if (ids.length === 0) return new Map<string, InventoryItem>();
    const rows = await Promise.all(ids.map((id) => db.inventory_items.get(id)));
    const map = new Map<string, InventoryItem>();
    for (const row of rows) {
      if (row && !row.deleted) map.set(row.id, row);
    }
    return map;
  }, [session?.id, (session?.opening_snapshot_ids ?? []).join('|')]);

  const items = useMemo(
    () =>
      (session?.opening_snapshot_ids ?? [])
        .map((id) => itemsMap?.get(id))
        .filter((i): i is InventoryItem => !!i),
    [session, itemsMap]
  );
  const alreadyConfirmed = useMemo(
    () => session?.opening_confirmed_ids ?? [],
    [session]
  );

  // Pre-check devices confirmed on a previous visit to this page.
  useEffect(() => {
    if (session && !done && checked.size === 0 && alreadyConfirmed.length > 0) {
      setChecked(new Set(alreadyConfirmed));
    }
  }, [session, alreadyConfirmed, checked.size, done]);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleScan = (raw: string) => {
    setScanOpen(false);
    const match = findItemByScannedValue(items, raw);
    if (!match) {
      toast.error('No matching device in this opening list');
      return;
    }
    if (checked.has(match.id)) {
      toast.message(`${match.name} already confirmed`);
      return;
    }
    setChecked((prev) => new Set(prev).add(match.id));
    toast.success(`${match.name} confirmed`);
  };

  const onConfirm = async () => {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      await confirmOpeningSession(sessionId, [...checked]);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save opening confirmation');
    } finally {
      setSaving(false);
    }
  };

  if (!sessionId) {
    return <div className="app-page py-8 text-sm text-shell-muted">Invalid session.</div>;
  }

  if (accessStatus !== 'ready' || isLoading || session === undefined || itemsMap === undefined) {
    return (
      <div className="app-page flex min-h-[40vh] items-center justify-center py-8">
        <Loader2 className="size-8 animate-spin text-brand-300" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-16 text-center">
        <h2 className="font-display text-lg font-semibold text-shell-ink">Session not found</h2>
        <p className="mt-2 max-w-md text-sm text-shell-muted">
          This stock session doesn't exist or belongs to another shop.
        </p>
        <Button className="mt-6 bg-brand-400 text-[#04231d] hover:bg-brand-300" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (session.status !== 'open') {
    return (
      <div className="app-page flex flex-col items-center px-4 py-16 text-center">
        <h2 className="font-display text-lg font-semibold text-shell-ink">
          This session is already closed
        </h2>
        <Button className="mt-6 bg-brand-400 text-[#04231d] hover:bg-brand-300" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (done) {
    const unchecked = items.length - checked.size;
    return (
      <div className="app-page flex flex-col items-center px-4 py-16 text-center">
        <div
          className={cn(
            'mb-4 grid size-14 place-items-center rounded-full',
            unchecked > 0
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-emerald-500/15 text-emerald-400'
          )}
        >
          <Check size={28} strokeWidth={2.4} />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">Stock opened</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-shell-muted">
          {unchecked > 0
            ? `You confirmed ${checked.size} of ${items.length} devices. ${unchecked} were left unchecked — keep an eye on them today.`
            : `All ${items.length} devices confirmed. You're set for the day.`}
        </p>
        <Button
          className="mt-6 bg-brand-400 text-[#04231d] hover:bg-brand-300"
          onClick={() => navigate('/')}
        >
          Done
        </Button>
      </div>
    );
  }

  const uncheckedCount = items.length - checked.size;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1 text-xs font-semibold text-shell-muted transition-colors hover:text-shell-ink"
      >
        <ChevronLeft size={14} />
        Skip for now
      </button>

      <div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">Opening stock</h2>
        <p className="text-xs text-shell-muted">
          These {items.length} serialized device{items.length === 1 ? '' : 's'} are on the books for today —
          confirm each one is physically present.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : null}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-shell-muted">
              Opening checklist
            </p>
            <p className="text-xs text-shell-muted">Tap each row or scan IMEI / S/N to confirm.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine size={14} />
            Scan device
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item) => {
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
                    ok
                      ? 'bg-emerald-400 text-[#04231d]'
                      : 'bg-shell-surface text-shell-muted ring-1 ring-shell-line'
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

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-shell-line bg-shell-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-5">
          <Stat label="Devices" value={items.length} />
          <Stat label="Confirmed" value={checked.size} />
          <Stat label="Unchecked" value={uncheckedCount} warn={uncheckedCount > 0} />
        </div>
        <Button
          className="bg-brand-400 text-[#04231d] hover:bg-brand-300"
          disabled={saving}
          onClick={() => void onConfirm()}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Check size={16} />
              Finish opening
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
