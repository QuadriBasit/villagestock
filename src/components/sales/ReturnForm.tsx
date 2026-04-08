import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, RotateCcw, ChevronDown, Search } from 'lucide-react';
import { useReturnActions } from '@/hooks/useReturnActions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetFooter,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelMd,
} from '@/lib/modalSheet';
import { formatCurrency } from '@/lib/utils';
import type { SalesRecord, ReturnReason, ReturnType, InventoryItem } from '@/types';

const schema = z.object({
  reason: z.enum(['defective', 'changed_mind', 'wrong_item', 'other']),
  return_type: z.enum(['refund', 'exchange']),
  notes: z.string().optional(),
  refund_amount: z.coerce.number().min(0),
  returned_at: z.string().min(1),
  exchange_item_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const REASON_LABELS: Record<ReturnReason, string> = {
  defective: 'Defective / Faulty',
  changed_mind: 'Changed Mind',
  wrong_item: 'Wrong Item',
  other: 'Other',
};

const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
  refund: 'Refund',
  exchange: 'Exchange',
};

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ReturnFormProps {
  sale: SalesRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnForm({ sale, onClose, onSuccess }: ReturnFormProps) {
  const { processReturn } = useReturnActions();
  const { user } = useAuthStore();
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [selectedExchangeItem, setSelectedExchangeItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inventoryItems = useLiveQuery(async () => {
    if (!user) return [];
    return db.inventory_items
      .where('user_id')
      .equals(user.id)
      .filter(i => !i.deleted && i.quantity > 0)
      .toArray();
  }, [user?.id]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      reason: 'defective',
      return_type: 'refund',
      refund_amount: sale.sale_price,
      returned_at: toLocalDatetimeValue(new Date()),
    },
  });

  const returnType = watch('return_type');

  const filteredItems = (inventoryItems ?? []).filter(item => {
    if (!exchangeSearch.trim()) return true;
    const q = exchangeSearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.imei?.toLowerCase().includes(q)
    );
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    if (data.return_type === 'exchange' && !selectedExchangeItem) {
      setError('Please select the exchange item.');
      return;
    }
    try {
      await processReturn({
        sale_id: sale.id,
        item_id: sale.item_id,
        reason: data.reason,
        return_type: data.return_type,
        notes: data.notes || undefined,
        refund_amount: data.refund_amount,
        returned_at: new Date(data.returned_at).toISOString(),
        exchange_item_id: selectedExchangeItem?.id,
        exchange_item_name: selectedExchangeItem?.name,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process return.');
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';
  const readonlyClass =
    'w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400';

  const cardSection =
    'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-white/10';

  return (
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div className={modalSheetPanelMd} onClick={e => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className={modalSheetHeader}>
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-accent" />
            <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-50">Process Return</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`${modalSheetBodyScroll} space-y-5 bg-zinc-50/70 dark:bg-zinc-950/35`}>
          <section className={`${cardSection} space-y-2`}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Original Sale</h3>
            <div className={readonlyClass}>{sale.item_name}</div>
            <div className="flex gap-2 text-xs text-muted">
              <span className="bg-surface border border-border rounded-full px-2 py-0.5">{sale.receipt_number}</span>
              <span className="bg-surface border border-border rounded-full px-2 py-0.5">
                {formatCurrency(sale.sale_price)}
              </span>
              {sale.serial_number && (
                <span className="bg-surface border border-border rounded-full px-2 py-0.5 font-mono">
                  S/N: {sale.serial_number}
                </span>
              )}
            </div>
          </section>

          {/* Return details */}
          <section className={`${cardSection} space-y-4`}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Return Details</h3>

            <div>
              <label className={labelClass} htmlFor="reason">Reason *</label>
              <div className="relative">
                <select
                  id="reason"
                  {...register('reason')}
                  className={`${fieldClass} appearance-none pr-8`}
                >
                  {(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="return_type">Return Type *</label>
              <div className="relative">
                <select
                  id="return_type"
                  {...register('return_type')}
                  className={`${fieldClass} appearance-none pr-8`}
                  onChange={e => {
                    setValue('return_type', e.target.value as ReturnType);
                    setSelectedExchangeItem(null);
                    setExchangeSearch('');
                  }}
                >
                  {(Object.entries(RETURN_TYPE_LABELS) as [ReturnType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>

            {returnType === 'refund' && (
              <div>
                <label className={labelClass} htmlFor="refund_amount">Refund Amount (₦) *</label>
                <input
                  id="refund_amount"
                  type="number"
                  inputMode="decimal"
                  {...register('refund_amount')}
                  className={fieldClass}
                />
                {errors.refund_amount && (
                  <p className="text-red-500 text-xs mt-1">{errors.refund_amount.message}</p>
                )}
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="returned_at">Date &amp; Time *</label>
              <input
                id="returned_at"
                type="datetime-local"
                {...register('returned_at')}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="notes">Notes (optional)</label>
              <textarea
                id="notes"
                {...register('notes')}
                rows={2}
                placeholder="Any additional notes…"
                className={`${fieldClass} resize-none`}
              />
            </div>
          </section>

          {/* Exchange item picker */}
          {returnType === 'exchange' && (
            <section className={`${cardSection} space-y-3`}>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Exchange Item</h3>

              {selectedExchangeItem ? (
                <div className="flex items-center justify-between rounded-xl border border-teal/30 bg-teal/5 px-3 py-2.5 dark:border-teal/40 dark:bg-teal/10">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selectedExchangeItem.name}</p>
                    <p className="text-xs text-muted">{selectedExchangeItem.brand} · {formatCurrency(selectedExchangeItem.price)} · {selectedExchangeItem.quantity} in stock</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExchangeItem(null)}
                    className="p-1 rounded-full hover:bg-border text-muted"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Search by name, brand, IMEI…"
                      value={exchangeSearch}
                      onChange={e => setExchangeSearch(e.target.value)}
                      className={`${fieldClass} pl-8`}
                    />
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                      <p className="text-sm text-muted text-center py-3">No items found</p>
                    ) : (
                      filteredItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedExchangeItem(item)}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800/80"
                        >
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="text-xs text-muted">{item.brand} · {formatCurrency(item.price)} · {item.quantity} in stock</p>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              {error && returnType === 'exchange' && !selectedExchangeItem && (
                <p className="text-red-500 text-xs">{error}</p>
              )}
            </section>
          )}
        </div>

        <div className={modalSheetFooter}>
          {error && (returnType !== 'exchange' || selectedExchangeItem) && (
            <p className="text-red-500 text-xs mb-2">{error}</p>
          )}
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="w-full bg-accent text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-accent-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
              : <><RotateCcw size={16} /> Confirm Return</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
