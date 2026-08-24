import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Package, XCircle, ChevronRight, Pencil } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useStockAlerts } from '@/hooks/useStockAlerts';
import {
  stockAlertBadgeClass,
  stockAlertLabel,
  type StockAlertKind,
  type StockAlertTone,
} from '@/lib/stockAlerts';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { DashboardSectionHead } from '@/components/dashboard/DashboardSectionHead';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import type { InventoryItem } from '@/types';

const KIND_BY_TONE: Record<StockAlertTone, StockAlertKind> = {
  error: 'out_of_stock',
  last_unit: 'last_unit',
  warning: 'low_stock',
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const { alerts, isLoading } = useStockAlerts();

  if (isLoading) return <AlertsSkeletonList />;

  const { lowStock, outOfStock, lastUnits, total } = alerts;

  if (total === 0) {
    return (
      <div className="app-page flex flex-col items-center px-4 py-20 text-center">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 size={28} className="text-emerald-400" />
        </div>
        <h2 className="font-display text-lg font-semibold text-shell-ink">All good</h2>
        <p className="mt-1 text-sm text-shell-muted">No stock alerts at the moment.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => navigate('/inventory')}
        >
          <Package size={16} />
          View inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Stock alerts"
        subtitle={`${total} alert${total !== 1 ? 's' : ''} need${total === 1 ? 's' : ''} your attention`}
      >
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => navigate('/inventory')}
        >
          <Package size={16} />
          Inventory
        </Button>
      </PageHeader>

      <StatGrid className="lg:grid-cols-3">
        <StatCard
          label="Out of stock"
          value={String(outOfStock.length)}
          icon={XCircle}
          iconClassName=" text-red-400"
        />
        <StatCard
          label="Low stock"
          value={String(lowStock.length)}
          icon={AlertTriangle}
          iconClassName=" text-amber-400"
        />
        <StatCard
          label="Last unit"
          value={String(lastUnits.length)}
          icon={Package}
          iconClassName=" text-orange-400"
        />
      </StatGrid>

      <div className="space-y-4">
        {outOfStock.length > 0 ? (
          <AlertSection
            title="Out of stock"
            count={outOfStock.length}
            tone="error"
            items={outOfStock}
            onEdit={id => navigate(`/inventory?edit=${id}`)}
          />
        ) : null}

        {lastUnits.length > 0 ? (
          <AlertSection
            title="Last unit"
            count={lastUnits.length}
            tone="last_unit"
            items={lastUnits}
            onEdit={id => navigate(`/inventory?edit=${id}`)}
          />
        ) : null}

        {lowStock.length > 0 ? (
          <AlertSection
            title="Low stock"
            count={lowStock.length}
            tone="warning"
            items={lowStock}
            onEdit={id => navigate(`/inventory?edit=${id}`)}
          />
        ) : null}
      </div>
    </div>
  );
}

function AlertSection({
  title,
  count,
  tone,
  items,
  onEdit,
}: {
  title: string;
  count: number;
  tone: StockAlertTone;
  items: InventoryItem[];
  onEdit: (id: string) => void;
}) {
  const borderAccent =
    tone === 'error' ? 'border-red-500/30' : tone === 'last_unit' ? 'border-orange-500/30' : 'border-amber-500/30';

  return (
    <Card className={cn('overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none', borderAccent, 'border-l-4')}>
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title={`${title} (${count})`} />
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <AlertRow key={item.id} item={item} tone={tone} onEdit={() => onEdit(item.id)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRow({ item, tone, onEdit }: { item: InventoryItem; tone: StockAlertTone; onEdit: () => void }) {
  const isSerialized = item.mode === 'serialized';
  const kind = KIND_BY_TONE[tone];
  const badgeText = stockAlertLabel(kind, item);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 rounded-lg border border-shell-line/80 bg-shell-surface-2/20 px-3 py-3 text-left transition-colors hover:bg-shell-surface-2/50"
    >
      <CategoryThumb category={item.category} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-shell-ink">{item.name}</p>
        <p className="truncate text-xs capitalize text-shell-muted">
          {item.brand} · {item.category}
          {isSerialized && item.serial_number ? ` · S/N ${item.serial_number}` : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-brand-200">{formatCurrency(item.price)}</span>
          <Badge className={stockAlertBadgeClass(tone, item)}>{badgeText}</Badge>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-400">
        <Pencil size={12} />
        Edit
        <ChevronRight size={14} />
      </span>
    </button>
  );
}
