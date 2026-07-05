import { useMemo } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useDashboardTrend } from '@/hooks/useDashboardTrend';
import { Card } from '@/components/ui/Card';
import { cn, formatCurrency } from '@/lib/utils';
import { SimpleAreaChart } from '@/components/charts/LightCharts';

const compactNumber = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 });
const compactCurrency = (value: number) => `₦${compactNumber.format(value)}`;

type AnalyticsTrendCardProps = {
  days: 7 | 14;
  onDaysChange: (days: 7 | 14) => void;
};

export function AnalyticsTrendCard({ days, onDaysChange }: AnalyticsTrendCardProps) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const { series, isLoading } = useDashboardTrend(days);

  const totals = useMemo(
    () => ({
      revenue: series.reduce((sum, point) => sum + point.revenue, 0),
      profit: series.reduce((sum, point) => sum + point.profit, 0),
    }),
    [series]
  );

  return (
    <Card className="border-shell-line bg-shell-surface p-4 shadow-none md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-shell-ink">Revenue & profit trend</h3>
          <p className="text-xs text-shell-muted">
            {formatCurrency(totals.revenue)} revenue · {formatCurrency(totals.profit)} profit
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-shell-line">
          {([7, 14] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium transition-colors',
                days === d
                  ? 'bg-shell-surface-2 text-shell-ink'
                  : 'text-shell-muted hover:bg-shell-surface-2/40 hover:text-shell-ink'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="h-[240px] w-full min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-shell-muted">Loading chart…</div>
        ) : (
          <SimpleAreaChart
            data={series.map(point => ({ label: point.label, value: point.revenue }))}
            isDark={isDark}
            color="#a78bfa"
            valueFormatter={compactCurrency}
            maxXLabels={days === 7 ? 4 : 5}
          />
        )}
      </div>
    </Card>
  );
}
