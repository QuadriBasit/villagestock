import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { useInventoryStore } from '@/store/inventory';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { useStockSummary } from '@/hooks/useInventory';
import { useShopLocation } from '@/context/ShopLocationContext';
import {
  Search,
  SlidersHorizontal,
  Package,
  Plus,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  ArrowRightLeft,
  Wrench,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { InventorySkeletonList } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Category, InventoryFilters, InventoryItem } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useActiveRepairs } from '@/hooks/useRepairs';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { StockLevelBar } from '@/components/inventory/StockLevelBar';
import AddProductModal from '@/components/inventory/AddProductModal';
import EditProductModal from '@/components/inventory/EditProductModal';
import { shellSegmentBtn, shellSegmentTrack } from '@/components/settings/settingsUi';
import {
  conditionLabel,
  getItemQty,
} from '@/lib/inventoryDisplay';
import {
  formatCurrencyRange,
  formatPercentRange,
  groupInventoryItems,
  productSpecLine,
  sellableItemsInGroup,
  type InventoryListGroup,
  type InventoryVariantSlice,
} from '@/lib/inventoryGrouping';

const SaleForm = lazy(() => import('@/components/sales/SaleForm'));
const SwapForm = lazy(() => import('@/components/sales/SwapForm'));
const SendToEngineerForm = lazy(() => import('@/components/inventory/SendToEngineerForm'));
const TransferStockModal = lazy(() => import('@/components/inventory/TransferStockModal'));

