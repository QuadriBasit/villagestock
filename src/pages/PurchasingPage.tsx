import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Plus, ShoppingBag, Truck } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { usePurchases } from '@/hooks/usePurchases';
import { usePurchaseActions } from '@/hooks/usePurchaseActions';
import { useShopLocation } from '@/context/ShopLocationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  filterPurchases,
  monthSpendTotal,
  purchaseItemSummary,
  purchaseOrderLabel,
  purchaseOwed,
  purchaseStatusLabel,
  type PurchaseTab,
} from '@/lib/purchasing';
import type { ContactRecord, PurchaseRecord } from '@/types';

const RecordPurchaseModal = lazy(() => import('@/components/purchasing/RecordPurchaseModal'));
const PaySupplierModal = lazy(() => import('@/components/purchasing/PaySupplierModal'));
const PurchaseDetailModal = lazy(() => import('@/components/purchasing/PurchaseDetailModal'));

const PURCHASE_TABS: { value: PurchaseTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owing', label: 'Owing' },
  { value: 'paid', label: 'Paid' },
];

const TABLE_GRID =
  'grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.75fr)] gap-x-3 items-center';

export default function PurchasingPage() {
  const { contacts: suppliers } = useContacts('supplier');
  const { purchases, supplierDebt, isLoading } = usePurchases();
  const { activeLocationId } = useShopLocation();
  const { recordPurchase, paySupplier } = usePurchaseActions();

  const [tab, setTab] = useState<PurchaseTab>('all');
  const [recordOpen, setRecordOpen] = useState(false);
  const [paySupplierContact, setPaySupplierContact] = useState<ContactRecord | null>(null);
  const [detailPurchase, setDetailPurchase] = useState<PurchaseRecord | null>(null);

  const owingSuppliers = useMemo(
    () =>
      suppliers
        .filter(s => s.balance_owed > 0)
        .map(s => ({ supplier: s, owed: s.balance_owed }))
        .sort((a, b) => b.owed - a.owed),
    [suppliers]
  );

  const filtered = useMemo(() => filterPurchases(purchases, tab), [purchases, tab]);
  const monthSpend = useMemo(() => monthSpendTotal(purchases), [purchases]);

  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  if (isLoading) {
    return <div className="app-page py-8 text-sm text-shell-muted">Loading purchasing…</div>;
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader title="Purchasing" subtitle="Stock you buy in, and what you still owe your suppliers">
        <Button
          size="sm"
          className="bg-brand-400 text-[#04231d] hover:bg-brand-300"
          onClick={() => setRecordOpen(true)}
        >
          <Plus size={16} />
          Record purchase
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard
          label="Owed to suppliers"
          value={formatCurrency(supplierDebt)}
          icon={AlertTriangle}
          iconClassName=" text-amber-600 dark:text-amber-300"
          hint={owingSuppliers.length ? `${owingSuppliers.length} on credit` : undefined}
          hintClassName="text-amber-300"
        />
        <StatCard label="Suppliers" value={String(suppliers.length)} icon={Truck} />
        <StatCard label="Purchase orders" value={String(purchases.length)} icon={ShoppingBag} />
        <StatCard label="Bought in (month)" value={formatCurrency(monthSpend)} icon={ShoppingBag} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-shell-line bg-shell-surface">
            <div className="flex gap-0 overflow-x-auto px-1" role="tablist" aria-label="Purchase filter">
              {PURCHASE_TABS.map(t => {
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
              <div className="min-w-[560px]">
                <div
                  className={cn(
                    TABLE_GRID,
                    'border-b border-shell-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-shell-muted'
                  )}
                >
                  <span>Order</span>
                  <span>Supplier · items</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Status</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-shell-muted">No purchase orders here.</div>
                ) : (
                  filtered.map(record => (
                    <PurchaseRow
                      key={record.id}
                      record={record}
                      onOpen={() => setDetailPurchase(record)}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            className={cn(
              'border-shell-line bg-shell-surface p-4 shadow-none',
              supplierDebt > 0 && 'bg-gradient-to-br from-amber-500/[0.08] to-shell-surface'
            )}
          >
            <h3 className="font-display text-sm font-semibold text-shell-ink">Who you owe</h3>
            {owingSuppliers.length === 0 ? (
              <p className="mt-3 text-sm text-shell-muted">All suppliers settled.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {owingSuppliers.map(({ supplier, owed }) => (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-3 rounded-lg border border-shell-line bg-shell-surface-2/35 px-3 py-2.5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-400/15 font-display text-sm font-bold text-brand-300">
                      {supplier.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-shell-ink">{supplier.name}</p>
                      <p className="font-mono text-xs font-semibold tabular-nums text-amber-300">
                        {formatCurrency(owed)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                      onClick={() => setPaySupplierContact(supplier)}
                    >
                      Pay
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {supplierDebt > 0 ? (
              <div className="mt-4 flex items-center justify-between border-t border-shell-line pt-3">
                <span className="text-sm font-semibold text-shell-ink">Total owed</span>
                <span className="font-mono text-base font-bold tabular-nums text-amber-300">
                  {formatCurrency(supplierDebt)}
                </span>
              </div>
            ) : null}
          </Card>

          <Card className="border-shell-line bg-shell-surface p-4 shadow-none">
            <h3 className="font-display text-sm font-semibold text-shell-ink">Quick restock</h3>
            <p className="mt-2 text-sm leading-relaxed text-shell-muted">
              Goods just arrived from a plug? Log them here — supplier debt updates with the order.
            </p>
            <Button
              className="mt-4 w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
              onClick={() => setRecordOpen(true)}
            >
              <Plus size={16} />
              Record a purchase
            </Button>
          </Card>
        </div>
      </div>

      {recordOpen ? (
        <Suspense fallback={null}>
          <RecordPurchaseModal
            open={recordOpen}
            suppliers={suppliers}
            onClose={() => setRecordOpen(false)}
            onSave={async input => {
              if (!activeLocationId) throw new Error('Select a branch first');
              return recordPurchase({ ...input, location_id: activeLocationId });
            }}
          />
        </Suspense>
      ) : null}

      {paySupplierContact ? (
        <Suspense fallback={null}>
          <PaySupplierModal
            supplier={paySupplierContact}
            onClose={() => setPaySupplierContact(null)}
            onPay={paySupplier}
          />
        </Suspense>
      ) : null}

      {detailPurchase ? (
        <Suspense fallback={null}>
          <PurchaseDetailModal
            purchase={detailPurchase}
            supplier={
              detailPurchase.supplier_contact_id
                ? supplierMap.get(detailPurchase.supplier_contact_id)
                : undefined
            }
            onClose={() => setDetailPurchase(null)}
            onPaySupplier={setPaySupplierContact}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function PurchaseRow({ record, onOpen }: { record: PurchaseRecord; onOpen: () => void }) {
  const owed = purchaseOwed(record);
  const status = purchaseStatusLabel(record);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        TABLE_GRID,
        'w-full border-b border-shell-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-shell-surface-2/40'
      )}
    >
      <div>
        <p className="font-mono text-sm font-semibold text-shell-ink">{purchaseOrderLabel(record)}</p>
        <p className="text-[11px] text-shell-muted">{formatDate(record.purchased_at)}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-shell-ink">{record.supplier_name}</p>
        <p className="truncate text-[11px] text-shell-muted">{purchaseItemSummary(record)}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-shell-ink">{formatCurrency(record.total)}</p>
        {owed > 0 ? (
          <p className="font-mono text-[11px] font-semibold tabular-nums text-amber-300">
            {formatCurrency(owed)} owed
          </p>
        ) : null}
      </div>
      <div className="text-right">
        <Badge
          className={
            status === 'Paid'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
          }
        >
          {status}
        </Badge>
      </div>
    </button>
  );
}
