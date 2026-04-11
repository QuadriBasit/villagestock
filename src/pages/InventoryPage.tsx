import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { useInventoryStore } from '@/store/inventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { Search, SlidersHorizontal, Package, Pencil, Trash2, ShoppingCart, Eye, ArrowRightLeft, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { InventorySkeletonList } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { appleMobileShowsServicedBattery, isAppleDevice, isAppleMobileDevice } from '@/types';
import type {
  AppleICloudStatus,
  AppleMobileDeviceDetails,
  Category,
  InventoryFilters,
  InventoryItem,
  SerializedItemStatus,
} from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
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

const SORT_OPTIONS: { value: `${InventoryFilters['sortBy']}-${InventoryFilters['sortDir']}`; label: string }[] = [
  { value: 'updated_at-desc', label: 'Newest' },
  { value: 'updated_at-asc', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'price-desc', label: 'Price high to low' },
  { value: 'price-asc', label: 'Price low to high' },
  { value: 'quantity-asc', label: 'Stock low to high' },
  { value: 'quantity-desc', label: 'Stock high to low' },
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted dark:text-zinc-400">
          <span className="shrink-0">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial sm:justify-end">
            <span className="max-sm:sr-only sm:inline">Sort</span>
            <Select
              value={`${filters.sortBy}-${filters.sortDir}`}
              onValueChange={v => {
                const [sortBy, sortDir] = v.split('-') as [InventoryFilters['sortBy'], InventoryFilters['sortDir']];
                setFilters({ sortBy, sortDir });
              }}
            >
              <SelectTrigger
                aria-label="Sort inventory"
                className="h-9 w-full min-w-[10.5rem] max-w-[min(100%,18rem)] text-xs sm:w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function ItemCardActions({
  className = '',
  isSerialized,
  statusCfg,
  canSell,
  canSwap,
  canEngineer,
  tradeLocked,
  tradeLockedMessage,
  onSell,
  onSwap,
  onEngineer,
  onEdit,
  onDelete,
}: {
  className?: string;
  isSerialized: boolean;
  statusCfg: { label: string; className: string };
  canSell: boolean;
  canSwap: boolean;
  canEngineer: boolean;
  tradeLocked: boolean;
  tradeLockedMessage: string;
  onSell: () => void;
  onSwap: () => void;
  onEngineer: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex flex-row items-center gap-0.5 sm:gap-1 ${className}`}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onSell();
        }}
        disabled={!canSell}
        className="p-2.5 sm:p-2 rounded-lg hover:bg-teal/10 text-muted hover:text-teal transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-teal-900/30 dark:text-zinc-400"
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
          type="button"
          onClick={e => {
            e.stopPropagation();
            onSwap();
          }}
          disabled={!canSwap}
          className="p-2.5 sm:p-2 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-primary/20 dark:text-zinc-400"
          aria-label="Swap"
          title={tradeLocked ? tradeLockedMessage : canSwap ? 'Record a device swap' : `Status: ${statusCfg.label}`}
        >
          <ArrowRightLeft size={16} />
        </button>
      )}
      {isSerialized && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onEngineer();
          }}
          disabled={!canEngineer}
          className="p-2.5 sm:p-2 rounded-lg hover:bg-amber-100 text-muted hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-amber-900/35 dark:text-zinc-400 dark:hover:text-amber-400"
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
        type="button"
        onClick={e => {
          e.stopPropagation();
          onEdit();
        }}
        className="p-2.5 sm:p-2 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors dark:hover:bg-zinc-800 dark:text-zinc-400"
        aria-label="Edit"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2.5 sm:p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors dark:hover:bg-red-950/40 dark:text-zinc-400"
        aria-label="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

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
  const appleMobile =
    isAppleMobileDevice(item.brand, item.category) && item.deviceDetails
      ? (item.deviceDetails as AppleMobileDeviceDetails)
      : undefined;

  const badgeClass = 'text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-tight max-sm:max-w-[100%]';

  return (
    <div className="bg-white rounded-3xl px-3 py-3 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04] border border-slate-900/[0.05] flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:py-3.5 dark:bg-zinc-900/90 dark:border-zinc-700/80 dark:ring-white/[0.06] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]">
      <div className="flex gap-3 min-w-0 sm:flex-1">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 dark:bg-zinc-800 dark:border-zinc-700">
          <Package size={18} className="text-muted dark:text-zinc-400" />
        </div>

        {/* Info + price row (tap to edit) */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <div className="font-medium text-dark text-sm dark:text-zinc-100 min-w-0 flex-1">{item.name}</div>
            <span className="text-sm font-semibold text-primary shrink-0">{formatCurrency(item.price)}</span>
          </div>
          <div className="text-xs text-muted capitalize dark:text-zinc-400">{item.brand} · {item.category}</div>
          {status === 'with_engineer' && engineerName && (
            <div className="text-[10px] text-muted mt-0.5">Repair: {engineerName}</div>
          )}

          {isSerialized && (item.serial_number || item.imei) && (
            <div className="flex gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
              {item.serial_number && (
                <span className="text-[10px] font-mono text-muted break-all">S/N: {item.serial_number}</span>
              )}
              {item.imei && (
                <span className="text-[10px] font-mono text-muted break-all">IMEI: {item.imei}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions: inline on desktop only */}
        <div className="hidden sm:flex shrink-0 border-l border-zinc-100 pl-2 dark:border-zinc-700 self-stretch items-start pt-0.5">
          <ItemCardActions
            isSerialized={isSerialized}
            statusCfg={statusCfg}
            canSell={canSell}
            canSwap={canSwap}
            canEngineer={canEngineer}
            tradeLocked={tradeLocked}
            tradeLockedMessage={tradeLockedMessage}
            onSell={onSell}
            onSwap={onSwap}
            onEngineer={onEngineer}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Badges: full-width row so they wrap across the card, not in a narrow column */}
      <div className="flex flex-wrap items-center gap-1.5 sm:pl-0 max-sm:w-full">
        {isSerialized ? (
          <span className={`${badgeClass} ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        ) : (
          <span className={`${badgeClass} ${
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
          <span className={`${badgeClass} text-muted bg-gray-100 dark:bg-zinc-800 dark:text-zinc-400`}>
            Syncing…
          </span>
        )}

        {showAppleBadges && batteryHealth !== undefined && (
          <span className={`${badgeClass} ${
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
          <span className={`${badgeClass} ${icloudStatusClass(icloudStatus)}`}>
            {icloudStatusLabel(icloudStatus)}
          </span>
        )}

        {appleMobile?.important_battery_message && (
          <span className={`${badgeClass} bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200`} title="Important Battery Message">
            Batt msg
          </span>
        )}
        {appleMobile?.important_display_message && (
          <span className={`${badgeClass} bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200`} title="Important Display Message">
            Disp msg
          </span>
        )}
        {appleMobile && appleMobileShowsServicedBattery(appleMobile) && (
          <span className={`${badgeClass} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`} title="Battery under 80% or serviced disclosure">
            Svc batt
          </span>
        )}
        {appleMobile?.mdm_ibm && (
          <span className={`${badgeClass} bg-orange-100 text-orange-800 dark:bg-orange-950/45 dark:text-orange-200`}>
            IBM+
          </span>
        )}
        {appleMobile?.mdm_idm && (
          <span className={`${badgeClass} bg-orange-100 text-orange-800 dark:bg-orange-950/45 dark:text-orange-200`}>
            IDM+
          </span>
        )}
        {appleMobile?.mdm_icm && (
          <span className={`${badgeClass} bg-orange-100 text-orange-800 dark:bg-orange-950/45 dark:text-orange-200`}>
            ICM+
          </span>
        )}
      </div>

      {/* Actions: full-width bar on mobile */}
      <div className="flex sm:hidden w-full min-w-0 justify-between gap-0.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <ItemCardActions
          className="w-full justify-between min-w-0"
          isSerialized={isSerialized}
          statusCfg={statusCfg}
          canSell={canSell}
          canSwap={canSwap}
          canEngineer={canEngineer}
          tradeLocked={tradeLocked}
          tradeLockedMessage={tradeLockedMessage}
          onSell={onSell}
          onSwap={onSwap}
          onEngineer={onEngineer}
          onEdit={onEdit}
          onDelete={onDelete}
        />
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
