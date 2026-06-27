import { useNavigate } from 'react-router-dom';
import { useLowStockItems } from '@/hooks/useLowStockItems';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardSectionHead } from './DashboardSectionHead';

export function DashboardLowStockList() {
  const navigate = useNavigate();
  const { rows, isLoading } = useLowStockItems(6);

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="Restock alerts" action="Inventory" onAction={() => navigate('/inventory')} />

        {isLoading ? (
          <p className="py-4 text-sm text-shell-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-shell-muted">All SKUs above reorder levels.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ item, qty, tone }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/inventory?edit=${item.id}`)}
                className="flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-shell-surface-2"
              >
                <CategoryThumb category={item.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-shell-ink">{item.name}</p>
                  <p className="text-xs text-shell-muted">
                    {qty === 0
                      ? 'Out of stock'
                      : `${qty} left · reorder at ${item.low_stock_threshold}`}
                  </p>
                </div>
                <Badge
                  className={
                    tone === 'empty'
                      ? 'border-red-500/25 bg-red-500/10 text-red-300'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                  }
                >
                  {tone === 'empty' ? 'Empty' : 'Low'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
