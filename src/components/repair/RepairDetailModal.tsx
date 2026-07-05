import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronLeft, Loader2, Phone, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { ModalSheetFrame } from '@/components/ui/ModalSheetFrame';
import { ModalSheetClose } from '@/components/ui/ModalSheetClose';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { DateTimeField, toLocalDatetimeValue } from '@/components/ui/DateTimeField';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useRepairActions } from '@/hooks/useRepairActions';
import { db } from '@/lib/db';
import { conditionLabel, formatIdentifier, identifierKindForItem, primaryIdentifier } from '@/lib/inventoryDisplay';
import {
  nextRepairStatus,
  prevRepairStatus,
  REPAIR_FLOW,
  REPAIR_STATUS_LABEL,
  repairFlowIndex,
} from '@/lib/repair';
import { cn, formatCurrency } from '@/lib/utils';
import { modalSheetBodyScroll, modalSheetPanelMd } from '@/lib/modalSheet';
import type { DeviceCondition, InventoryItem, RepairRecord } from '@/types';

const CONDITION_LABELS: Record<DeviceCondition, string> = {
  working: 'Working',
  minor_faults: 'Minor faults',
  major_faults: 'Major faults',
  not_working: 'Not working',
};

const STATUS_BADGE: Record<RepairRecord['repair_status'], string> = {
  sent: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  in_progress: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  collected: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-400',
};

type RepairDetailModalProps = {
  record: RepairRecord;
  item?: InventoryItem;
  onClose: () => void;
};

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="shrink-0 text-shell-muted">{label}</span>
      <span className={cn('text-right text-shell-ink', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  );
}

