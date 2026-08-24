import { formatDistanceToNow } from 'date-fns';
import { ArrowRightLeft, RotateCcw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSalesHistory } from '@/hooks/useSales';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardSectionHead } from './DashboardSectionHead';
import type { SalesRecord } from '@/types';

function activityIcon(sale: SalesRecord) {
  if (sale.sale_type === 'swap') return <ArrowRightLeft size={16} className="text-brand-400" />;
  if (sale.returned) return <RotateCcw size={16} className="text-orange-400" />;
  return <ShoppingCart size={16} className="text-emerald-400" />;
}

function activityLabel(sale: SalesRecord): string {
  if (sale.sale_type === 'swap') return 'Swap';
  if (sale.returned) return 'Returned sale';
  return 'Sale';
}

export function RecentActivityFeed({ limit = 10 }: { limit?: number }) {
  const navigate = useNavigate();
  const { sales, isLoading } = useSalesHistory();
  const rows = sales.slice(0, limit);

  return (
    <Card className="h-full border-shell-line bg-shell-surface">
      <CardContent className="flex h-full flex-col p-4 md:p-5">
        <DashboardSectionHead title="Recent activity" action="View all" onAction={() => navigate('/sales')} />
        <p className="-mt-2 mb-3 text-xs text-shell-muted">Latest transactions</p>
        <ul className="min-h-[200px] flex-1 space-y-0 overflow-y-auto" aria-label="Recent transactions">
          {isLoading && (
            <li className="py-6 text-center text-sm text-shell-muted">Loading…</li>
          )}
          {!isLoading && rows.length === 0 && (
            <li className="py-6 text-center text-sm text-shell-muted">No sales yet</li>
          )}
          {!isLoading &&
            rows.map(sale => (
              <li key={sale.id}>
                <button
                  type="button"
                  onClick={() => navigate('/sales')}
                  className="flex w-full items-start gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-shell-surface-2"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-shell-surface-2">
                    {activityIcon(sale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-shell-muted">
                        {activityLabel(sale)}
                      </span>
                      <span className="text-xs text-shell-muted">
                        {formatDistanceToNow(new Date(sale.sold_at), { addSuffix: true })}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-sm font-medium text-shell-ink">{sale.item_name}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-shell-muted">
                      {formatCurrency(sale.sale_price * sale.quantity_sold)}
                      {sale.quantity_sold > 1 ? ` ×${sale.quantity_sold}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
