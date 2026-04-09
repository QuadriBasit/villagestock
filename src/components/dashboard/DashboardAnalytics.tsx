import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useSalesTrend } from '@/hooks/useSalesTrend';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const PIE_PALETTE = ['#6C5CE7', '#FF6B3D', '#4CAF50', '#3B82F6', '#F59E0B', '#EC4899'];

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
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [byCategory]);

  const tickMuted = isDark ? '#9CA3AF' : '#6B7280';
  const grid = isDark ? '#1f2937' : '#e2e8f0';

  const tooltipContentStyle = {
    backgroundColor: isDark ? '#27272a' : '#FFFFFF',
    border: `1px solid ${isDark ? '#52525b' : '#e5e7eb'}`,
    borderRadius: 12,
    fontSize: 13,
    boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 8px 30px -12px rgba(15,23,42,0.12)',
  };
  const tooltipLabelStyle = { color: isDark ? '#fafafa' : '#0f172a', fontWeight: 500 as const };
  const tooltipItemStyle = { color: isDark ? '#fafafa' : '#0f172a' };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="border-zinc-200/80 dark:border-zinc-800/80 lg:col-span-3">
        <CardContent className="space-y-3 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#0F172A] dark:text-white">Revenue trend</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Daily sales total</p>
            </div>
            <div className="flex rounded-lg border border-zinc-200/90 bg-zinc-50/80 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/50">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRange(d)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                    range === d
                      ? 'bg-white text-[#6C5CE7] shadow-sm dark:bg-zinc-800 dark:text-violet-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-[220px] w-full md:h-[260px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: tickMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    tick={{ fill: tickMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value);
                      return [formatCurrency(Number.isFinite(n) ? n : 0), 'Revenue'];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6C5CE7"
                    strokeWidth={2}
                    fill="url(#revFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#6C5CE7', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-800/80 lg:col-span-2">
        <CardContent className="flex h-full flex-col p-4 md:p-5">
          <div className="mb-1">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">Category mix</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Value on hand</p>
          </div>
          <div className="relative flex min-h-[220px] flex-1 flex-col items-center justify-center md:min-h-[260px]">
            {pieData.length === 0 ? (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">No inventory value yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value);
                      return formatCurrency(Number.isFinite(n) ? n : 0);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {pieData.length > 0 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {pieData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-1 capitalize">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }}
                  />
                  {d.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
