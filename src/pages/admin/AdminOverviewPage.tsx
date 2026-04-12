import { RefreshCw } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { useTheme } from '@/components/theme/ThemeProvider';
import { formatCurrency } from '@/lib/utils';
import { SimpleAreaChart, SimpleBarChart } from '@/components/charts/LightCharts';

export default function AdminOverviewPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-slate-500 dark:text-zinc-400">
        <RefreshCw className="animate-spin" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
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
    <div
      key={label}
      className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:ring-white/[0.06] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-slate-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-zinc-50">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Businesses, trials, and signups across VillageStock.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {statCard('Registered shops', totals.total_businesses, 'Completed onboarding')}
        {statCard('New today', totals.signups_today)}
        {statCard('New this week', totals.signups_week)}
        {statCard('New this month', totals.signups_month)}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {statCard('Active trials', totals.trials_active)}
        {statCard('Expired trials', totals.trials_expired)}
        {statCard('Paying (all plans)', totals.paid_starter + totals.paid_pro + totals.paid_business)}
        {statCard('Revenue (Paystack)', formatCurrency(Number(totals.revenue_ngn) || 0), 'Completed payments only')}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <div className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] md:p-6 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:ring-white/[0.06] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]">
          <h2 className="mb-1 font-heading text-sm font-semibold text-slate-900 dark:text-zinc-50">Signups (last 30 days)</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-zinc-400">Daily new shop registrations</p>
          <div className="h-64 w-full">
            <SimpleAreaChart
              data={lineData.map(point => ({ label: point.label, value: point.count }))}
              isDark={isDark}
              color="#2563eb"
              valueFormatter={value => String(Math.round(value))}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] md:p-6 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:ring-white/[0.06] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)]">
          <h2 className="mb-1 font-heading text-sm font-semibold text-slate-900 dark:text-zinc-50">Plan distribution</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-zinc-400">Shops by plan type</p>
          <div className="h-64 w-full">
            <SimpleBarChart data={planBar.map(item => ({ label: item.name, value: item.count }))} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}
