import { useProfitByCategory } from '@/hooks/useDashboardTrend';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { SimpleDonutChart } from '@/components/charts/LightCharts';

type AnalyticsProfitMixCardProps = {
  days: number;
};

export function AnalyticsProfitMixCard({ days }: AnalyticsProfitMixCardProps) {
  const { slices, isLoading } = useProfitByCategory(days);
  const total = slices.reduce((sum, slice) => sum + slice.profit, 0);

  return (
    <Card className="flex h-full flex-col border-shell-line bg-shell-surface p-4 shadow-none md:p-5">
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold text-shell-ink">Where profit comes from</h3>
        <p className="text-xs text-shell-muted">Category mix by gross profit</p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-shell-muted">Loading…</div>
      ) : slices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-shell-muted">
          No profit data in this period.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <SimpleDonutChart
            data={slices.map(slice => ({
              label: slice.cat,
              value: Math.max(slice.profit, 0),
              color: slice.color,
            }))}
            totalLabel={formatCurrency(total)}
          />
          <div className="flex w-full flex-1 flex-col gap-2.5">
            {slices.map(slice => (
              <div key={slice.cat} className="flex items-center gap-2 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="flex-1 capitalize text-shell-ink">{slice.cat}</span>
                <span className="font-mono font-semibold text-shell-muted">{slice.share}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
