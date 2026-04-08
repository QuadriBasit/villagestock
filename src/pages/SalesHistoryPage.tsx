import { useState, lazy, Suspense } from 'react';
import { useSalesHistory } from '@/hooks/useSales';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ShoppingCart, TrendingUp, CreditCard, Banknote, Smartphone, Receipt as ReceiptIcon, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { PaymentMethod, SalesRecord } from '@/types';

const ReceiptModal = lazy(() => import('@/components/sales/ReceiptModal'));
const ReturnForm = lazy(() => import('@/components/sales/ReturnForm'));

const PAYMENT_ICONS: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote size={14} />,
  bank_transfer: <CreditCard size={14} />,
  pos: <Smartphone size={14} />,
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

// Group sales by calendar date string
function groupByDate(sales: SalesRecord[]): { date: string; records: SalesRecord[] }[] {
  const map = new Map<string, SalesRecord[]>();
  for (const sale of sales) {
    const key = sale.sold_at.slice(0, 10); // "YYYY-MM-DD"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sale);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, records]) => ({ date, records }));
}

function friendlyDate(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (isoDate === today) return 'Today';
  if (isoDate === yesterday) return 'Yesterday';
  return formatDate(isoDate + 'T00:00:00');
}

export default function SalesHistoryPage() {
  const { sales, isLoading } = useSalesHistory();
  const [receiptSale, setReceiptSale] = useState<SalesRecord | null>(null);
  const [returnSale, setReturnSale] = useState<SalesRecord | null>(null);

  if (isLoading) return <AlertsSkeletonList />;

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-3">
          <ShoppingCart size={28} className="text-teal" />
        </div>
        <h2 className="font-heading font-semibold text-dark text-lg">No sales yet</h2>
        <p className="text-muted text-sm mt-1">Sales you record will appear here</p>
      </div>
    );
  }

  const groups = groupByDate(sales);

  // All-time totals
  const allRevenue = sales.reduce((s, r) => s + r.sale_price * r.quantity_sold, 0);
  const allProfit = sales.reduce((s, r) => s + r.profit, 0);

  return (
    <div className="app-page py-5 md:py-8 space-y-5">
      {/* All-time summary banner */}
      <div className="bg-linear-to-br from-teal to-teal-dark text-white rounded-2xl px-5 py-4 shadow-md flex gap-6">
        <div>
          <div className="text-xs opacity-75 uppercase tracking-wider mb-0.5">Total Revenue</div>
          <div className="text-2xl font-heading font-bold">{formatCurrency(allRevenue)}</div>
        </div>
        <div className="border-l border-white/20 pl-6">
          <div className="text-xs opacity-75 uppercase tracking-wider mb-0.5">Total Profit</div>
          <div className="text-2xl font-heading font-bold">{formatCurrency(allProfit)}</div>
        </div>
        <TrendingUp size={20} className="ml-auto opacity-50 self-start mt-1" />
      </div>

      {/* Daily groups */}
      {groups.map(({ date, records }) => {
        const dayRevenue = records.reduce((s, r) => s + r.sale_price * r.quantity_sold, 0);
        const dayProfit = records.reduce((s, r) => s + r.profit, 0);

        return (
          <div key={date}>
            {/* Day header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-dark text-sm">
                {friendlyDate(date)}
                <span className="ml-2 text-muted font-normal text-xs">
                  {records.length} sale{records.length !== 1 ? 's' : ''}
                </span>
              </h3>
              <div className="text-right">
                <div className="text-sm font-semibold text-dark">{formatCurrency(dayRevenue)}</div>
                <div className={`text-xs font-medium ${dayProfit >= 0 ? 'text-teal' : 'text-red-500'}`}>
                  {dayProfit >= 0 ? '+' : ''}{formatCurrency(dayProfit)} profit
                </div>
              </div>
            </div>

            {/* Sale cards */}
            <div className="space-y-2">
              {records.map(record => (
                <SaleCard
                  key={record.id}
                  record={record}
                  onViewReceipt={() => setReceiptSale(record)}
                  onReturn={() => setReturnSale(record)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Receipt modal */}
      {receiptSale && (
        <Suspense fallback={null}>
          <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
        </Suspense>
      )}

      {/* Return form */}
      {returnSale && (
        <Suspense fallback={null}>
          <ReturnForm
            sale={returnSale}
            onClose={() => setReturnSale(null)}
            onSuccess={() => setReturnSale(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function SaleCard({ record, onViewReceipt, onReturn }: { record: SalesRecord; onViewReceipt: () => void; onReturn: () => void }) {
  const time = new Date(record.sold_at).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const hasCostData = record.cost_price > 0;

  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
          <ShoppingCart size={16} className="text-teal" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-dark text-sm truncate">{record.item_name}</div>
              <div className="text-xs text-muted capitalize">
                {record.item_brand} · {record.item_category}
              </div>
              {record.sale_type === 'swap' && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <ArrowRightLeft size={10} /> Swap
                </div>
              )}
              {record.payment_status === 'credit' && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Credit
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-dark">{formatCurrency(record.sale_price)}</div>
              {hasCostData && (
                <div className={`text-xs font-medium ${record.profit >= 0 ? 'text-teal' : 'text-red-500'}`}>
                  {record.profit >= 0 ? '+' : ''}{formatCurrency(record.profit)}
                </div>
              )}
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Payment method */}
            {record.payment_method && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                {PAYMENT_ICONS[record.payment_method]}
                {PAYMENT_LABELS[record.payment_method]}
              </span>
            )}

            {/* Time */}
            <span className="text-[10px] text-muted">{time}</span>

            {/* Serial / IMEI */}
            {record.serial_number && (
              <span className="text-[10px] text-muted font-mono bg-surface border border-border px-1.5 py-0.5 rounded">
                S/N: {record.serial_number}
              </span>
            )}
            {record.imei && (
              <span className="text-[10px] text-muted font-mono bg-surface border border-border px-1.5 py-0.5 rounded">
                IMEI: {record.imei}
              </span>
            )}

            {/* Customer */}
            {record.customer_name && (
              <span className="text-[10px] text-muted">
                {record.customer_name}
                {record.customer_phone ? ` · ${record.customer_phone}` : ''}
              </span>
            )}
            {record.sale_type === 'swap' && record.trade_in_item_name && (
              <span className="text-[10px] text-muted">
                Trade-in: {record.trade_in_item_brand ? `${record.trade_in_item_brand} ` : ''}{record.trade_in_item_name}
              </span>
            )}
          </div>

          {/* Receipt link + return */}
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted font-mono shrink-0">{record.receipt_number}</span>
            <div className="flex items-center gap-3">
              {record.returned ? (
                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  <RotateCcw size={10} /> Returned
                </span>
              ) : (
                <button
                  onClick={onReturn}
                  className="flex items-center gap-1 text-xs text-accent font-medium hover:underline"
                >
                  <RotateCcw size={12} /> Return
                </button>
              )}
              <button
                onClick={onViewReceipt}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                <ReceiptIcon size={12} /> Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
