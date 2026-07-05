import { useMemo } from 'react';
import { Activity, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { useAdminPlatformActivity } from '@/hooks/useAdminPlatformActivity';
import { AdminMetricTile, AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { computeAdminPlatformMetrics } from '@/lib/adminDashboardMetrics';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { SimpleAreaChart, SimpleBarChart } from '@/components/charts/LightCharts';
import { useTheme } from '@/components/theme/ThemeProvider';
import { adminRefreshBtn, adminTableHead, adminTableWrap } from '@/pages/admin/adminUi';

export default function AdminActivityPage() {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const { data: snapshot, isLoading: snapLoading, isFetching, error: snapError, refetch } =
    useAdminDashboardSnapshot(true);
  const { data: activity, isLoading: actLoading, error: actError, refetch: refetchAct } =
    useAdminPlatformActivity(true);

  const metrics = useMemo(() => (snapshot ? computeAdminPlatformMetrics(snapshot) : null), [snapshot]);

  const salesChart = useMemo(() => {
    if (!activity?.sales_by_day.length) return [];
    return activity.sales_by_day.map(d => ({
      ...d,
      label: d.day
        ? new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
        : '',
    }));
  }, [activity?.sales_by_day]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const row = activity?.sales_by_day.find(d => d.day === today);
    return { count: row?.count ?? 0, revenue: row?.revenue ?? 0 };
  }, [activity?.sales_by_day]);

  const refreshAll = () => {
    void refetch();
    void refetchAct();
  };

  if (snapLoading || actLoading) return <AdminPageLoader />;
  if (snapError || actError || !snapshot || !activity) {
    return (
      <AdminPageError
        message={
          snapError instanceof Error
            ? snapError.message
            : actError instanceof Error
              ? actError.message
              : 'Could not load activity.'
        }
      />
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Platform activity"
        subtitle="Sales volume, inventory totals, and live transaction feed (last 30 days)."
      >
        <button type="button" onClick={refreshAll} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminMetricTile
          label="Sales today"
          value={String(todayStats.count)}
          hint={formatCurrency(todayStats.revenue)}
          icon={<ShoppingBag size={16} />}
        />
        <AdminMetricTile
          label="Sales (30d sample)"
          value={String(activity.total_in_period)}
          hint="Up to 600 recent rows"
          icon={<Activity size={16} />}
        />
        <AdminMetricTile
          label="Platform inventory"
          value={String(metrics?.totalInventory ?? 0)}
          icon={<Package size={16} />}
        />
        <AdminMetricTile
          label="Total sales (all shops)"
          value={String(metrics?.totalSales ?? 0)}
          hint={`~${metrics?.avgSalesPerShop ?? 0} avg / shop`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-shell-line bg-shell-surface p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-shell-muted">Daily sales count</p>
          {salesChart.length > 0 ? (
            <SimpleBarChart data={salesChart.map(d => ({ label: d.label, value: d.count }))} isDark={isDark} />
          ) : (
            <p className="py-8 text-center text-sm text-shell-muted">No sales in the last 30 days.</p>
          )}
        </div>
        <div className="rounded-xl border border-shell-line bg-shell-surface p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-shell-muted">Daily revenue (NGN)</p>
          {salesChart.length > 0 ? (
            <SimpleAreaChart
              data={salesChart.map(d => ({ label: d.label, value: d.revenue }))}
              isDark={isDark}
              valueFormatter={v => formatCurrency(v)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-shell-muted">No revenue in the last 30 days.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-shell-line bg-shell-surface p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-shell-muted">Signups (14 days)</p>
        <SimpleBarChart
          data={snapshot.signups_by_day.slice(-14).map(d => ({
            label: d.day
              ? new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
              : '',
            value: d.count,
          }))}
          isDark={isDark}
        />
      </div>

      <div className={adminTableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={adminTableHead}>
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {activity.recent.map(s => (
              <tr key={s.id} className="border-b border-shell-line last:border-0 hover:bg-shell-surface-2/35">
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">{formatDate(s.sold_at)}</td>
                <td className="px-4 py-3 font-medium text-shell-ink">
                  {activity.shop_names[s.user_id] || 'Unknown shop'}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-shell-ink">{s.item_name || '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.quantity_sold}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {formatCurrency(s.sale_price * s.quantity_sold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activity.recent.length === 0 ? (
          <p className="py-12 text-center text-sm text-shell-muted">No recent sales.</p>
        ) : null}
      </div>
    </div>
  );
}
