import { RefreshCw } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { useTheme } from '@/components/theme/ThemeProvider';
import { formatCurrency } from '@/lib/utils';
import { SimpleAreaChart, SimpleBarChart } from '@/components/charts/LightCharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { adminCard, adminRefreshBtn, adminStatCard } from '@/pages/admin/adminUi';

export default function AdminOverviewPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-shell-muted">
        <RefreshCw className="animate-spin" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error instanceof Error ? error.message : 'Could not load dashboard.'} Ensure the database migration is applied and your
        user is in <code className="font-mono">admin_users</code>.
      </div>
    );
  }

  const { totals, signups_by_day, businesses } = data;
  const trialOnboarded = businesses.filter(b => b.onboarding_complete && b.plan === 'trial').length;
  const planBar = [
    { name: 'Trial', count: trialOnboarded },
    { name: 'Starter', count: totals.paid_starter },
    { name: 'Pro', count: totals.paid_pro },
    { name: 'Business', count: totals.paid_business },
  ];

  const lineData = signups_by_day.map(d => ({
    ...d,
    label: d.day ? new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) : '',
  }));

  const statCard = (label: string, value: string | number, sub?: string) => (
    <div key={label} className={adminStatCard}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-shell-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-shell-ink">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-shell-muted">{sub}</p> : null}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Businesses, trials, and signups across VillageStock."
      >
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className={adminRefreshBtn}
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {statCard('Registered shops', totals.total_businesses, 'Completed onboarding')}
        {statCard('New today', totals.signups_today)}
        {statCard('New this week', totals.signups_week)}
        {statCard('New this month', totals.signups_month)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {statCard('Active trials', totals.trials_active)}
        {statCard('Expired trials', totals.trials_expired)}
        {statCard('Paying (all plans)', totals.paid_starter + totals.paid_pro + totals.paid_business)}
        {statCard('Revenue (Paystack)', formatCurrency(Number(totals.revenue_ngn) || 0), 'Completed payments only')}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <div className={adminCard}>
          <h2 className="mb-1 font-display text-sm font-semibold text-shell-ink">Signups (last 30 days)</h2>
          <p className="mb-4 text-xs text-shell-muted">Daily new shop registrations</p>
          <div className="h-64 w-full">
            <SimpleAreaChart
              data={lineData.map(point => ({ label: point.label, value: point.count }))}
              isDark={isDark}
              color="#a78bfa"
              valueFormatter={value => String(Math.round(value))}
            />
          </div>
        </div>

        <div className={adminCard}>
          <h2 className="mb-1 font-display text-sm font-semibold text-shell-ink">Plan distribution</h2>
          <p className="mb-4 text-xs text-shell-muted">Shops by plan type</p>
          <div className="h-64 w-full">
            <SimpleBarChart data={planBar.map(item => ({ label: item.name, value: item.count }))} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}
