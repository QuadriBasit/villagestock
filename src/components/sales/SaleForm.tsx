import { useState, lazy, Suspense } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, ShoppingCart, Receipt as ReceiptIcon } from 'lucide-react';
import { useSalesActions } from '@/hooks/useSalesActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { useCreditActions } from '@/hooks/useCreditActions';
import {
  modalSheetBackdrop,
  modalSheetBodyScroll,
  modalSheetFooter,
  modalSheetHandle,
  modalSheetHeader,
  modalSheetPanelMd,
} from '@/lib/modalSheet';
import { ModalSheetPortal } from '@/components/ui/ModalSheetPortal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem, PaymentMethod, PaymentStatus, SalesRecord } from '@/types';

const ReceiptModal = lazy(() => import('./ReceiptModal'));

const schema = z.object({
  sale_price: z.coerce.number().positive('Sale price must be greater than 0'),
  payment_status: z.enum(['paid', 'credit']),
  payment_method: z.enum(['cash', 'bank_transfer', 'pos']).optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  amount_paid: z.coerce.number().min(0).optional(),
  due_date: z.string().optional(),
  sold_at: z.string().min(1),
  quantity_sold: z.coerce.number().int().positive().optional(),
});
type FormData = z.infer<typeof schema>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  pos: 'POS / Card',
};

interface SaleFormProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse `sold_at` (`YYYY-MM-DDTHH:mm`) for split date / time inputs. */
function parseSoldAtLocal(iso: string | undefined): { date: string; time: string } {
  const base = (iso?.trim() || toLocalDatetimeValue(new Date())).slice(0, 16);
  const t = base.indexOf('T');
  if (t === -1) {
    const d = base.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return { date: d, time: '12:00' };
  }
  const date = base.slice(0, t);
  const timeRaw = base.slice(t + 1);
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : '12:00';
  return { date, time };
}

const itemMetaPill =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium';
const itemPillNeutral = `${itemMetaPill} border-zinc-200/90 bg-zinc-100/90 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300`;
const itemPillTeal = `${itemMetaPill} border-teal/30 bg-teal/10 text-teal dark:border-teal/35 dark:bg-teal/15 dark:text-teal`;
const itemPillMono = `${itemMetaPill} border-zinc-200/90 bg-zinc-100/90 font-mono text-[10px] tracking-tight text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400`;

/** Match `SelectTrigger` height/shape for native date/time pickers. */
const dateTimeInputClass =
  'h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm shadow-zinc-900/[0.04] transition [color-scheme:light] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 dark:[color-scheme:dark] dark:focus:ring-primary/30';

