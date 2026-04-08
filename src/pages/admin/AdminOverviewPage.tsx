import { RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { formatCurrency } from '@/lib/utils';

export default function AdminOverviewPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-slate-500">
        <RefreshCw className="animate-spin" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
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
      className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]"
    >
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-heading font-bold text-slate-900 mt-2 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Businesses, trials, and signups across VillageStock.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
        <div className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 md:p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
          <h2 className="font-heading font-semibold text-slate-900 mb-1 text-sm">Signups (last 30 days)</h2>
          <p className="text-xs text-slate-500 mb-4">Daily new shop registrations</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminSignupFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 30px -12px rgba(15,23,42,0.15)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#adminSignupFade)"
                  name="Signups"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-900/[0.06] bg-white p-5 md:p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
          <h2 className="font-heading font-semibold text-slate-900 mb-1 text-sm">Plan distribution</h2>
          <p className="text-xs text-slate-500 mb-4">Shops by plan type</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planBar} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 30px -12px rgba(15,23,42,0.15)',
                  }}
                />
                <Bar dataKey="count" radius={[10, 10, 4, 4]} name="Shops">
                  {planBar.map((_, index) => (
                    <Cell key={index} fill={index === 0 ? '#2563eb' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
