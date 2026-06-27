import { useTopEarners } from '@/hooks/useDashboardTrend';
import { CategoryThumb } from '@/components/inventory/CategoryThumb';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { Category } from '@/types';

type AnalyticsTopEarnersProps = {
  days: number;
  canViewProfit: boolean;
};

export function AnalyticsTopEarners({ days, canViewProfit }: AnalyticsTopEarnersProps) {
  const { earners, isLoading } = useTopEarners(days);
  const maxProfit = earners[0]?.profit ?? 0;

  if (!canViewProfit) return null;

  return (
    <Card className="border-shell-line bg-shell-surface p-4 shadow-none md:p-5">
      <div className="mb-4">
        <h3 className="font-display text-sm font-semibold text-shell-ink">Top earners — profit</h3>
        <p className="text-xs text-shell-muted">Best-performing products in the last {days} days</p>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-shell-muted">Loading…</p>
      ) : earners.length === 0 ? (
        <p className="py-8 text-center text-sm text-shell-muted">No sales in this period yet.</p>
      ) : (
        <div className="space-y-3.5">
          {earners.map(row => (
            <div key={row.key} className="flex items-center gap-3">
              <CategoryThumb category={row.category as Category} size="sm" className="border-shell-line bg-shell-surface-2/40" />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-shell-ink">{row.name}</span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-shell-ink">
                    {formatCurrency(row.profit)}
                  </span>
                </div>
                <ProgressBar value={row.profit} max={maxProfit} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-shell-muted">
                {row.sold} sold
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-shell-surface-2">
      <div className="h-full rounded-full bg-violet-400/75" style={{ width: `${pct}%` }} />
    </div>
  );
}
