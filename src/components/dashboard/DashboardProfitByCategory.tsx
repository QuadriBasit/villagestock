import { useNavigate } from 'react-router-dom';
import { useProfitByCategory } from '@/hooks/useDashboardTrend';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { SimpleDonutChart } from '@/components/charts/LightCharts';
import { DashboardSectionHead } from './DashboardSectionHead';

export function DashboardProfitByCategory() {
  const navigate = useNavigate();
  const { slices, isLoading } = useProfitByCategory(14);

  const total = slices.reduce((a, s) => a + s.profit, 0);

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="Profit by category" action="Analytics" onAction={() => navigate('/analytics')} />

        {isLoading ? (
          <p className="py-8 text-center text-sm text-shell-muted">Loading…</p>
        ) : slices.length === 0 ? (
          <p className="py-8 text-center text-sm text-shell-muted">No profit data in the last 14 days.</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <SimpleDonutChart
              data={slices.map(s => ({
                label: s.cat,
                value: Math.max(s.profit, 0),
                color: s.color,
              }))}
              totalLabel={formatCurrency(total)}
            />
            <div className="flex w-full flex-1 flex-col gap-2">
              {slices.map(s => (
                <div key={s.cat} className="flex items-center gap-2 text-[13px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 capitalize text-shell-ink">{s.cat}</span>
                  <span className="font-mono font-semibold text-shell-muted">{s.share}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
