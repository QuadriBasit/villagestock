import { useState, lazy, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, ShoppingCart, ChevronDown, Receipt as ReceiptIcon } from 'lucide-react';
import { useSalesActions } from '@/hooks/useSalesActions';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { useCreditActions } from '@/hooks/useCreditActions';
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
    handleSubmit,
    watch,
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
    'w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition bg-white';
  const labelClass = 'block text-sm font-medium text-dark mb-1';
  const readonlyClass =
    'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-surface text-muted cursor-not-allowed';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-teal" />
            <h2 className="font-heading font-bold text-dark text-base">Record Sale</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-border text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
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
          {/* Item snapshot */}
          <section className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Item</h3>

            <div className={readonlyClass}>{item.name}</div>

            <div className="flex gap-2 flex-wrap text-xs text-muted">
              <span className="bg-surface border border-border rounded-full px-2 py-0.5 capitalize">{item.category}</span>
              <span className="bg-surface border border-border rounded-full px-2 py-0.5">{item.brand}</span>
              {isSerialized ? (
                <span className="bg-teal/10 text-teal border border-teal/20 rounded-full px-2 py-0.5">
                  Serialized unit
                </span>
              ) : (
                <span className="bg-surface border border-border rounded-full px-2 py-0.5">
                  {item.quantity} in stock
                </span>
              )}
            </div>

            {/* Serialized identifiers */}
            {isSerialized && (item.serial_number || item.imei) && (
              <div className="flex flex-wrap gap-2">
                {item.serial_number && (
                  <span className="text-[10px] font-mono text-muted bg-surface border border-border px-2 py-0.5 rounded">
                    S/N: {item.serial_number}
                  </span>
                )}
                {item.imei && (
                  <span className="text-[10px] font-mono text-muted bg-surface border border-border px-2 py-0.5 rounded">
                    IMEI: {item.imei}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Sale details */}
          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Sale Details</h3>

            <div>
              <label className={labelClass} htmlFor="sale_price">
                Sale Price (₦) *
                <span className="ml-2 text-muted font-normal text-xs">
                  Listed: {formatCurrency(item.price)}
                </span>
              </label>
              <input
                id="sale_price"
                type="number"
                inputMode="decimal"
                {...register('sale_price')}
                className={fieldClass}
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
                <select
                  id="payment_method"
                  {...register('payment_method')}
                  className={`${fieldClass} appearance-none pr-8`}
                >
                  {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
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
              <label className={labelClass} htmlFor="sold_at">Date &amp; Time *</label>
              <input
                id="sold_at"
                type="datetime-local"
                {...register('sold_at')}
                className={fieldClass}
              />
            </div>
          </section>

          {/* Customer (optional) */}
          <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
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

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-white">
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
  );
}