const CATEGORY_PILLS: { value: Category | 'all'; label: string }[] = [
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

const TABLE_GRID =
  'grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.55fr)_2.5rem] gap-x-3 items-center';

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, resetFilters } = useInventoryStore();
  const { items, isLoading } = useInventory();
  const { summary } = useStockSummary();
  const { locations, activeLocationId } = useShopLocation();
  const { repairs } = useActiveRepairs();
  const { deleteItem } = useInventoryActions();
  const tradingGate = useTradingGateState();

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);
  const [swapTarget, setSwapTarget] = useState<InventoryItem | null>(null);
  const [engineerTarget, setEngineerTarget] = useState<InventoryItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const activeRepairByItem = new Map(repairs.map(record => [record.item_id, record]));

  const groups = useMemo(() => {
    const grouped = groupInventoryItems(items);
    const dir = filters.sortDir === 'asc' ? 1 : -1;
    const key = filters.sortBy;
    return grouped.sort((a, b) => {
      if (key === 'quantity') {
        const aq = a.mix.qty;
        const bq = b.mix.qty;
        return aq < bq ? -dir : aq > bq ? dir : 0;
      }
      if (key === 'price') {
        const aq = a.mix.priceMax;
        const bq = b.mix.priceMax;
        return aq < bq ? -dir : aq > bq ? dir : 0;
      }
      const av = a.primaryItem[key as keyof typeof a.primaryItem] ?? '';
      const bv = b.primaryItem[key as keyof typeof b.primaryItem] ?? '';
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [items, filters.sortBy, filters.sortDir]);

  const totalUnits = useMemo(() => items.reduce((sum, i) => sum + getItemQty(i), 0), [items]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const branchName = locations.find(l => l.id === activeLocationId)?.name ?? 'Branch';
  const stockValue = summary?.total_value ?? 0;

  useEffect(() => {
    const cat = searchParams.get('category') as Category | null;
    if (cat) setFilters({ category: cat });
    return () => resetFilters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    setAddOpen(true);
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('add');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const id = searchParams.get('edit');
    if (!id) return;
    setEditItemId(id);
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const openAddProduct = () => setAddOpen(true);
  const closeAddProduct = () => setAddOpen(false);
  const openEditProduct = (id: string) => setEditItemId(id);
  const closeEditProduct = () => setEditItemId(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteItem(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const isFiltered = !!(filters.search || filters.category !== 'all' || filters.lowStockOnly || filters.showSold);
  const tradeLocked = tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;

  return (
    <div className="app-page space-y-5 py-4 md:py-6">
      {tradeLocked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          {tradingGate.message}
        </div>
      )}

      <PageHeader title="Inventory" subtitle={`${branchName} · ${formatCurrency(stockValue)} stock value`}>
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          disabled={locations.length < 2}
          title={locations.length < 2 ? 'Add another branch in Settings' : undefined}
          onClick={() => setTransferOpen(true)}
        >
          <ArrowRightLeft size={16} />
          Transfer
        </Button>
        <Button size="sm" onClick={openAddProduct}>
          <Plus size={16} />
          Add product
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-shell-muted" />
          <Input
            type="search"
            placeholder="Search product, brand, spec…"
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            className="h-11 rounded-xl border-shell-line bg-shell-surface pl-10 text-shell-ink placeholder:text-shell-muted"
            autoComplete="off"
          />
        </div>
        <div className={shellSegmentTrack}>
          {CATEGORY_PILLS.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setFilters({ category: cat.value })}
              className={shellSegmentBtn(filters.category === cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-shell-muted">
        <button
          type="button"
          onClick={() => setFilters({ lowStockOnly: !filters.lowStockOnly })}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium transition-colors',
            filters.lowStockOnly
              ? 'shell-accent-subtle shell-accent-subtle-border shell-accent-text-soft'
              : 'border-shell-line bg-shell-surface hover:border-shell-line/80',
          )}
        >
          <SlidersHorizontal size={12} />
          Low stock
        </button>
        <button
          type="button"
          onClick={() => setFilters({ showSold: !filters.showSold })}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium transition-colors',
            filters.showSold
              ? 'border-shell-line bg-shell-surface-2 text-shell-ink'
              : 'border-shell-line bg-shell-surface hover:border-shell-line/80',
          )}
        >
          <Eye size={12} />
          Show sold
        </button>
        {!isLoading && groups.length > 0 && (
          <>
            <span className="ml-auto hidden sm:inline">
              {groups.length} product{groups.length !== 1 ? 's' : ''} · {totalUnits} unit
              {totalUnits !== 1 ? 's' : ''}
            </span>
            <Select
              value={`${filters.sortBy}-${filters.sortDir}`}
              onValueChange={v => {
                const [sortBy, sortDir] = v.split('-') as [InventoryFilters['sortBy'], InventoryFilters['sortDir']];
                setFilters({ sortBy, sortDir });
              }}
            >
              <SelectTrigger
                aria-label="Sort inventory"
                className="ml-auto h-8 w-36 border-shell-line bg-shell-surface text-xs text-shell-ink sm:ml-0"
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
          </>
        )}
      </div>

      {isLoading ? (
        <InventorySkeletonList />
      ) : groups.length === 0 ? (
        <EmptyState isFiltered={isFiltered} onAdd={openAddProduct} query={filters.search} />
      ) : (
        <Card className="overflow-hidden border-shell-line bg-shell-surface p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div
                className={cn(
                  TABLE_GRID,
                  'border-b border-shell-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-shell-muted',
                )}
              >
                <span>Product</span>
                <span>Condition</span>
                <span className="hidden sm:block">Cost</span>
                <span>Price</span>
                <span>Stock</span>
                <span className="hidden sm:block">Margin</span>
                <span />
              </div>
              {groups.map(group => (
                <InventoryGroupRow
                  key={group.key}
                  group={group}
                  expanded={!!expandedGroups[group.key]}
                  onToggleExpand={() => toggleGroup(group.key)}
                  tradeLocked={tradeLocked}
                  tradeLockedMessage={tradingGate.message}
                  engineerName={activeRepairByItem.get(group.primaryItem.id)?.engineer_name}
                  onView={id => navigate(`/inventory/${id}`)}
                  onEdit={() => openEditProduct(group.primaryItem.id)}
                  onSell={item => setSellTarget(item)}
                  onSwap={item => setSwapTarget(item)}
                  onEngineer={item => setEngineerTarget(item)}
                  onDelete={item => setDeleteTarget(item)}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete item?"
        message={`"${deleteTarget?.name}" will be permanently removed from your inventory.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {sellTarget && (
        <Suspense fallback={null}>
          <SaleForm item={sellTarget} onClose={() => setSellTarget(null)} onSuccess={() => setSellTarget(null)} />
        </Suspense>
      )}
      {swapTarget && (
        <Suspense fallback={null}>
          <SwapForm item={swapTarget} onClose={() => setSwapTarget(null)} onSuccess={() => setSwapTarget(null)} />
        </Suspense>
      )}
      {engineerTarget && (
        <Suspense fallback={null}>
          <SendToEngineerForm
            item={engineerTarget}
            onClose={() => setEngineerTarget(null)}
            onSuccess={() => setEngineerTarget(null)}
          />
        </Suspense>
      )}

      {transferOpen ? (
        <Suspense fallback={null}>
          <TransferStockModal open onClose={() => setTransferOpen(false)} />
        </Suspense>
      ) : null}

      <AddProductModal open={addOpen} onClose={closeAddProduct} />
      {editItemId ? (
        <EditProductModal open itemId={editItemId} onClose={closeEditProduct} />
      ) : null}
    </div>
  );
}

function InventoryGroupRow({
  group,
  expanded,
  onToggleExpand,
  tradeLocked,
  tradeLockedMessage,
  engineerName,
  onView,
  onEdit,
  onSell,
  onSwap,
  onEngineer,
  onDelete,
}: {
  group: InventoryListGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  tradeLocked: boolean;
  tradeLockedMessage: string;
  engineerName?: string;
  onView: (id: string) => void;
  onEdit: () => void;
  onSell: (item: InventoryItem) => void;
  onSwap: (item: InventoryItem) => void;
  onEngineer: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const { primaryItem, mix, flags, variants } = group;
  const sellable = sellableItemsInGroup(group);
  const sellTarget = sellable[0];
  const isSerialized = primaryItem.mode === 'serialized';
  const hasVariantBreakdown = variants.length > 1;
  const canExpand = hasVariantBreakdown || group.items.length > 1;
  const priceSpread = mix.priceMin !== mix.priceMax;
  const costSpread = mix.costMin !== mix.costMax;
  const marginSpread = mix.marginMin !== mix.marginMax;
  const canSell = !tradeLocked && sellable.length > 0;
  const canSwap = !tradeLocked && isSerialized && sellable.some(i => i.status === 'in_stock');
  const canEngineer = !tradeLocked && isSerialized && sellable.some(i => i.status === 'in_stock');
  const canDelete = group.items.length === 1;
  const reorder = primaryItem.low_stock_threshold;
  const lowStock = mix.qty > 0 && mix.qty <= Math.max(reorder, 3);

  return (
    <>
      <div
        className={cn(
          TABLE_GRID,
          'group border-b border-shell-line/70 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-shell-surface-2/50',
        )}
      >
        <div
          className="flex min-w-0 cursor-pointer items-center gap-2.5"
          onClick={() => onView(primaryItem.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onView(primaryItem.id);
            }
          }}
        >
          {canExpand ? (
            <button
              type="button"
              className="grid size-6 shrink-0 place-items-center rounded-md text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse variants' : 'Expand variants'}
              onClick={e => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="size-6 shrink-0" />
          )}
          <CategoryThumb category={group.category} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-shell-ink">{group.name}</div>
            <div className="truncate text-xs text-shell-muted">{productSpecLine(group)}</div>
            {engineerName && primaryItem.status === 'with_engineer' && (
              <div className="mt-0.5 text-[10px] text-shell-muted">Repair: {engineerName}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(mix.byCondition).map(([cond, count]) => (
            <Badge key={cond} variant="outline" className="border-shell-line text-[10px]">
              {cond}
              {count > 1 ? ` · ${count}` : ''}
            </Badge>
          ))}
          {mix.serviceCount > 0 && (
            <Badge className="border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-200">
              {mix.serviceCount} svc
            </Badge>
          )}
          {flags.map(flag => (
            <Badge
              key={flag}
              className={cn(
                'text-[10px]',
                flag === 'Repair'
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-200',
              )}
            >
              {flag}
            </Badge>
          ))}
        </div>

        <div className="hidden tabular-nums text-sm text-shell-muted sm:block">
          {costSpread ? formatCurrencyRange(mix.costMin, mix.costMax, true) : formatCurrency(mix.costMin)}
        </div>
        <div className="tabular-nums text-sm font-semibold text-shell-ink">
          {priceSpread ? formatCurrencyRange(mix.priceMin, mix.priceMax, true) : formatCurrency(mix.priceMin)}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-6 tabular-nums text-sm font-semibold',
              mix.qty === 0
                ? 'text-red-400'
                : lowStock
                  ? 'text-amber-300'
                  : 'text-shell-ink',
            )}
          >
            {mix.qty}
          </span>
          {!isSerialized && (
            <StockLevelBar qty={mix.qty} reorder={Math.max(reorder, 2)} />
          )}
        </div>

        <div className="hidden tabular-nums text-sm font-semibold text-emerald-400 sm:block">
          {marginSpread ? formatPercentRange(mix.marginMin, mix.marginMax) : `${mix.marginMin}%`}
        </div>

        <GroupActions
          tradeLocked={tradeLocked}
          tradeLockedMessage={tradeLockedMessage}
          canSell={canSell}
          canSwap={canSwap}
          canEngineer={canEngineer}
          canDelete={canDelete}
          isSerialized={isSerialized}
          onView={() => onView(primaryItem.id)}
          onEdit={onEdit}
          onSell={() => sellTarget && onSell(sellTarget)}
          onSwap={() => sellTarget && onSwap(sellTarget)}
          onEngineer={() => sellTarget && onEngineer(sellTarget)}
          onDelete={() => onDelete(primaryItem)}
        />
      </div>

      {expanded &&
        variants.map(variant => (
          <InventoryVariantRow
            key={variant.key}
            variant={variant}
            isSerialized={isSerialized}
            onView={() => onView(variant.primaryItem.id)}
          />
        ))}
    </>
  );
}

function InventoryVariantRow({
  variant,
  isSerialized,
  onView,
}: {
  variant: InventoryVariantSlice;
  isSerialized: boolean;
  onView: () => void;
}) {
  const { mix, label, primaryItem } = variant;
  const priceSpread = mix.priceMin !== mix.priceMax;

  return (
    <div
      className={cn(
        TABLE_GRID,
        'cursor-pointer border-b border-shell-line/40 bg-shell-surface-2/25 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-shell-surface-2/60',
      )}
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5 pl-8">
        <span className="size-6 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-shell-ink">{label}</div>
          <div className="truncate text-[11px] text-shell-muted">
            {isSerialized ? `${variant.items.length} unit${variant.items.length !== 1 ? 's' : ''}` : 'SKU'}
          </div>
        </div>
      </div>
      <div className="text-xs text-shell-muted">{conditionLabel(primaryItem.condition)}</div>
      <div className="hidden tabular-nums text-xs text-shell-muted sm:block">
        {formatCurrency(mix.costMin)}
      </div>
      <div className="tabular-nums text-xs font-semibold text-shell-ink">
        {priceSpread ? formatCurrencyRange(mix.priceMin, mix.priceMax, true) : formatCurrency(mix.priceMin)}
      </div>
      <div className="tabular-nums text-xs font-semibold text-shell-ink">{mix.qty}</div>
      <div className="hidden tabular-nums text-xs text-emerald-400 sm:block">{mix.marginMin}%</div>
      <span />
    </div>
  );
}

function GroupActions({
  tradeLocked,
  tradeLockedMessage,
  canSell,
  canSwap,
  canEngineer,
  canDelete,
  isSerialized,
  onView,
  onEdit,
  onSell,
  onSwap,
  onEngineer,
  onDelete,
}: {
  tradeLocked: boolean;
  tradeLockedMessage: string;
  canSell: boolean;
  canSwap: boolean;
  canEngineer: boolean;
  canDelete: boolean;
  isSerialized: boolean;
  onView: () => void;
  onEdit: () => void;
  onSell: () => void;
  onSwap: () => void;
  onEngineer: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end" onClick={e => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-shell-muted hover:text-shell-ink"
            aria-label="Actions"
          >
            <MoreHorizontal size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 border-shell-line bg-shell-surface p-1">
          <RowAction icon={ShoppingCart} label="Sell" disabled={!canSell} title={tradeLocked ? tradeLockedMessage : undefined} onClick={onSell} />
          {isSerialized && (
            <>
              <RowAction icon={ArrowRightLeft} label="Swap" disabled={!canSwap} title={tradeLocked ? tradeLockedMessage : undefined} onClick={onSwap} />
              <RowAction icon={Wrench} label="Send for repair" disabled={!canEngineer} onClick={onEngineer} />
            </>
          )}
          <RowAction icon={Eye} label="View" onClick={onView} />
          <RowAction icon={Pencil} label="Edit" onClick={onEdit} />
          {canDelete ? (
            <RowAction icon={Trash2} label="Delete" destructive onClick={onDelete} />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
  title,
}: {
  icon: typeof ShoppingCart;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-40',
        destructive
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-shell-ink hover:bg-shell-surface-2',
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function EmptyState({
  isFiltered,
  onAdd,
  query,
}: {
  isFiltered: boolean;
  onAdd: () => void;
  query: string;
}) {
  return (
    <Card className="flex flex-col items-center border-shell-line bg-shell-surface px-4 py-16 text-center">
      <div className="mb-4 flex size-20 items-center justify-center rounded-2xl border-2 border-dashed border-shell-line bg-shell-surface-2">
        <Package size={36} className="text-shell-muted" />
      </div>
      <h3 className="font-display text-base font-semibold text-shell-ink">
        {isFiltered ? 'No products match' : 'Your inventory is empty'}
      </h3>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-shell-muted">
        {isFiltered
          ? query
            ? `No products match “${query}”.`
            : 'Try a different search or clear your filters.'
          : 'Start tracking your stock by adding your first item.'}
      </p>
      {!isFiltered && (
        <Button className="mt-5" onClick={onAdd}>
          <Package size={16} />
          Add first item
        </Button>
      )}
    </Card>
  );
}
