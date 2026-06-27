import { useMemo, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useSalesTrend } from '@/hooks/useSalesTrend';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { SimpleAreaChart, SimpleDonutChart } from '@/components/charts/LightCharts';

const PIE_PALETTE = ['#a78bfa', '#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#fb7185'];
const compactNumber = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 });
const compactCurrency = (value: number) => `₦${compactNumber.format(value)}`;

type CategorySlice = { name: string; value: number };

export function DashboardAnalytics({
  byCategory,
}: {
  byCategory: Record<string, { count: number; value: number }> | undefined;
}) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [range, setRange] = useState<7 | 30>(7);
  const { series, isLoading } = useSalesTrend(range);

  const pieData: CategorySlice[] = useMemo(() => {
    const src = byCategory ?? {};
    return Object.entries(src)
      .map(([name, stats]) => ({ name, value: stats.value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [byCategory]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="border-shell-line bg-shell-surface shadow-none lg:col-span-3">
        <CardContent className="space-y-3 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-sm font-semibold text-shell-ink">Revenue trend</p>
              <p className="text-xs text-shell-muted">Daily sales total</p>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-shell-line">
              {([7, 30] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRange(d)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium transition-colors',
                    range === d
                      ? 'bg-shell-surface-2 text-shell-ink'
                      : 'text-shell-muted hover:bg-shell-surface-2/40 hover:text-shell-ink',
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-[220px] w-full md:h-[260px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-shell-muted">Loading chart…</div>
            ) : (
              <SimpleAreaChart
                data={series.map(point => ({ label: point.label, value: point.revenue }))}
                isDark={isDark}
                color="#a78bfa"
                valueFormatter={compactCurrency}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-shell-line bg-shell-surface shadow-none lg:col-span-2">
        <CardContent className="flex h-full flex-col p-4 md:p-5">
          <div className="mb-1">
            <p className="font-display text-sm font-semibold text-shell-ink">Category mix</p>
            <p className="text-xs text-shell-muted">Value on hand</p>
          </div>
          <div className="relative flex min-h-[220px] flex-1 flex-col items-center justify-center md:min-h-[260px]">
            {pieData.length === 0 ? (
              <p className="text-center text-sm text-shell-muted">No inventory value yet</p>
            ) : (
              <SimpleDonutChart
                data={pieData.map((entry, index) => ({
                  label: entry.name,
                  value: entry.value,
                  color: PIE_PALETTE[index % PIE_PALETTE.length],
                }))}
                totalLabel={compactNumber.format(pieData.reduce((sum, entry) => sum + entry.value, 0))}
              />
            )}
          </div>
          {pieData.length > 0 ? (
            <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-shell-muted">
              {pieData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-1 capitalize">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }}
                  />
                  {d.name}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
