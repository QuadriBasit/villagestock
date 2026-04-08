import { useState, lazy, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRightLeft, ChevronDown, Loader2, Receipt as ReceiptIcon, X } from 'lucide-react';
import { useSwapActions } from '@/hooks/useSwapActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { useCreditActions } from '@/hooks/useCreditActions';
import { formatCurrency } from '@/lib/utils';
import type { DeviceCondition, InventoryItem, PaymentMethod, PaymentStatus, SalesRecord } from '@/types';

const ReceiptModal = lazy(() => import('./ReceiptModal'));

const schema = z.object({
  incoming_brand: z.string().min(1, 'Brand is required'),
  incoming_model: z.string().min(1, 'Model is required'),
  incoming_imei: z.string().optional(),
  incoming_serial_number: z.string().optional(),
  condition: z.enum(['working', 'minor_faults', 'major_faults', 'not_working']),
  trade_in_value: z.coerce.number().min(0, 'Trade-in value must be 0 or more'),
  sale_price: z.coerce.number().positive('Sale price must be greater than 0'),
  payment_status: z.enum(['paid', 'credit']),
  payment_method: z.enum(['cash', 'bank_transfer', 'pos']).optional(),
  amount_paid: z.coerce.number().min(0).optional(),
  due_date: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  date: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

const CONDITION_LABELS: Record<DeviceCondition, string> = {
  working: 'Working',
  minor_faults: 'Minor Faults',
  major_faults: 'Major Faults',
  not_working: 'Not Working',
};

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SwapForm({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { processSwap } = useSwapActions();
  const { createCreditRecord } = useCreditActions();
  const tradingGate = useTradingGateState();
  const [completedSale, setCompletedSale] = useState<SalesRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      condition: 'working',
      trade_in_value: 0,
      sale_price: item.price,
      payment_status: 'paid',
      payment_method: 'cash',
      amount_paid: 0,
      date: toLocalDatetimeValue(new Date()),
    },
  });

  const salePrice = watch('sale_price') ?? item.price;
  const tradeInValue = watch('trade_in_value') ?? 0;
  const paymentStatus = watch('payment_status') as PaymentStatus;
  const amountPaid = watch('amount_paid') ?? 0;
  const balance = salePrice - tradeInValue;
  const balanceOwed = Math.max(0, balance - amountPaid);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
    const sale = await processSwap({
      outgoingItem: item,
      incoming: {
        brand: data.incoming_brand,
        model: data.incoming_model,
        imei: data.incoming_imei || undefined,
        serial_number: data.incoming_serial_number || undefined,
        condition: data.condition,
        trade_in_value: data.trade_in_value,
      },
      sale_price: data.sale_price,
      payment_method: data.payment_status === 'paid' ? data.payment_method : data.payment_method || undefined,
      payment_status: data.payment_status,
      amount_paid: data.payment_status === 'credit' ? (data.amount_paid ?? 0) : Math.max(0, balance),
      due_date: data.payment_status === 'credit' && data.due_date ? new Date(data.due_date).toISOString() : undefined,
      customer_name: data.customer_name || undefined,
      customer_phone: data.customer_phone || undefined,
      date: new Date(data.date).toISOString(),
    });
    if (data.payment_status === 'credit') {
      await createCreditRecord({
        sale_id: sale.id,
        customer_name: data.customer_name!,
        customer_phone: data.customer_phone!,
        item_name: `${item.brand} ${item.name}`,
        total_amount: Math.max(0, balance),
        amount_paid: data.amount_paid ?? 0,
        due_date: new Date(data.due_date!).toISOString(),
        payments: data.amount_paid && data.amount_paid > 0
          ? [{ amount: data.amount_paid, date: new Date(data.date).toISOString(), method: data.payment_method }]
          : [],
        notes: 'Swap credit',
      });
    }

    setCompletedSale(sale);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Swap failed');
    }
  };

  const tradeLocked =
    tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
  const canSwap = item.status === 'in_stock' && !tradeLocked;

  const fieldClass =
    'w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition bg-white';
  const labelClass = 'block text-sm font-medium text-dark mb-1';
  const readonlyClass =
    'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-surface text-muted cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-primary" />
            <h2 className="font-heading font-bold text-dark text-base">Device Swap / Trade-In</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-border text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
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
          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Incoming Device</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="incoming_brand">Brand *</label>
                <input id="incoming_brand" {...register('incoming_brand')} className={fieldClass} placeholder="Samsung" />
                {errors.incoming_brand && <p className="text-red-500 text-xs mt-1">{errors.incoming_brand.message}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor="incoming_model">Model *</label>
                <input id="incoming_model" {...register('incoming_model')} className={fieldClass} placeholder="Galaxy S21" />
                {errors.incoming_model && <p className="text-red-500 text-xs mt-1">{errors.incoming_model.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="incoming_imei">IMEI</label>
                <input id="incoming_imei" {...register('incoming_imei')} className={fieldClass} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass} htmlFor="incoming_serial_number">Serial Number</label>
                <input id="incoming_serial_number" {...register('incoming_serial_number')} className={fieldClass} placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="condition">Condition *</label>
                <div className="relative">
                  <select id="condition" {...register('condition')} className={`${fieldClass} appearance-none pr-8`}>
                    {(Object.entries(CONDITION_LABELS) as [DeviceCondition, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="trade_in_value">Trade-In Value (₦) *</label>
                <input id="trade_in_value" type="number" inputMode="decimal" {...register('trade_in_value')} className={fieldClass} />
                {errors.trade_in_value && <p className="text-red-500 text-xs mt-1">{errors.trade_in_value.message}</p>}
              </div>
            </div>

            <p className="text-xs text-muted bg-surface rounded-lg px-3 py-2 border border-border">
              Incoming device category will match the selected outgoing item category: <span className="font-medium capitalize">{item.category}</span>.
            </p>
          </section>

          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Outgoing Device</h3>
            <div className={readonlyClass}>{item.brand} {item.name}</div>
            <div className="flex gap-2 flex-wrap text-xs text-muted">
              <span className="bg-surface border border-border rounded-full px-2 py-0.5 capitalize">{item.category}</span>
              {item.serial_number && <span className="bg-surface border border-border rounded-full px-2 py-0.5 font-mono">S/N: {item.serial_number}</span>}
              {item.imei && <span className="bg-surface border border-border rounded-full px-2 py-0.5 font-mono">IMEI: {item.imei}</span>}
            </div>
            <div>
              <label className={labelClass} htmlFor="sale_price">Sale Price (₦) *</label>
              <input id="sale_price" type="number" inputMode="decimal" {...register('sale_price')} className={fieldClass} />
              {errors.sale_price && <p className="text-red-500 text-xs mt-1">{errors.sale_price.message}</p>}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Settlement</h3>

            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              {balance >= 0 ? (
                <>
                  <div className="text-xs text-muted">Balance to pay</div>
                  <div className="font-heading text-2xl font-bold text-primary">{formatCurrency(balance)}</div>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted">Credit to customer</div>
                  <div className="font-heading text-2xl font-bold text-accent">{formatCurrency(Math.abs(balance))}</div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="payment_status">Payment Status *</label>
                <div className="relative">
                  <select id="payment_status" {...register('payment_status')} className={`${fieldClass} appearance-none pr-8`}>
                    <option value="paid">Paid</option>
                    <option value="credit">Credit</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="payment_method">Payment Method *</label>
                <div className="relative">
                  <select id="payment_method" {...register('payment_method')} className={`${fieldClass} appearance-none pr-8`}>
                    {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {paymentStatus === 'credit' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="amount_paid">Amount Paid So Far</label>
                    <input id="amount_paid" type="number" inputMode="decimal" {...register('amount_paid')} className={fieldClass} />
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
              <label className={labelClass} htmlFor="date">Date &amp; Time *</label>
              <input id="date" type="datetime-local" {...register('date')} className={fieldClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="customer_name">Customer Name</label>
                <input id="customer_name" {...register('customer_name')} className={fieldClass} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass} htmlFor="customer_phone">Customer Phone</label>
                <input id="customer_phone" {...register('customer_phone')} className={fieldClass} placeholder="Optional" />
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border bg-white">
          {completedSale ? (
            <div className="space-y-2">
              <p className="text-center text-sm font-medium text-teal mb-1">
                ✓ Swap recorded — {completedSale.receipt_number}
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
              disabled={isSubmitting || !canSwap}
              className="w-full bg-primary text-white rounded-xl py-3.5 font-heading font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" /> Processing…</>
              ) : !canSwap ? (
                tradeLocked ? tradingGate.message : `Status: ${item.status ?? 'unknown'}`
              ) : (
                <><ArrowRightLeft size={16} /> Confirm Swap</>
              )}
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
  );
}
