import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, PackageX, Search, Warehouse } from 'lucide-react';
import { useBusinessProfileQuery } from '@/hooks/useBusinessProfileQuery';
import {
  PriorDayStockOpenError,
  useStockSessionActions,
} from '@/hooks/useStockSessionActions';
import {
  useMissingSerializedItems,
  usePriorOpenStockSessionState,
  useTodayStockSessionState,
} from '@/hooks/useStockSessions';
import { hasStockAccountabilityPlan } from '@/lib/stockSessionUtils';
import {
  modalSheetBackdrop,
  modalSheetHandle,
  modalSheetPanelMd,
} from '@/lib/modalSheet';
import { useAuthStore } from '@/store/auth';
import type { InventoryItem, MissingResolution } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export function DashboardStockAccountability() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profileQ = useBusinessProfileQuery(user?.id);
  const { session: todaySession, isLoading: todayLoading } = useTodayStockSessionState();
  const { session: priorOpen, isLoading: priorLoading } = usePriorOpenStockSessionState();
  const missingItems = useMissingSerializedItems();
  const { openTodaySession, forceAbandonOpenSession } = useStockSessionActions();

  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [resolving, setResolving] = useState<InventoryItem | null>(null);

  const planReady = profileQ.status === 'ready';
  const profile = profileQ.status === 'ready' ? profileQ.profile : null;
  const businessOk = hasStockAccountabilityPlan(profile);
  const loading = !planReady || todayLoading || priorLoading;

  const isOpenToday = todaySession?.status === 'open';
  const closedOrNoToday =
    todaySession != null && todaySession.status !== 'open';

  const priorBlocks = !!priorOpen && businessOk;

  const onOpenStock = async () => {
    setErr(null);
    setFlash(null);
    try {
      const s = await openTodaySession();
      setFlash(
        `Stock opened with ${s.opening_snapshot_ids.length} devices. Have a good day!`
      );
    } catch (e) {
      if (e instanceof PriorDayStockOpenError) {
        setErr('Close or skip the previous open session first.');
      } else {
        setErr(e instanceof Error ? e.message : 'Could not open stock');
      }
    }
  };

  const onSkipPrior = async () => {
    setSkipOpen(false);
    if (!priorOpen) return;
    try {
      await forceAbandonOpenSession(
        priorOpen.id,
        `Skipped (${priorOpen.date}) without full reconciliation`
      );
      await onOpenStock();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not skip');
    }
  };

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2 px-0.5">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Opening &amp; closing stock
          </h3>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/80" />
        ) : !businessOk ? (
          <Card className="border-zinc-200/80 dark:border-zinc-800">
            <CardContent className="relative overflow-hidden py-5">
              <div className="pointer-events-none absolute inset-0 bg-zinc-100/50 opacity-90 dark:bg-zinc-900/60" aria-hidden />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <Lock size={22} strokeWidth={2.5} />
                </span>
                <p className="max-w-sm text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Upgrade to Business plan to enable stock accountability
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 rounded-full"
                  onClick={() => navigate('/settings')}
                >
                  View plans
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {flash && (
              <p className="rounded-2xl border border-teal/25 bg-teal/10 px-4 py-3 text-center text-sm font-semibold text-teal-dark dark:text-teal-300">
                {flash}
              </p>
            )}
            {err && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {err}
              </p>
            )}

            {priorBlocks && (
              <Card className="border-amber-300 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/25">
                <CardContent className="space-y-3 py-4">
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    Yesterday&apos;s stock was not closed. Close it now or skip?
                  </p>
                  <p className="text-xs text-amber-900/80 dark:text-amber-200/90">
                    Date: {priorOpen.date} · still marked open
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="flex-1 rounded-xl"
                      onClick={() => navigate(`/stock/close/${priorOpen.id}`)}
                    >
                      Close it now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl border-amber-400/60 dark:border-amber-700"
                      onClick={() => setSkipOpen(true)}
                    >
                      Skip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!closedOrNoToday && !isOpenToday && !priorBlocks && (
              <Button
                type="button"
                size="lg"
                className="h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20"
                onClick={() => void onOpenStock()}
              >
                <Warehouse size={22} className="mr-2" />
                Open stock
              </Button>
            )}

            {isOpenToday && todaySession && (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-14 w-full rounded-2xl text-base font-bold"
                onClick={() => navigate(`/stock/close/${todaySession.id}`)}
              >
                Close stock
              </Button>
            )}

            {closedOrNoToday && (
              <p className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Today&apos;s stock session is closed.
              </p>
            )}
          </div>
        )}

        {businessOk && missingItems.length > 0 && (
          <Card className="border-red-200 dark:border-red-900/40">
            <CardContent className="py-4">
              <div className="mb-3 flex items-center gap-2">
                <PackageX size={18} className="text-red-600 dark:text-red-400" />
                <h4 className="font-semibold text-red-800 dark:text-red-200">
                  Missing items ({missingItems.length})
                </h4>
              </div>
              <ul className="space-y-2">
                {missingItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setResolving(item)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-left text-sm dark:border-red-900/30 dark:bg-zinc-900/50"
                    >
                      <span className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </span>
                      <Search size={14} className="shrink-0 text-red-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={skipOpen}
        title="Skip closing previous stock?"
        message="The previous session will be marked closed without a full checklist. Only use this if you are sure."
        confirmLabel="Skip and open today"
        destructive
        onConfirm={() => void onSkipPrior()}
        onCancel={() => setSkipOpen(false)}
      />

      {resolving && (
        <ResolveMissingModal item={resolving} onClose={() => setResolving(null)} />
      )}
    </>
  );
}

function ResolveMissingModal({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const { resolveMissingItem } = useStockSessionActions();
  const [resolution, setResolution] = useState<MissingResolution>('found');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!note.trim()) {
      setError('A note is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resolveMissingItem(item.id, resolution, note.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div className={modalSheetPanelMd} onClick={(e) => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <div className="max-h-[min(90vh,720px)] overflow-y-auto p-5 sm:max-h-[min(85vh,680px)]">
        <h3 className="font-heading text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Resolve missing device
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.name}</p>
        {(item.imei || item.serial_number) && (
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            {[item.imei && `IMEI ${item.imei}`, item.serial_number && `S/N ${item.serial_number}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-zinc-500">Outcome</p>
          <div className="grid gap-2">
            {(
              [
                ['found', 'Found — back in stock'],
                ['stolen', 'Confirmed stolen'],
                ['write_off', 'Write off'],
              ] as const
            ).map(([val, label]) => (
              <label
                key={val}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  resolution === val
                    ? 'border-primary bg-primary/10'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="res"
                  className="accent-primary"
                  checked={resolution === val}
                  onChange={() => setResolution(val)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-zinc-500">Note *</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Record what happened…"
          />
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
