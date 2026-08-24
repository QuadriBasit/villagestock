import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Pencil,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import { useInventoryItem } from '@/hooks/useInventory';
import { useProductUnits } from '@/hooks/useProductUnits';
import { useActiveRepairs } from '@/hooks/useRepairs';
import { useTradingGateState } from '@/hooks/useStockSessions';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { cn, formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { ItemInspectionPanel } from '@/components/inventory/ItemInspectionPanel';
import { ItemConditionMixPanel } from '@/components/inventory/ItemConditionMixPanel';
import { ItemIdentifierRegister } from '@/components/inventory/ItemIdentifierRegister';
import EditProductModal from '@/components/inventory/EditProductModal';
import { supportsWizardEdit } from '@/components/inventory/addProduct/parseItem';
import {
  conditionLabel,
  formatIdentifier,
  getInspectionFlags,
  getItemQty,
  getMarginPct,
  identifierKindForItem,
  itemSpecLine,
  primaryIdentifier,
  SERIALIZED_STATUS_LABELS,
} from '@/lib/inventoryDisplay';
import { formatCurrencyRange } from '@/lib/inventoryGrouping';
import { computeProductUnitMix } from '@/lib/productUnitMix';

const SaleForm = lazy(() => import('@/components/sales/SaleForm'));
const SwapForm = lazy(() => import('@/components/sales/SwapForm'));
const SendToEngineerForm = lazy(() => import('@/components/inventory/SendToEngineerForm'));
const TransferStockModal = lazy(() => import('@/components/inventory/TransferStockModal'));

export default function ItemDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { item, isLoading } = useInventoryItem(id);
  const { canViewProfit } = useShopAccess();
  const { locations } = useShopLocation();
  const tradingGate = useTradingGateState();
  const { repairs } = useActiveRepairs();
  const { units } = useProductUnits(item);

  const [sellOpen, setSellOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [engineerOpen, setEngineerOpen] = useState(false);
  const [engineerTarget, setEngineerTarget] = useState<InventoryItem | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const editOpen = searchParams.get('edit') === '1';

  const openEdit = () => {
    if (supportsWizardEdit(item?.category ?? 'parts')) {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set('edit', '1');
          return next;
        },
        { replace: true },
      );
      return;
    }
    navigate(`/inventory/${id}/edit`);
  };

  const closeEdit = () => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  };

  if (isLoading) {
    return <div className="app-page py-12 text-sm text-shell-muted">Loading item…</div>;
  }

  if (!item || item.deleted) {
    return (
      <div className="app-page flex flex-col items-center py-20 text-center">
        <p className="font-medium text-shell-ink">Item not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/inventory')}>
          Back to inventory
        </Button>
      </div>
    );
  }

  const isSerialized = item.mode === 'serialized';
  const status = item.status ?? 'in_stock';
  const qty = getItemQty(item);
  const margin = getMarginPct(item);
  const flags = getInspectionFlags(item);
  const tradeLocked = tradingGate.gateApplies && tradingGate.isReady && tradingGate.tradingBlocked;
  const canSell = !tradeLocked && (isSerialized ? status === 'in_stock' : item.quantity > 0);
  const canSwap = !tradeLocked && isSerialized && status === 'in_stock';
  const canEngineer = !tradeLocked && isSerialized && status === 'in_stock';
  const engineerName = repairs.find(r => r.item_id === item.id)?.engineer_name;
  const idKind = identifierKindForItem(item);
  const idCode = primaryIdentifier(item);
  const inStockUnits = units.filter(u => u.status === 'in_stock').length;
  const onBenchUnits = units.filter(u => u.status === 'with_engineer' || u.status === 'defective').length;
  const fleetMix = isSerialized && units.length > 1 ? computeProductUnitMix(units) : null;
  const showFleetStats = fleetMix && (fleetMix.priceMin !== fleetMix.priceMax || fleetMix.costMin !== fleetMix.costMax);
  const benchItem = engineerTarget ?? item;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <Link
        to="/inventory"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-shell-muted transition-colors hover:text-shell-ink"
      >
        <ArrowLeft size={15} />
        Inventory
      </Link>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Card className="border-shell-line bg-shell-surface p-0 shadow-none">
          <CardContent className="space-y-5 p-4 md:p-5">
            <div className="flex gap-4">
              <CategoryThumb category={item.category} size="lg" className="!h-[72px] !w-[72px] shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {isSerialized && !item.condition ? (
                    <Badge className="border-shell-line bg-shell-surface-2 text-shell-ink">
                      {SERIALIZED_STATUS_LABELS[status] ?? status}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{conditionLabel(item.condition)}</Badge>
                  )}
                  {flags.map(flag => (
                    <Badge
                      key={flag}
                      className="border-amber-500/25 bg-amber-500/10 text-amber-200"
                    >
                      {flag}
                    </Badge>
                  ))}
                </div>
                <h1 className="mt-2 font-display text-xl font-semibold text-shell-ink md:text-[22px]">
                  {item.name}
                </h1>
                <p className="mt-0.5 text-[13.5px] text-shell-muted">{itemSpecLine(item)}</p>
                {engineerName ? (
                  <p className="mt-1 text-xs text-shell-muted">Repair: {engineerName}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <StatTile
                label={showFleetStats ? 'Price range' : 'Selling price'}
                value={
                  showFleetStats
                    ? formatCurrencyRange(fleetMix!.priceMin, fleetMix!.priceMax)
                    : formatCurrency(item.price)
                }
              />
              {canViewProfit ? (
                <>
                  <StatTile
                    label={showFleetStats ? 'Cost range' : 'Cost'}
                    value={
                      showFleetStats
                        ? formatCurrencyRange(fleetMix!.costMin, fleetMix!.costMax)
                        : formatCurrency(item.cost_price ?? 0)
                    }
                  />
                  <StatTile
                    label="Margin"
                    value={showFleetStats ? 'Per unit' : `${margin}%`}
                    accent={!showFleetStats}
                  />
                </>
              ) : (
                <>
                  <StatTile
                    label="In stock"
                    value={
                      isSerialized && units.length > 1
                        ? `${inStockUnits} / ${units.length}`
                        : String(qty)
                    }
                  />
                  <StatTile label="Category" value={item.category} />
                </>
              )}
            </div>

            {idKind && idCode ? (
              <div className="rounded-lg border border-shell-line bg-shell-surface-2/35 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-shell-muted">
                  {idKind}
                </p>
                <p className="mt-1 font-mono text-[15px] font-medium tracking-wide text-shell-ink">
                  {formatIdentifier(idCode, idKind)}
                </p>
              </div>
            ) : null}

            <div className="divide-y divide-shell-line rounded-lg border border-shell-line">
              <DetailField
                label="In stock"
                value={
                  isSerialized && units.length > 1
                    ? `${inStockUnits} ready${onBenchUnits ? ` · ${onBenchUnits} on bench` : ''}`
                    : `${qty} ${qty === 1 ? 'unit' : 'units'}`
                }
              />
              {!isSerialized ? (
                <DetailField label="Reorder level" value={String(item.low_stock_threshold)} />
              ) : null}
              {item.barcode ? <DetailField label="Barcode" value={item.barcode} mono /> : null}
              <DetailField label="Margin" value={`${margin}%`} mono />
              <DetailField label="SKU" value={item.id.slice(0, 8).toUpperCase()} mono />
            </div>

            <ItemConditionMixPanel units={units} />
            {units.length <= 1 ? <ItemInspectionPanel item={item} /> : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-shell-line bg-shell-surface p-0 shadow-none">
            <CardContent className="flex flex-col gap-2 p-3">
              <Button
                className="h-10 w-full justify-start bg-brand-400 text-[#04231d] hover:bg-brand-300"
                disabled={!canSell}
                onClick={() => setSellOpen(true)}
              >
                <ShoppingCart size={16} />
                Sell this item
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full justify-start border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                onClick={openEdit}
              >
                <Pencil size={16} />
                Edit item
              </Button>
              {isSerialized ? (
                <>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-start border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                    disabled={!canSwap}
                    onClick={() => setSwapOpen(true)}
                  >
                    <ArrowRightLeft size={16} />
                    Swap
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-start border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
                    disabled={!canEngineer}
                    onClick={() => setEngineerOpen(true)}
                  >
                    <Wrench size={16} />
                    Send for repair
                  </Button>
                </>
              ) : null}
              <Button
                variant="ghost"
                className="h-9 w-full justify-between text-shell-muted hover:text-shell-ink disabled:opacity-50"
                disabled={locations.length < 2 || !item.location_id || qty <= 0}
                onClick={() => setTransferOpen(true)}
              >
                Transfer between branches
                <ChevronRight size={16} />
              </Button>
            </CardContent>
          </Card>

          {isSerialized ? (
            <ItemIdentifierRegister
              item={item}
              activeId={item.id}
              onSendToBench={unit => {
                setEngineerTarget(unit);
                setEngineerOpen(true);
              }}
            />
          ) : null}

          <StockAlert item={item} qty={qty} />
        </div>
      </div>

      {sellOpen ? (
        <Suspense fallback={null}>
          <SaleForm item={item} onClose={() => setSellOpen(false)} onSuccess={() => setSellOpen(false)} />
        </Suspense>
      ) : null}
      {swapOpen ? (
        <Suspense fallback={null}>
          <SwapForm item={item} onClose={() => setSwapOpen(false)} onSuccess={() => setSwapOpen(false)} />
        </Suspense>
      ) : null}
      {engineerOpen ? (
        <Suspense fallback={null}>
          <SendToEngineerForm
            item={benchItem}
            onClose={() => {
              setEngineerOpen(false);
              setEngineerTarget(null);
            }}
            onSuccess={() => {
              setEngineerOpen(false);
              setEngineerTarget(null);
            }}
          />
        </Suspense>
      ) : null}

      {transferOpen ? (
        <Suspense fallback={null}>
          <TransferStockModal
            open
            presetItem={item}
            onClose={() => setTransferOpen(false)}
            onSuccess={() => setTransferOpen(false)}
          />
        </Suspense>
      ) : null}

      {editOpen && supportsWizardEdit(item.category) ? (
        <EditProductModal open itemId={id} onClose={closeEdit} />
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-3',
        accent ? 'bg-emerald-500/10' : 'bg-shell-surface-2/50'
      )}
    >
      <p className="text-[11px] text-shell-muted">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-base font-semibold tabular-nums',
          accent ? 'text-emerald-400' : 'text-shell-ink'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span className="text-[13px] text-shell-muted">{label}</span>
      <span className={cn('text-[13px] font-medium text-shell-ink', mono && 'font-mono tabular-nums')}>
        {value}
      </span>
    </div>
  );
}

function StockAlert({ item, qty }: { item: InventoryItem; qty: number }) {
  const low = item.mode === 'non_serialized' ? qty <= item.low_stock_threshold : qty <= 1 && qty > 0;
  const out = qty === 0;
  const healthy = !out && !low;

  return (
    <Card
      className={cn(
        'border-shell-line p-0 shadow-none',
        out || low ? 'border-amber-500/25 bg-amber-500/10' : 'bg-shell-surface'
      )}
    >
      <CardContent className="flex gap-3 p-4">
        {healthy ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
        )}
        <p className="text-[13px] leading-relaxed text-shell-ink">
          {out
            ? 'Out of stock — reorder before you lose sales.'
            : low
              ? item.mode === 'serialized'
                ? 'Last unit for this model at this branch.'
                : `Only ${qty} left. You usually reorder at ${item.low_stock_threshold}.`
              : 'Healthy stock level. No action needed.'}
        </p>
      </CardContent>
    </Card>
  );
}
