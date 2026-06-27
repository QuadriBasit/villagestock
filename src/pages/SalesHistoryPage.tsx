import { useMemo, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalesHistory } from '@/hooks/useSales';
import { useOutstandingCreditsSummary } from '@/hooks/useCredits';
import { useShopAccess } from '@/context/ShopAccessContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Tag,
  ScanLine,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { PaymentMethod, SalesRecord } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const SaleDetailModal = lazy(() => import('@/components/sales/SaleDetailModal'));
const ReceiptModal = lazy(() => import('@/components/sales/ReceiptModal'));
const ReturnForm = lazy(() => import('@/components/sales/ReturnForm'));
const WarrantyLookupModal = lazy(() => import('@/components/sales/WarrantyLookupModal'));
const WarrantySlipModal = lazy(() => import('@/components/sales/WarrantySlipModal'));

type SalesTab = 'all' | 'paid' | 'owing';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

const TABLE_GRID =
  'grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.85fr)] gap-x-3 items-center';

const SALES_TABS: { value: SalesTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'owing', label: 'Owing' },
];

function isOwing(record: SalesRecord): boolean {
  return record.payment_status === 'credit' && (record.balance_owed ?? 0) > 0;
}

function isPaid(record: SalesRecord): boolean {
  return !isOwing(record);
}

function weekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d;
}

function saleDateLabel(iso: string): string {
  const dateKey = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const time = new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  if (dateKey === today) return `Today · ${time}`;
  if (dateKey === yesterday) return `Yesterday · ${time}`;
  return `${formatDate(iso)} · ${time}`;
}

