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
} from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { useShopAccess } from '@/context/ShopAccessContext';
import type { InventoryItem, MissingResolution } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { settingsField } from '@/components/settings/settingsUi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export function DashboardStockAccountability() {
  const navigate = useNavigate();
  const { shopOwnerId } = useShopAccess();
  const profileQ = useBusinessProfileQuery(shopOwnerId ?? undefined);
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
      <Card className="h-full border-shell-line bg-shell-surface">
        <CardContent className="p-4 md:p-5">
          <h3 className="font-display text-[15.5px] font-semibold text-shell-ink">
            Opening &amp; closing stock
          </h3>

        {loading ? (
          <div className="mt-4 h-24 animate-pulse rounded-2xl bg-shell-surface-2" />
        ) : !businessOk ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-shell-line py-5">
            <div className="pointer-events-none absolute inset-0 bg-shell-surface-2/50" aria-hidden />
            <div className="relative flex flex-col items-center gap-2 px-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shell-surface-2 text-shell-muted">
                <Lock size={22} strokeWidth={2.5} />
              </span>
              <p className="max-w-sm text-sm font-semibold text-shell-ink">
                Upgrade to Business plan to enable stock accountability
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 rounded-full border-shell-line"
                onClick={() => navigate('/settings')}
              >
                View plans
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
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
                className="h-12 w-full rounded-xl bg-violet-400 text-[#160a2e] text-base font-bold hover:bg-violet-300 sm:w-auto sm:min-w-[200px]"
                onClick={() => void onOpenStock()}
              >
                <Warehouse size={20} className="mr-2" />
                Open stock
              </Button>
            )}

            {isOpenToday && todaySession && (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-12 w-full rounded-xl text-base font-bold sm:w-auto sm:min-w-[200px]"
                onClick={() => navigate(`/stock/close/${todaySession.id}`)}
              >
                Close stock
              </Button>
            )}

            {closedOrNoToday && (
              <p className="text-xs font-medium text-shell-muted">
                Today&apos;s stock session is closed.
              </p>
            )}
          </div>
        )}

        {businessOk && missingItems.length > 0 && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
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
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-red-500/25 bg-shell-surface px-3 py-2 text-left text-sm hover:bg-shell-surface-2/40"
                    >
                      <span className="min-w-0 truncate font-medium text-shell-ink">
                        {item.name}
                      </span>
                      <Search size={14} className="shrink-0 text-red-500" />
                    </button>
                  </li>
                ))}
              </ul>
          </div>
        )}
        </CardContent>
      </Card>

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
    <ModalSheetPortal>
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div
        className="max-h-[min(90vh,720px)] overflow-y-auto border border-shell-line bg-shell-surface p-0 shadow-none sm:max-h-[min(85vh,680px)] sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-shell-line" />
        </div>
        <div className="p-5">
        <h3 className="font-display text-lg font-semibold text-shell-ink">Resolve missing device</h3>
        <p className="mt-1 text-sm text-shell-muted">{item.name}</p>
        {(item.imei || item.serial_number) && (
          <p className="mt-1 font-mono text-[11px] text-shell-muted">
            {[item.imei && `IMEI ${item.imei}`, item.serial_number && `S/N ${item.serial_number}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-shell-muted">Outcome</p>
          <div className="grid gap-2">
            {(
              [
                ['found', 'Found — back in stock'],
                ['stolen', 'Confirmed stolen'],
                ['write_off', 'Write off'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setResolution(val)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  resolution === val
                    ? 'border-violet-400/40 bg-violet-400/10 text-shell-ink'
                    : 'border-shell-line text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink',
                )}
              >
                <span
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-full border',
                    resolution === val ? 'border-violet-400 bg-violet-400' : 'border-shell-line',
                  )}
                  aria-hidden
                >
                  {resolution === val ? (
                    <span className="size-1.5 rounded-full bg-[#160a2e]" />
                  ) : null}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-shell-muted">Note *</label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className={cn(settingsField, 'mt-1')}
            placeholder="Record what happened…"
          />
        </div>

        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl bg-violet-400 text-[#160a2e] hover:bg-violet-300"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
        </div>
      </div>
    </div>
    </ModalSheetPortal>
  );
}