export default function RepairDetailModal({ record, item, onClose }: RepairDetailModalProps) {
  const { updateRepairStatus, markCollected, updateRepairCollectedDate } = useRepairActions();
  const liveRecord = useLiveQuery(() => db.repair_records.get(record.id), [record.id]) ?? record;

  const [collecting, setCollecting] = useState(false);
  const [condition, setCondition] = useState<DeviceCondition>('working');
  const [notes, setNotes] = useState(liveRecord.notes ?? '');
  const [collectDate, setCollectDate] = useState(toLocalDatetimeValue(new Date()));
  const [collectedDate, setCollectedDate] = useState(
    liveRecord.date_returned ? toLocalDatetimeValue(new Date(liveRecord.date_returned)) : toLocalDatetimeValue(new Date()),
  );
  const [busy, setBusy] = useState(false);

  const idx = repairFlowIndex(liveRecord.repair_status);
  const isCollected = liveRecord.repair_status === 'collected';
  const isReady = liveRecord.repair_status === 'completed';
  const next = nextRepairStatus(liveRecord.repair_status);
  const prev = prevRepairStatus(liveRecord.repair_status);

  useEffect(() => {
    if (isCollected && liveRecord.date_returned) {
      setCollectedDate(toLocalDatetimeValue(new Date(liveRecord.date_returned)));
    }
    setNotes(liveRecord.notes ?? '');
  }, [isCollected, liveRecord.date_returned, liveRecord.notes]);

  const itemTitle = item ? `${item.brand} ${item.name}`.trim() : 'Repair job';
  const idCode = item ? primaryIdentifier(item) : undefined;
  const idKind = item ? identifierKindForItem(item) : null;

  const advance = async () => {
    if (!next || next === 'collected') return;
    setBusy(true);
    try {
      await updateRepairStatus(liveRecord.id, next);
    } finally {
      setBusy(false);
    }
  };

  const stepBack = async () => {
    if (!prev || prev === 'collected') return;
    setBusy(true);
    try {
      await updateRepairStatus(liveRecord.id, prev);
    } finally {
      setBusy(false);
    }
  };

  const handleCollect = async () => {
    setBusy(true);
    try {
      await markCollected(
        liveRecord.id,
        liveRecord.item_id,
        condition,
        notes || undefined,
        new Date(collectDate).toISOString(),
      );
      toast.success('Item returned to stock');
      setCollecting(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not mark collected');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCollectedDate = async () => {
    setBusy(true);
    try {
      await updateRepairCollectedDate(liveRecord.id, new Date(collectedDate).toISOString(), notes || undefined);
      toast.success('Collection date updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update collection date');
    } finally {
      setBusy(false);
    }
  };

  const openCollectForm = () => {
    setCollectDate(toLocalDatetimeValue(new Date()));
    setCollecting(true);
  };

  return (
    <ModalSheetPortal>
      <ModalSheetFrame onClose={onClose} panelClassName={modalSheetPanelMd} backdropClassName="bg-black/70">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-shell-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-shell-ink">{itemTitle}</h2>
            <p className="mt-0.5 text-xs text-shell-muted">{liveRecord.engineer_name}</p>
          </div>
          <ModalSheetClose onClick={onClose} />
        </div>

        <div className={cn(modalSheetBodyScroll, 'px-5 py-4')}>
          {item ? (
            <div className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 p-3">
              <CategoryThumb category={item.category} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-shell-ink">{itemTitle}</p>
                {idCode && idKind ? (
                  <p className="mt-0.5 font-mono text-[11px] text-shell-muted">
                    {idKind}: {formatIdentifier(idCode, idKind)}
                  </p>
                ) : null}
                {item.condition ? (
                  <p className="text-xs text-shell-muted">{conditionLabel(item.condition)}</p>
                ) : null}
              </div>
              {(liveRecord.repair_cost ?? 0) > 0 ? (
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-shell-ink">
                  {formatCurrency(liveRecord.repair_cost!)}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-0">
            {REPAIR_FLOW.map((step, i) => {
              const active = i <= idx;
              const done = i < idx || isCollected;
              return (
                <div key={step} className="contents">
                  <div className="flex shrink-0 flex-col items-center">
                    <span
                      className={cn(
                        'grid size-[22px] place-items-center rounded-full border text-[10px]',
                        active
                          ? 'border-violet-400/50 bg-violet-400 text-[#160a2e]'
                          : 'border-shell-line bg-shell-surface-2 text-shell-muted',
                      )}
                    >
                      {done ? <Check size={12} strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                  </div>
                  {i < REPAIR_FLOW.length - 1 ? (
                    <span
                      className={cn('h-0.5 min-w-[12px] flex-1', i < idx ? 'bg-violet-400/70' : 'bg-shell-line')}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge className={STATUS_BADGE[liveRecord.repair_status]}>
              {REPAIR_STATUS_LABEL[liveRecord.repair_status]}
            </Badge>
          </div>

          <div className="mt-4 divide-y divide-shell-line rounded-lg border border-shell-line">
            <DetailRow label="Issue" value={liveRecord.issue_description} />
            <DetailRow label="Sent" value={new Date(liveRecord.date_sent).toLocaleDateString('en-NG')} />
            {liveRecord.expected_return_date ? (
              <DetailRow
                label="Expected back"
                value={new Date(liveRecord.expected_return_date).toLocaleDateString('en-NG')}
              />
            ) : null}
            {isCollected && liveRecord.date_returned ? (
              <DetailRow
                label="Collected"
                value={new Date(liveRecord.date_returned).toLocaleString('en-NG')}
              />
            ) : null}
            {liveRecord.engineer_phone ? <DetailRow label="Shop phone" value={liveRecord.engineer_phone} mono /> : null}
            {(liveRecord.repair_cost ?? 0) > 0 ? (
              <DetailRow label="Quoted cost" value={formatCurrency(liveRecord.repair_cost!)} mono />
            ) : null}
          </div>

          {isCollected ? (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3.5">
              <div className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-sm leading-relaxed text-shell-ink">Item returned to stock. Adjust the collection date if it was recorded wrong.</p>
              </div>
              <DateTimeField
                id="collected_date"
                label="Collection date"
                value={collectedDate}
                onChange={setCollectedDate}
              />
              <div>
                <label className="mb-1.5 block text-xs text-shell-muted">Notes</label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="shell-inset-field min-h-0 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-sm text-shell-ink outline-none placeholder:text-shell-muted"
                  placeholder="Optional notes on return…"
                />
              </div>
              <Button
                className="w-full bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                onClick={handleSaveCollectedDate}
                disabled={busy}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                Save collection date
              </Button>
            </div>
          ) : collecting ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-shell-muted">Return to stock</p>
              <DateTimeField
                id="collect_date"
                label="Collection date"
                hint="Use the actual day the customer or shop collected the device."
                value={collectDate}
                onChange={setCollectDate}
              />
              <div>
                <label className="mb-1.5 block text-xs text-shell-muted">Updated condition</label>
                <Select value={condition} onValueChange={v => setCondition(v as DeviceCondition)}>
                  <SelectTrigger className="w-full border-shell-line bg-shell-surface-2/40 text-shell-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CONDITION_LABELS) as [DeviceCondition, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-shell-muted">Notes</label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="shell-inset-field min-h-0 w-full rounded-lg border border-shell-line bg-shell-surface-2/40 px-3 py-2 text-sm text-shell-ink outline-none placeholder:text-shell-muted"
                  placeholder="Optional notes on return…"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                  onClick={() => setCollecting(false)}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                  onClick={handleCollect}
                  disabled={busy}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                  Mark collected
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex gap-2">
                <a
                  href={liveRecord.engineer_phone ? `tel:${liveRecord.engineer_phone}` : undefined}
                  className={cn('flex-1', !liveRecord.engineer_phone && 'pointer-events-none opacity-50')}
                >
                  <Button
                    variant="outline"
                    className="w-full border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                  >
                    <Phone size={16} /> Call shop
                  </Button>
                </a>
                {isReady ? (
                  <Button
                    className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                    onClick={openCollectForm}
                  >
                    <Wrench size={16} /> Collect
                  </Button>
                ) : next && next !== 'collected' ? (
                  <Button
                    className="flex-1 bg-violet-400 text-[#160a2e] hover:bg-violet-300"
                    onClick={advance}
                    disabled={busy}
                  >
                    Move to {REPAIR_STATUS_LABEL[next]}
                  </Button>
                ) : null}
              </div>
              {prev && prev !== 'collected' ? (
                <button
                  type="button"
                  onClick={stepBack}
                  disabled={busy}
                  className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-shell-muted transition-colors hover:text-shell-ink disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Back to {REPAIR_STATUS_LABEL[prev]}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </ModalSheetFrame>
    </ModalSheetPortal>
  );
}
