import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { useInventoryStore } from '@/store/inventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { Search, SlidersHorizontal, Package, Pencil, Trash2, ShoppingCart, Eye, ArrowRightLeft, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { InventorySkeletonList } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { isAppleDevice } from '@/types';
import type { AppleICloudStatus, Category, InventoryItem, SerializedItemStatus } from '@/types';
import { useActiveRepairs } from '@/hooks/useRepairs';
import { useTradingGateState } from '@/hooks/useStockSessions';

const SaleForm = lazy(() => import('@/components/sales/SaleForm'));
const SwapForm = lazy(() => import('@/components/sales/SwapForm'));
const SendToEngineerForm = lazy(() => import('@/components/inventory/SendToEngineerForm'));

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'phones', label: 'Phones' },
  { value: 'laptops', label: 'Laptops' },
  { value: 'tablets', label: 'Tablets' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'parts', label: 'Parts' },
];

const STATUS_CONFIG: Record<SerializedItemStatus, { label: string; className: string }> = {
  in_stock: {
    label: 'In Stock',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/45 dark:text-green-300',
  },
  sold: {
    label: 'Sold',
    className: 'bg-gray-100 text-gray-500 dark:bg-zinc-700/80 dark:text-zinc-400',
  },
  reserved: {
    label: 'Reserved',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/45 dark:text-blue-300',
  },
  returned: {
    label: 'Returned',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/45 dark:text-purple-300',
  },
  defective: {
    label: 'Defective',
    className: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
  },
  with_engineer: {
    label: 'Out for repair',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  missing: { label: 'Missing', className: 'bg-red-600 text-white dark:bg-red-700 dark:text-white' },
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, setFilters, resetFilters } = useInventoryStore();
  const { items, isLoading } = useInventory();
  const { repairs } = useActiveRepairs();
  const { deleteItem } = useInventoryActions();
  const tradingGate = useTradingGateState();

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);
  const [swapTarget, setSwapTarget] = useState<InventoryItem | null>(null);
  const [engineerTarget, setEngineerTarget] = useState<InventoryItem | null>(null);
  const activeRepairByItem = new Map(repairs.map(record => [record.item_id, record]));

  useEffect(() => {
    const cat = searchParams.get('category') as Category | null;
    if (cat) setFilters({ category: cat });
    return () => resetFilters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteItem(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const isFiltered = !!(filters.search || filters.category !== 'all' || filters.lowStockOnly || filters.showSold);

  const tradeLocked =
    tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;

  return (
    <div className="app-page py-4 md:py-6 space-y-4">
      {tradeLocked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          {tradingGate.message}
        </div>
      )}
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted dark:text-zinc-500" size={18} />
        <input
          type="search"
          placeholder="Search by name, brand, serial, IMEI, IBM…"
          value={filters.search}
          onChange={e => setFilters({ search: e.target.value })}
          className="w-full pl-10 pr-4 py-3 border border-slate-200/90 rounded-full text-sm bg-white text-[#0f172a] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.1)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/50 transition dark:border-zinc-600 dark:bg-zinc-900/85 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]"
          autoComplete="off"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilters({ category: cat.value })}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filters.category === cat.value
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted border-border hover:border-primary hover:text-primary dark:bg-zinc-800/95 dark:text-zinc-300 dark:border-zinc-600 dark:hover:border-primary dark:hover:text-primary'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setFilters({ lowStockOnly: !filters.lowStockOnly })}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            filters.lowStockOnly
              ? 'bg-accent text-white border-accent'
              : 'bg-white text-muted border-border hover:border-accent hover:text-accent dark:bg-zinc-800/95 dark:text-zinc-300 dark:border-zinc-600 dark:hover:border-accent dark:hover:text-accent'
          }`}
        >
          <SlidersHorizontal size={12} />
          Low stock
        </button>
        <button
          onClick={() => setFilters({ showSold: !filters.showSold })}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            filters.showSold
              ? 'bg-gray-600 text-white border-gray-600 dark:bg-zinc-600 dark:border-zinc-500'
              : 'bg-white text-muted border-border hover:border-gray-400 hover:text-dark dark:bg-zinc-800/95 dark:text-zinc-300 dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-100'
          }`}
        >
          <Eye size={12} />
          Show sold
        </button>
      </div>

      {/* Sort row */}
      {!isLoading && items.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted dark:text-zinc-400">
          <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span>Sort:</span>
            <select
              value={`${filters.sortBy}-${filters.sortDir}`}
              onChange={e => {
                const [sortBy, sortDir] = e.target.value.split('-') as [
                  typeof filters.sortBy,
                  typeof filters.sortDir
                ];
                setFilters({ sortBy, sortDir });
              }}
              className="border border-border rounded-lg px-2 py-1 text-xs bg-white text-[#0f172a] focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="updated_at-desc">Newest</option>
              <option value="updated_at-asc">Oldest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="price-desc">Price ↓</option>
              <option value="price-asc">Price ↑</option>
              <option value="quantity-asc">Stock ↑</option>
              <option value="quantity-desc">Stock ↓</option>
            </select>
          </div>
        </div>
      )}

      {/* Item list / empty / loading */}
      {isLoading ? (
        <InventorySkeletonList />
      ) : items.length === 0 ? (
        <EmptyState isFiltered={isFiltered} onAdd={() => navigate('/inventory/new')} />
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              tradeLocked={tradeLocked}
              tradeLockedMessage={tradingGate.message}
              onEdit={() => navigate(`/inventory/${item.id}/edit`)}
              onSell={() => setSellTarget(item)}
              onSwap={() => setSwapTarget(item)}
              onEngineer={() => setEngineerTarget(item)}
              engineerName={activeRepairByItem.get(item.id)?.engineer_name}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete item?"
        message={`"${deleteTarget?.name}" will be permanently removed from your inventory.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Sale bottom-sheet */}
      {sellTarget && (
        <Suspense fallback={null}>
          <SaleForm
            item={sellTarget}
            onClose={() => setSellTarget(null)}
            onSuccess={() => setSellTarget(null)}
          />
        </Suspense>
      )}

      {swapTarget && (
        <Suspense fallback={null}>
          <SwapForm
            item={swapTarget}
            onClose={() => setSwapTarget(null)}
            onSuccess={() => setSwapTarget(null)}
          />
        </Suspense>
      )}

      {engineerTarget && (
        <Suspense fallback={null}>
          <SendToEngineerForm item={engineerTarget} onClose={() => setEngineerTarget(null)} onSuccess={() => setEngineerTarget(null)} />
        </Suspense>
      )}
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  tradeLocked,
  tradeLockedMessage,
  onEdit,
  onSell,
  onSwap,
  onEngineer,
  engineerName,
  onDelete,
}: {
  item: InventoryItem;
  tradeLocked: boolean;
  tradeLockedMessage: string;
  onEdit: () => void;
  onSell: () => void;
  onSwap: () => void;
  onEngineer: () => void;
  engineerName?: string;
  onDelete: () => void;
}) {
  const isSerialized = item.mode === 'serialized';
  const status = item.status ?? 'in_stock';
  const statusCfg = STATUS_CONFIG[status];

  // For non-serialized: qty-based badges
  const isOut = !isSerialized && item.quantity === 0;
  const isLow = !isSerialized && item.quantity > 0 && item.quantity <= item.low_stock_threshold;

  // Serialized: can only sell if in_stock; missing units never sold/swapped/sent
  const canSell =
    !tradeLocked && (isSerialized ? status === 'in_stock' : item.quantity > 0);
  const canSwap = !tradeLocked && isSerialized && status === 'in_stock';
  const canEngineer = !tradeLocked && isSerialized && status === 'in_stock';
  const batteryHealth = typeof item.deviceDetails?.battery_health === 'number' ? item.deviceDetails.battery_health : undefined;
  const icloudStatus = item.deviceDetails && 'icloud_lock_status' in item.deviceDetails ? item.deviceDetails.icloud_lock_status as AppleICloudStatus | undefined : undefined;
  const showAppleBadges = isAppleDevice(item.brand, item.category);

  return (
    <div className="bg-white rounded-3xl px-4 py-3.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04] border border-slate-900/[0.05] flex items-center gap-3 dark:bg-zinc-900/90 dark:border-zinc-700/80 dark:ring-white/[0.06] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]">
      <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 dark:bg-zinc-800 dark:border-zinc-700">
        <Package size={18} className="text-muted dark:text-zinc-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="font-medium text-dark text-sm truncate dark:text-zinc-100">{item.name}</div>
        <div className="text-xs text-muted capitalize dark:text-zinc-400">{item.brand} · {item.category}</div>
        {status === 'with_engineer' && engineerName && (
          <div className="text-[10px] text-muted mt-0.5">Repair: {engineerName}</div>
        )}

        {/* Identifier row for serialized */}
        {isSerialized && (item.serial_number || item.imei) && (
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {item.serial_number && (
              <span className="text-[10px] font-mono text-muted">S/N: {item.serial_number}</span>
            )}
            {item.imei && (
              <span className="text-[10px] font-mono text-muted">IMEI: {item.imei}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm font-semibold text-primary">{formatCurrency(item.price)}</span>

          {isSerialized ? (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
          ) : (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              isOut
                ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                : isLow
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/45 dark:text-orange-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/45 dark:text-green-300'
            }`}>
              {isOut ? 'Out of stock' : `${item.quantity} in stock`}
            </span>
          )}

          {item.sync_status === 'pending' && (
            <span className="text-[10px] text-muted bg-gray-100 px-1.5 py-0.5 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
              Syncing…
            </span>
          )}

          {showAppleBadges && batteryHealth !== undefined && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              batteryHealth > 80
                ? 'bg-green-100 text-green-700 dark:bg-green-900/45 dark:text-green-300'
                : batteryHealth >= 60
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                  : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
            }`}>
              Battery {batteryHealth}%
            </span>
          )}

          {showAppleBadges && icloudStatus && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${icloudStatusClass(icloudStatus)}`}>
              {icloudStatusLabel(icloudStatus)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onSell}
          disabled={!canSell}
          className="p-2 rounded-lg hover:bg-teal/10 text-muted hover:text-teal transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-teal-900/30 dark:text-zinc-400"
          aria-label="Sell"
          title={
            tradeLocked
              ? tradeLockedMessage
              : canSell
                ? 'Record a sale'
                : isSerialized
                  ? `Status: ${statusCfg.label}`
                  : 'Out of stock'
          }
        >
          <ShoppingCart size={16} />
        </button>
        {isSerialized && (
          <button
            onClick={onSwap}
            disabled={!canSwap}
            className="p-2 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-primary/20 dark:text-zinc-400"
            aria-label="Swap"
            title={tradeLocked ? tradeLockedMessage : canSwap ? 'Record a device swap' : `Status: ${statusCfg.label}`}
          >
            <ArrowRightLeft size={16} />
          </button>
        )}
        {isSerialized && (
          <button
            onClick={onEngineer}
            disabled={!canEngineer}
            className="p-2 rounded-lg hover:bg-amber-100 text-muted hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-amber-900/35 dark:text-zinc-400 dark:hover:text-amber-400"
            aria-label="Send for repair"
            title={
              tradeLocked
                ? tradeLockedMessage
                : canEngineer
                  ? 'Send for repair'
                  : `Status: ${statusCfg.label}`
            }
          >
            <Wrench size={16} />
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors dark:hover:bg-zinc-800 dark:text-zinc-400"
          aria-label="Edit"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors dark:hover:bg-red-950/40 dark:text-zinc-400"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function icloudStatusLabel(status: AppleICloudStatus) {
  switch (status) {
    case 'clean': return 'Clean';
    case 'ibm': return 'IBM';
    case 'idm': return 'IDM';
    case 'icm': return 'ICM';
    case 'icloud_locked': return 'iCloud Locked';
    case 'find_my_on': return 'Find My On';
    case 'find_my_off': return 'Find My Off';
  }
}

function icloudStatusClass(status: AppleICloudStatus) {
  if (status === 'clean') return 'bg-green-100 text-green-700 dark:bg-green-900/45 dark:text-green-300';
  if (status === 'icloud_locked') return 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400';
  if (status === 'ibm' || status === 'idm' || status === 'icm')
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function EmptyState({ isFiltered, onAdd }: { isFiltered: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-border flex items-center justify-center mb-4 shadow-sm dark:bg-zinc-900/70 dark:border-zinc-600">
        <Package size={36} className="text-muted dark:text-zinc-500" />
      </div>
      <h3 className="font-heading font-semibold text-dark text-base dark:text-zinc-100">
        {isFiltered ? 'No items match' : 'Your inventory is empty'}
      </h3>
      <p className="text-muted text-sm mt-1 max-w-xs leading-relaxed dark:text-zinc-400">
        {isFiltered
          ? 'Try a different search or clear your filters'
          : 'Start tracking your stock by adding your first item'}
      </p>
      {!isFiltered && (
        <button
          onClick={onAdd}
          className="mt-5 bg-primary text-white rounded-xl px-6 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Package size={16} /> Add First Item
        </button>
      )}
    </div>
  );
}
