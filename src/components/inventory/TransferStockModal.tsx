import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Search,
  Truck,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { getItemQty, itemSpecLine } from '@/lib/inventoryDisplay';
import { getDeviceDetailsSearchText, type InventoryItem } from '@/types';
import { cn } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetHeader, modalSheetPanelMd } from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { settingsBtnPrimary, settingsField, settingsLabel } from '@/components/settings/settingsUi';

type TransferStockModalProps = {
  open: boolean;
  presetItem?: InventoryItem | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function TransferStockModal({
  open,
  presetItem,
  onClose,
  onSuccess,
}: TransferStockModalProps) {
  const { shopOwnerId } = useShopAccess();
  const { locations, activeLocationId } = useShopLocation();
  const { transferItemToBranch } = useInventoryActions();

  const [done, setDone] = useState(false);
  const [pick, setPick] = useState<InventoryItem | null>(null);
  const [query, setQuery] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherLocations = useMemo(
    () => locations.filter(l => l.id !== fromId),
    [locations, fromId],
  );

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setPick(presetItem ?? null);
    setQuery('');
    setError(null);
    setBusy(false);
    const from = presetItem?.location_id ?? activeLocationId ?? locations[0]?.id ?? '';
    setFromId(from);
    const to = locations.find(l => l.id !== from)?.id ?? '';
    setToId(to);
  }, [open, presetItem, activeLocationId, locations]);

  useEffect(() => {
    if (!open || presetItem) return;
    if (toId && toId === fromId) {
      setToId(otherLocations[0]?.id ?? '');
    }
  }, [fromId, toId, otherLocations, open, presetItem]);

  const searchResults = useLiveQuery(async () => {
    if (!open || !shopOwnerId || !fromId || pick) return [];
    const rows = await db.inventory_items
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        i =>
          !i.deleted &&
          i.location_id === fromId &&
          (i.mode !== 'serialized' || i.status === 'in_stock') &&
          getItemQty(i) > 0,
      )
      .toArray();
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          i =>
            i.name.toLowerCase().includes(q) ||
            i.brand.toLowerCase().includes(q) ||
            i.serial_number?.toLowerCase().includes(q) ||
            i.imei?.toLowerCase().includes(q) ||
            getDeviceDetailsSearchText(i.deviceDetails).includes(q),
        )
      : rows;
    return filtered.slice(0, 8);
  }, [open, shopOwnerId, fromId, query, pick]);

  if (!open) return null;

  const branchName = (id: string) => locations.find(l => l.id === id)?.name ?? 'Branch';
  const multiBranch = locations.length > 1;
  const selected = pick;
  const qty = selected ? getItemQty(selected) : 0;
  const canMove = !!selected && !!fromId && !!toId && fromId !== toId && qty > 0 && !busy;

  const confirm = async () => {
    if (!selected || !toId || !canMove) return;
    setBusy(true);
    setError(null);
    try {
      await transferItemToBranch(selected.id, toId);
      setDone(true);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not transfer stock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={cn(
            modalSheetPanelMd,
            'border-shell-line bg-shell-surface ring-shell-line/40 dark:border-shell-line dark:bg-shell-surface',
          )}>
<div className={cn(modalSheetHeader, 'border-shell-line')}>
            <div>
              <h3 className="font-display text-lg font-semibold text-shell-ink">
                {done ? 'Transfer logged' : 'Transfer stock'}
              </h3>
              {!done ? (
                <p className="text-sm text-shell-muted">Move units between your branches</p>
              ) : null}
            </div>
            <ModalSheetClose />
          </div>

          <div className={cn(modalSheetBodyScroll, 'space-y-4 bg-shell-surface-2/20')}>
            {!multiBranch ? (
              <p className="rounded-xl border border-shell-line bg-shell-surface px-4 py-3 text-sm text-shell-muted">
                Add another branch in Settings to transfer stock between counters.
              </p>
            ) : done && selected ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={28} strokeWidth={2.4} />
                </div>
                <p className="font-display text-base font-semibold text-shell-ink">
                  {qty > 1 ? `${qty} × ` : ''}
                  {selected.name}
                </p>
                <p className="mt-2 text-sm text-shell-muted">
                  {branchName(fromId)} → {branchName(toId)}
                </p>
                <button type="button" onClick={onClose} className={cn(settingsBtnPrimary, 'mt-6 w-full py-3')}>
                  Done
                </button>
              </div>
            ) : !selected ? (
              <div className="space-y-3">
                {locations.length > 2 ? (
                  <div>
                    <label className={settingsLabel}>From branch</label>
                    <Select value={fromId || undefined} onValueChange={setFromId}>
                      <SelectTrigger className="w-full border-shell-line bg-shell-surface-2/40 text-shell-ink">
                        <SelectValue placeholder="Choose branch…" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div>
                  <label className={settingsLabel}>Which product?</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-shell-muted" />
                    <Input
                      autoFocus
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search inventory…"
                      className={cn(settingsField, 'pl-10')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {(searchResults ?? []).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPick(item);
                        if (item.location_id) setFromId(item.location_id);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-shell-line bg-shell-surface px-3 py-2.5 text-left transition-colors hover:bg-shell-surface-2/50"
                    >
                      <CategoryThumb category={item.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-shell-ink">{item.name}</p>
                        <p className="truncate text-xs text-shell-muted">
                          {getItemQty(item)} in stock · {itemSpecLine(item)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-shell-muted" />
                    </button>
                  ))}
                  {(searchResults ?? []).length === 0 ? (
                    <p className="px-1 py-2 text-sm text-shell-muted">No products match at this branch.</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-shell-line bg-shell-surface-2/40 p-3">
                  <CategoryThumb category={selected.category} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-shell-ink">{selected.name}</p>
                    <p className="truncate text-xs text-shell-muted">{itemSpecLine(selected)}</p>
                    {selected.mode === 'serialized' && (selected.imei || selected.serial_number) ? (
                      <p className="mt-0.5 font-mono text-[10px] text-shell-muted">
                        {[selected.imei && `IMEI ${selected.imei}`, selected.serial_number && `S/N ${selected.serial_number}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  {!presetItem ? (
                    <button
                      type="button"
                      onClick={() => setPick(null)}
                      className="shrink-0 text-xs font-semibold text-brand-400 hover:text-brand-300"
                    >
                      Change
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <div>
                    <label className={settingsLabel}>From</label>
                    <BranchSelect
                      value={fromId}
                      exclude={toId}
                      locations={locations}
                      onChange={setFromId}
                      disabled={!!presetItem}
                    />
                  </div>
                  <ArrowRight size={18} className="mb-2.5 text-brand-300" />
                  <div>
                    <label className={settingsLabel}>To</label>
                    <BranchSelect
                      value={toId}
                      exclude={fromId}
                      locations={locations}
                      onChange={setToId}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-shell-line bg-shell-surface-2/30 px-3 py-2.5 text-sm">
                  <span className="text-shell-muted">Moving </span>
                  <span className="font-semibold text-shell-ink">
                    {qty > 1 ? `all ${qty} units` : '1 unit'}
                  </span>
                  <span className="text-shell-muted"> from {branchName(fromId)}</span>
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={!canMove}
                  onClick={() => void confirm()}
                  className={cn(settingsBtnPrimary, 'w-full py-3 disabled:opacity-45')}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Transferring…
                    </>
                  ) : (
                    <>
                      <Truck size={16} />
                      Transfer to {branchName(toId)}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}

function BranchSelect({
  value,
  exclude,
  locations,
  onChange,
  disabled,
}: {
  value: string;
  exclude: string;
  locations: { id: string; name: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const options = locations.filter(l => l.id !== exclude);
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full border-shell-line bg-shell-surface-2/40 text-shell-ink">
        <SelectValue placeholder="Branch…" />
      </SelectTrigger>
      <SelectContent>
        {options.map(l => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