function dueLabel(dueDate?: string): string | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days}d`;
}

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const { canViewProfit } = useShopAccess();
  const { sales, isLoading } = useSalesHistory();
  const { summary: creditsSummary } = useOutstandingCreditsSummary();
  const [tab, setTab] = useState<SalesTab>('all');
  const [detailSale, setDetailSale] = useState<SalesRecord | null>(null);
  const [receiptSale, setReceiptSale] = useState<SalesRecord | null>(null);
  const [warrantySale, setWarrantySale] = useState<SalesRecord | null>(null);
  const [returnSale, setReturnSale] = useState<SalesRecord | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);

  const weekSales = useMemo(() => {
    const start = weekStart();
    return sales.filter(s => new Date(s.sold_at) >= start);
  }, [sales]);

  const weekRevenue = weekSales.reduce((s, r) => s + r.sale_price * r.quantity_sold, 0);
  const weekProfit = weekSales.reduce((s, r) => s + r.profit, 0);
  const avgOrder = weekSales.length ? weekRevenue / weekSales.length : 0;

  const filtered = useMemo(() => {
    if (tab === 'paid') return sales.filter(isPaid);
    if (tab === 'owing') return sales.filter(isOwing);
    return sales;
  }, [sales, tab]);

  const openReceipt = (sale: SalesRecord) => {
    setDetailSale(null);
    setReceiptSale(sale);
  };

  const openWarranty = (sale: SalesRecord) => {
    setDetailSale(null);
    setWarrantySale(sale);
  };

  const openReturn = (sale: SalesRecord) => {
    setDetailSale(null);
    setReturnSale(sale);
  };

  if (isLoading) return <AlertsSkeletonList />;

  if (sales.length === 0) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-violet-400/10">
          <ShoppingCart size={28} className="text-violet-300" />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">No sales yet</h2>
        <p className="mt-1 text-sm text-shell-muted">Sales you record will appear here.</p>
        <Button className="mt-4 bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={() => navigate('/till')}>
          New sale
        </Button>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader title="Sales & orders" subtitle={`${weekSales.length} orders this week`}>
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => setLookupOpen(true)}
        >
          <ScanLine size={16} />
          IMEI lookup
        </Button>
        <Button size="sm" className="bg-violet-400 text-[#160a2e] hover:bg-violet-300" onClick={() => navigate('/till')}>
          <ShoppingCart size={16} />
          New sale
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Week revenue" value={formatCurrency(weekRevenue)} icon={ShoppingCart} />
        {canViewProfit ? (
          <StatCard
            label="Week profit"
            value={formatCurrency(weekProfit)}
            icon={TrendingUp}
            iconClassName="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          />
        ) : (
          <StatCard label="Week orders" value={String(weekSales.length)} icon={Tag} />
        )}
        <StatCard
          label="Outstanding"
          value={formatCurrency(creditsSummary.outstanding_amount)}
          icon={AlertTriangle}
          iconClassName="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
          hint={creditsSummary.overdue_count > 0 ? `${creditsSummary.overdue_count} overdue` : undefined}
          hintClassName="text-red-500 dark:text-red-400"
        />
        <StatCard label="Avg. order" value={formatCurrency(avgOrder)} icon={Tag} />
      </StatGrid>

      <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
        <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Sales filter">
          {SALES_TABS.map(t => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={cn(
                  'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'text-shell-ink after:absolute after:inset-x-3.5 after:bottom-0 after:h-px after:bg-shell-ink/70'
                    : 'text-shell-muted hover:text-shell-ink'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className={cn(
                TABLE_GRID,
                'border-b border-shell-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-shell-muted'
              )}
            >
              <span>Order</span>
              <span className="hidden sm:block">Items</span>
              <span>Customer</span>
              <span className="hidden md:block">Channel</span>
              <span>Total</span>
              <span>Status</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-shell-muted">
                No {tab === 'all' ? '' : tab} orders to show.
              </div>
            ) : (
              filtered.map(record => (
                <SalesRow
                  key={record.id}
                  record={record}
                  canViewProfit={canViewProfit}
                  onOpen={() => setDetailSale(record)}
                  onReturn={() => openReturn(record)}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      {detailSale ? (
        <Suspense fallback={null}>
          <SaleDetailModal
            sale={detailSale}
            canViewProfit={canViewProfit}
            onClose={() => setDetailSale(null)}
            onReceipt={openReceipt}
            onWarranty={openWarranty}
            onReturn={openReturn}
            onRecordPayment={() => navigate('/credits')}
          />
        </Suspense>
      ) : null}

      {lookupOpen ? (
        <Suspense fallback={null}>
          <WarrantyLookupModal
            open={lookupOpen}
            sales={sales}
            onClose={() => setLookupOpen(false)}
            onReceipt={openReceipt}
            onWarranty={openWarranty}
            onReturn={openReturn}
          />
        </Suspense>
      ) : null}

      {receiptSale ? (
        <Suspense fallback={null}>
          <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
        </Suspense>
      ) : null}

      {warrantySale ? (
        <Suspense fallback={null}>
          <WarrantySlipModal sale={warrantySale} onClose={() => setWarrantySale(null)} />
        </Suspense>
      ) : null}

      {returnSale ? (
        <Suspense fallback={null}>
          <ReturnForm sale={returnSale} onClose={() => setReturnSale(null)} onSuccess={() => setReturnSale(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}

function SalesRow({
  record,
  canViewProfit,
  onOpen,
  onReturn,
}: {
  record: SalesRecord;
  canViewProfit: boolean;
  onOpen: () => void;
  onReturn: () => void;
}) {
  const total = record.sale_price * record.quantity_sold;
  const owing = isOwing(record);
  const due = owing ? dueLabel(record.due_date) : null;
  const itemLine =
    record.quantity_sold > 1 ? `${record.quantity_sold}× ${record.item_name}` : record.item_name;

  return (
    <div
      className={cn(
        TABLE_GRID,
        'group cursor-pointer border-b border-shell-line/80 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-shell-surface-2/40'
      )}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="min-w-0">
        <div className="truncate font-mono text-sm font-semibold text-shell-ink">{record.receipt_number}</div>
        <div className="text-xs text-shell-muted">{saleDateLabel(record.sold_at)}</div>
        {record.sale_type === 'swap' && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-violet-300">
            <ArrowRightLeft size={10} /> Swap
          </span>
        )}
      </div>

      <div className="hidden min-w-0 truncate text-sm text-shell-muted sm:block">{itemLine}</div>

      <div className="min-w-0 truncate text-sm text-shell-ink">
        {record.customer_name || 'Walk-in'}
        {record.customer_phone ? (
          <span className="block truncate text-xs text-shell-muted">{record.customer_phone}</span>
        ) : null}
      </div>

      <div className="hidden md:block">
        {record.payment_method ? (
          <Badge className="border-shell-line bg-shell-surface-2 text-shell-muted">
            {PAYMENT_LABELS[record.payment_method]}
          </Badge>
        ) : (
          <span className="text-xs text-shell-muted">—</span>
        )}
      </div>

      <div>
        <div className="tabular-nums text-sm font-semibold text-shell-ink">{formatCurrency(total)}</div>
        {owing ? (
          <div className="tabular-nums text-[11px] font-semibold text-amber-300">
            {formatCurrency(record.balance_owed ?? 0)} owing
          </div>
        ) : canViewProfit && record.cost_price > 0 ? (
          <div className="tabular-nums text-[11px] font-semibold text-emerald-400/90">
            +{formatCurrency(record.profit)}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-1">
        <Badge
          className={
            owing
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : record.returned
                ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          }
        >
          {owing ? 'Owing' : record.returned ? 'Returned' : 'Paid'}
        </Badge>
        {due ? (
          <span className={cn('text-[10px] font-semibold', due.includes('overdue') ? 'text-red-400' : 'text-shell-muted')}>
            {due}
          </span>
        ) : null}
        {!record.returned && !owing ? (
          <button
            type="button"
            className="hidden text-[10px] font-medium text-violet-300 opacity-0 group-hover:opacity-100 hover:underline sm:inline"
            onClick={e => {
              e.stopPropagation();
              onReturn();
            }}
          >
            <RotateCcw size={10} className="mr-0.5 inline" />
            Return
          </button>
        ) : null}
      </div>
    </div>
  );
}
