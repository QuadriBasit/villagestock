import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PiggyBank, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { getLastDaysRange, useReportMetrics } from '@/hooks/useReports';
import { useShopAccess } from '@/context/ShopAccessContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { AlertsSkeletonList } from '@/components/ui/Skeleton';
import { AnalyticsTrendCard } from '@/components/analytics/AnalyticsTrendCard';
import { AnalyticsProfitMixCard } from '@/components/analytics/AnalyticsProfitMixCard';
import { AnalyticsTopEarners } from '@/components/analytics/AnalyticsTopEarners';
import { formatCurrency } from '@/lib/utils';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { canViewProfit } = useShopAccess();
  const [days, setDays] = useState<7 | 14>(14);
  const range = useMemo(() => getLastDaysRange(days), [days]);
  const { metrics, isLoading } = useReportMetrics(range);

  if (isLoading) return <AlertsSkeletonList />;

  const marginPct = metrics.revenue > 0 ? Math.round((metrics.profit / metrics.revenue) * 100) : 0;
  const avgOrder = metrics.salesCount > 0 ? metrics.revenue / metrics.salesCount : 0;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader
        title="Pricing & profit"
        subtitle={`Last ${days} days · margins, category mix, and top earners`}
      >
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => navigate('/reports')}
        >
          Full reports
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Revenue" value={formatCurrency(metrics.revenue)} icon={TrendingUp} />
        {canViewProfit ? (
          <StatCard
            label="Gross profit"
            value={formatCurrency(metrics.profit)}
            icon={PiggyBank}
            iconClassName="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          />
        ) : (
          <StatCard label="Orders" value={String(metrics.salesCount)} icon={ShoppingCart} />
        )}
        <StatCard label="Avg. margin" value={`${marginPct}%`} icon={BarChart3} />
        <StatCard label="Avg. order" value={formatCurrency(avgOrder)} icon={Tag} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsTrendCard days={days} onDaysChange={setDays} />
        <AnalyticsProfitMixCard days={days} />
      </div>

      <AnalyticsTopEarners days={days} canViewProfit={canViewProfit} />
    </div>
  );
}
