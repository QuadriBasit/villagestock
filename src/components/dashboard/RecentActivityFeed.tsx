import { formatDistanceToNow } from 'date-fns';
import { ArrowRightLeft, RotateCcw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSalesHistory } from '@/hooks/useSales';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import type { SalesRecord } from '@/types';

function activityIcon(sale: SalesRecord) {
  if (sale.sale_type === 'swap') return <ArrowRightLeft size={16} className="text-[#6C5CE7]" />;
  if (sale.returned) return <RotateCcw size={16} className="text-[#FF6B3D]" />;
  return <ShoppingCart size={16} className="text-[#4CAF50]" />;
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
    <Card className="border-zinc-200/80 dark:border-zinc-800/80">
      <CardContent className="p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">Recent activity</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Latest transactions</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="text-xs font-semibold text-[#6C5CE7] hover:underline dark:text-violet-300"
          >
            View all
          </button>
        </div>
        <ul className="max-h-[320px] space-y-0 overflow-y-auto md:max-h-[360px]" aria-label="Recent transactions">
          {isLoading && (
            <li className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">Loading…</li>
          )}
          {!isLoading && rows.length === 0 && (
            <li className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">No sales yet</li>
          )}
          {!isLoading &&
            rows.map((sale) => (
              <li key={sale.id}>
                <button
                  type="button"
                  onClick={() => navigate('/sales')}
                  className="flex w-full items-start gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
                    {activityIcon(sale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {activityLabel(sale)}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500" aria-hidden>
                        ·
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {formatDistanceToNow(new Date(sale.sold_at), { addSuffix: true })}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-sm font-medium text-[#0F172A] dark:text-zinc-100">
                      {sale.item_name}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-[#6B7280] dark:text-[#9CA3AF]">
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