export default function SaleForm({ item, onClose, onSuccess }: SaleFormProps) {
  const { recordSale } = useSalesActions();
  const { createCreditRecord } = useCreditActions();
  const tradingGate = useTradingGateState();
  const [completedSale, setCompletedSale] = useState<SalesRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSerialized = item.mode === 'serialized';

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      sale_price: item.price,
      payment_status: 'paid',
      payment_method: 'cash',
      amount_paid: 0,
      sold_at: toLocalDatetimeValue(new Date()),
      quantity_sold: 1,
    },
  });

  const salePrice = watch('sale_price') ?? item.price;
  const qtySold = isSerialized ? 1 : (watch('quantity_sold') ?? 1);
  const paymentStatus = watch('payment_status') as PaymentStatus;
  const amountPaid = watch('amount_paid') ?? 0;
  const unitProfit = salePrice - (item.cost_price ?? 0);
  const hasProfit = item.cost_price != null && item.cost_price > 0;
  const totalAmount = salePrice * qtySold;
  const balanceOwed = Math.max(0, totalAmount - amountPaid);
  const soldAtRaw = watch('sold_at');
  const { date: saleDateStr, time: saleTimeStr } = parseSoldAtLocal(soldAtRaw);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    if (data.payment_status === 'credit' && (!data.customer_name || !data.customer_phone || !data.due_date)) {
      return;
    }
    try {
    const sale = await recordSale({
      item_id: item.id,
      item_name: item.name,
      item_category: item.category,
      item_brand: item.brand,
      item_mode: item.mode,
      serial_number: item.serial_number,
      imei: item.imei,
      device_details: item.deviceDetails,
      sale_price: data.sale_price,
      cost_price: item.cost_price ?? 0,
      profit: (data.sale_price - (item.cost_price ?? 0)) * qtySold,
      payment_method: data.payment_status === 'paid' ? data.payment_method : data.payment_method || undefined,
      payment_status: data.payment_status,
      amount_paid: data.payment_status === 'credit' ? (data.amount_paid ?? 0) : totalAmount,
      balance_owed: data.payment_status === 'credit' ? balanceOwed : 0,
      due_date: data.payment_status === 'credit' && data.due_date ? new Date(data.due_date).toISOString() : undefined,
      customer_name: data.customer_name || undefined,
      customer_phone: data.customer_phone || undefined,
      quantity_sold: qtySold,
      sold_at: new Date(data.sold_at).toISOString(),
    });
    if (data.payment_status === 'credit') {
      await createCreditRecord({
        sale_id: sale.id,
        customer_name: data.customer_name!,
        customer_phone: data.customer_phone!,
        item_name: item.name,
        total_amount: totalAmount,
        amount_paid: data.amount_paid ?? 0,
        due_date: new Date(data.due_date!).toISOString(),
        payments: data.amount_paid && data.amount_paid > 0
          ? [{ amount: data.amount_paid, date: new Date(data.sold_at).toISOString(), method: data.payment_method }]
          : [],
        notes: undefined,
      });
    }
    setCompletedSale(sale);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not record sale');
    }
  };

  const tradeLocked =
    tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
  const canSell =
    !tradeLocked && (isSerialized ? item.status === 'in_stock' : item.quantity > 0);

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';
  const readonlyClass =
    'w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400';

  return (
    <ModalSheetPortal>
    <div className={modalSheetBackdrop} onClick={onClose}>
      <div className={modalSheetPanelMd} onClick={e => e.stopPropagation()}>
        <div className={modalSheetHandle}>
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className={modalSheetHeader}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-teal" />
            <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-50">Record Sale</h2>
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
          {tradeLocked && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
              {tradingGate.message}
            </p>
          )}
          {submitError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {submitError}
            </p>
          )}
          {/* Item snapshot */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/35">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Item
            </h3>
            <p className="mt-2 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
              {item.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`${itemPillNeutral} capitalize`}>{item.category}</span>
              <span className={itemPillNeutral}>{item.brand}</span>
              {isSerialized ? (
                <span className={itemPillTeal}>Serialized unit</span>
              ) : (
                <span className={itemPillNeutral}>{item.quantity} in stock</span>
              )}
              {isSerialized && item.imei && (
                <span className={itemPillMono} title="IMEI">
                  IMEI {item.imei}
                </span>
              )}
              {isSerialized && item.serial_number && (
                <span className={itemPillMono} title="Serial number">
                  S/N {item.serial_number}
                </span>
              )}
            </div>
          </section>

          {/* Sale details */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-white/10 space-y-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Sale Details</h3>

            <div>
              <label className={labelClass} htmlFor="sale_price">
                Sale Price (₦) *
                <span className="ml-2 text-muted font-normal text-xs">
                  Listed: {formatCurrency(item.price)}
                </span>
              </label>
              <Controller
                name="sale_price"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="sale_price"
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    className={fieldClass}
                    aria-invalid={!!errors.sale_price}
                  />
                )}
              />
              {errors.sale_price && (
                <p className="text-red-500 text-xs mt-1">{errors.sale_price.message}</p>
              )}
              {hasProfit && (
                <p className={`text-xs mt-1 font-medium ${unitProfit >= 0 ? 'text-teal' : 'text-red-500'}`}>
                  {unitProfit >= 0 ? 'Profit' : 'Loss'}: {formatCurrency(Math.abs(unitProfit))}
                  {!isSerialized && qtySold > 1 ? ` × ${qtySold} = ${formatCurrency(Math.abs(unitProfit) * qtySold)}` : ''}
                </p>
              )}
            </div>

            {/* Quantity — only for non-serialized */}
            {!isSerialized && (
              <div>
                <label className={labelClass} htmlFor="quantity_sold">Quantity *</label>
                <input
                  id="quantity_sold"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={item.quantity}
                  {...register('quantity_sold')}
                  className={fieldClass}
                />
                {errors.quantity_sold && (
                  <p className="text-red-500 text-xs mt-1">{errors.quantity_sold.message}</p>
                )}
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="payment_status">Payment Status *</label>
              <Controller
                name="payment_status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="payment_status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="payment_method">Payment Method *</label>
              <Controller
                name="payment_method"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? 'cash'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="payment_method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>
                          {lbl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {paymentStatus === 'credit' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="amount_paid">Amount Paid So Far</label>
                    <Controller
                      name="amount_paid"
                      control={control}
                      render={({ field }) => (
                        <CurrencyInput
                          id="amount_paid"
                          ref={field.ref}
                          value={field.value ?? 0}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Balance Owed</label>
                    <div className={readonlyClass}>{formatCurrency(balanceOwed)}</div>
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="due_date">Due Date *</label>
                  <input id="due_date" type="date" {...register('due_date')} className={fieldClass} />
                </div>
              </>
            )}

            <div>
              <span className={labelClass}>Date &amp; time of sale *</span>
              <p className="mb-3 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Uses your device&apos;s local timezone. You can set date and time separately.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    htmlFor="sold_at_date"
                  >
                    Date
                  </label>
                  <input
                    id="sold_at_date"
                    type="date"
                    value={saleDateStr}
                    onChange={e => {
                      const { time } = parseSoldAtLocal(getValues('sold_at'));
                      setValue('sold_at', `${e.target.value}T${time}`, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className={dateTimeInputClass}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    htmlFor="sold_at_time"
                  >
                    Time
                  </label>
                  <input
                    id="sold_at_time"
                    type="time"
                    value={saleTimeStr}
                    onChange={e => {
                      const { date } = parseSoldAtLocal(getValues('sold_at'));
                      setValue('sold_at', `${date}T${e.target.value}`, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className={dateTimeInputClass}
                    autoComplete="off"
                  />
                </div>
              </div>
              {errors.sold_at && (
                <p className="mt-1 text-xs text-red-500">{errors.sold_at.message}</p>
              )}
            </div>
          </section>

          {/* Customer (optional) */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-white/10 space-y-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Customer <span className="normal-case font-normal">{paymentStatus === 'credit' ? '(required for credit)' : '(optional)'}</span>
            </h3>
            <div>
              <label className={labelClass} htmlFor="customer_name">Customer Name</label>
              <input id="customer_name" type="text" {...register('customer_name')} placeholder="e.g. Emeka Obi" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="customer_phone">Phone Number</label>
              <input id="customer_phone" type="tel" inputMode="tel" {...register('customer_phone')} placeholder="e.g. 08012345678" className={fieldClass} />
            </div>
          </section>
        </div>

        <div className={modalSheetFooter}>
          {completedSale ? (
            <div className="space-y-2">
              <p className="text-center text-sm font-medium text-teal mb-1">
                ✓ Sale recorded — {completedSale.receipt_number}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onSuccess}
                  className="flex-1 border border-border text-muted rounded-xl py-3 text-sm font-medium hover:bg-surface transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => setShowReceipt(true)}
                  className="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors"
                >
                  <ReceiptIcon size={16} /> View Receipt
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || !canSell}
              className="w-full bg-teal text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-teal-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Recording…</>
                : !canSell
                ? tradeLocked
                  ? tradingGate.message
                  : isSerialized
                    ? `Unit is ${item.status}`
                    : 'Out of Stock'
                : <><ShoppingCart size={16} /> Confirm Sale</>
              }
            </button>
          )}
        </div>
      </div>

      {completedSale && showReceipt && (
        <Suspense fallback={null}>
          <ReceiptModal sale={completedSale} onClose={() => setShowReceipt(false)} />
        </Suspense>
      )}
    </div>
    </ModalSheetPortal>
  );
}
