import { useMemo, useState } from 'react';
import { RefreshCw, UserPlus } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { computeAdminPlatformMetrics } from '@/lib/adminDashboardMetrics';
import { AdminPlanBadge } from '@/components/admin/AdminPlanBadge';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { SimpleBarChart } from '@/components/charts/LightCharts';
import { useTheme } from '@/components/theme/ThemeProvider';
import { adminRefreshBtn, adminTableHead, adminTableWrap } from '@/pages/admin/adminUi';

export default function AdminSignupsPage() {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const [days, setDays] = useState(30);

  const metrics = useMemo(() => (data ? computeAdminPlatformMetrics(data) : null), [data]);

  const chartData = useMemo(() => {
    if (!data?.signups_by_day) return [];
    return data.signups_by_day.slice(-days).map(d => ({
      label: d.day
        ? new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
        : '',
      value: d.count,
    }));
  }, [data?.signups_by_day, days]);

  if (isLoading) return <AdminPageLoader />;
  if (error || !data) return <AdminPageError message={error instanceof Error ? error.message : 'Could not load signups.'} />;

  const recent = metrics?.recentSignups ?? [];
  const pending = metrics?.pendingOnboarding ?? [];

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Signups"
        subtitle={`${data.totals.signups_today} today · ${data.totals.signups_week} this week · ${data.totals.signups_month} this month`}
      >
        <button type="button" onClick={() => refetch()} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="flex gap-2">
        {[14, 30, 90].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={
              days === d
                ? 'rounded-xl bg-brand-500/15 px-3 py-1.5 text-sm font-semibold text-brand-200 ring-1 ring-brand-400/25'
                : 'rounded-xl border border-shell-line px-3 py-1.5 text-sm text-shell-muted hover:bg-shell-surface-2'
            }
          >
            {d} days
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-shell-line bg-shell-surface p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-shell-muted">New shops per day</p>
        <SimpleBarChart data={chartData} isDark={isDark} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-shell-muted">
            <UserPlus size={16} />
            Recent onboarded shops
          </h2>
          <div className={adminTableWrap}>
            <table className="w-full text-left text-sm">
              <thead className={adminTableHead}>
                <tr>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Plan</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(b => (
                  <tr key={b.id} className="border-b border-shell-line last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.shop_name || '—'}</p>
                      <p className="text-xs text-shell-muted">{b.owner_name}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                      {b.created_at ? formatDate(b.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <AdminPlanBadge plan={b.plan} status={b.plan_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-shell-muted">Stuck in onboarding</h2>
          <div className={adminTableWrap}>
            <table className="w-full text-left text-sm">
              <thead className={adminTableHead}>
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Started</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(b => (
                  <tr key={b.id} className="border-b border-shell-line last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.owner_name || b.shop_name || '—'}</p>
                      <p className="text-xs text-shell-muted">{b.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-shell-muted">{b.phone || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                      {b.created_at ? formatDate(b.created_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pending.length === 0 ? (
              <p className="py-8 text-center text-sm text-shell-muted">Everyone finished onboarding.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
