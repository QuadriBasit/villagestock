import type { ReactNode } from 'react';
import { Children } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { useTheme } from '@/components/theme/ThemeProvider';
import { computeAdminPlatformMetrics, formatAdminGeneratedAt, type AdminAttentionItem } from '@/lib/adminDashboardMetrics';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { SimpleAreaChart, SimpleBarChart, SimpleDonutChart } from '@/components/charts/LightCharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { adminCard, adminRefreshBtn } from '@/pages/admin/adminUi';

const PLAN_COLORS: Record<string, string> = {
  Trial: '#00b398',
  Starter: '#34d399',
  Pro: '#60a5fa',
  Business: '#fbbf24',
};

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

  const { totals, signups_by_day, generated_at } = data;
  const metrics = computeAdminPlatformMetrics(data);
  const payingTotal = totals.paid_starter + totals.paid_pro + totals.paid_business;
  const conversionPct =
    totals.total_businesses > 0 ? Math.round((payingTotal / totals.total_businesses) * 100) : 0;

  const trialOnboarded = metrics.onboarded.filter(b => b.plan === 'trial').length;
  const planBar = [
    { name: 'Trial', count: trialOnboarded },
    { name: 'Starter', count: totals.paid_starter },
    { name: 'Pro', count: totals.paid_pro },
    { name: 'Business', count: totals.paid_business },
  ];

  const planDonut = planBar
    .filter(p => p.count > 0)
    .map(p => ({
      label: p.name,
      value: p.count,
      color: PLAN_COLORS[p.name] ?? '#94a3b8',
    }));

  const lineData = signups_by_day.map(d => ({
    ...d,
    label: d.day ? new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) : '',
  }));

  const weekSignups = metrics.recentSignups.filter(b => {
    const created = new Date(b.created_at).getTime();
    return Date.now() - created <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title="Platform overview"
        subtitle={
          generated_at
            ? `Live snapshot · updated ${formatAdminGeneratedAt(generated_at)}`
            : 'Businesses, trials, and platform activity across VillageStock.'
        }
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

      {/* Growth & revenue */}
      <section className="space-y-3">
        <SectionLabel icon={TrendingUp} label="Growth & revenue" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricCard
            icon={Building2}
            label="Registered shops"
            value={String(totals.total_businesses)}
            hint="Onboarding complete"
          />
          <MetricCard
            icon={UserPlus}
            label="New this month"
            value={String(totals.signups_month)}
            hint={`${totals.signups_today} today · ${weekSignups} this week`}
            accent="sky"
          />
          <MetricCard
            icon={Clock}
            label="Active trials"
            value={String(totals.trials_active)}
            hint={`${totals.trials_expired} expired`}
            accent="amber"
          />
          <MetricCard
            icon={Wallet}
            label="Paystack revenue"
            value={formatCurrency(Number(totals.revenue_ngn) || 0)}
            hint={`${payingTotal} paying · ${conversionPct}% conversion`}
            accent="emerald"
          />
        </div>
      </section>

      {/* Platform activity */}
      <section className="space-y-3">
        <SectionLabel icon={Package} label="Platform activity" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricCard
            icon={Package}
            label="Inventory items"
            value={metrics.totalInventory.toLocaleString()}
            hint={`~${metrics.avgInventoryPerShop} per shop`}
          />
          <MetricCard
            icon={ShoppingBag}
            label="Sales recorded"
            value={metrics.totalSales.toLocaleString()}
            hint={`~${metrics.avgSalesPerShop} per shop`}
          />
          <MetricCard
            icon={Users}
            label="Paid plans"
            value={String(payingTotal)}
            hint={`${totals.paid_starter} starter · ${totals.paid_pro} pro · ${totals.paid_business} biz`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Needs attention"
            value={String(metrics.attention.length)}
            hint={`${metrics.trialsExpiringSoon.length} trials ending · ${metrics.pendingOnboarding.length} pending`}
            accent="amber"
          />
        </div>
      </section>

      {/* Lists + attention */}
      <div className="grid gap-4 xl:grid-cols-3">
        <AdminListCard
          title="Needs attention"
          subtitle="Trials, inactive shops, and incomplete signups"
          empty="All clear — nothing flagged right now."
          footerHref="/admin/businesses"
          footerLabel="All businesses"
        >
          {metrics.attention.map(item => (
            <Link
              key={item.id}
              to="/admin/businesses"
              className="flex items-start justify-between gap-3 rounded-lg border border-shell-line/80 bg-shell-surface-2/30 px-3 py-2.5 transition-colors hover:bg-shell-surface-2/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-shell-ink">{item.shop_name}</p>
                <p className="text-[11px] text-shell-muted">{item.detail}</p>
              </div>
              <AttentionBadge kind={item.kind} />
            </Link>
          ))}
        </AdminListCard>

        <AdminListCard
          title="Recent signups"
          subtitle="Newest onboarded shops"
          empty="No recent signups."
          footerHref="/admin/businesses"
          footerLabel="View directory"
        >
          {metrics.recentSignups.map(b => (
            <Link
              key={b.id}
              to="/admin/businesses"
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-shell-surface-2/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-shell-ink">{b.shop_name || 'Unnamed'}</p>
                <p className="text-[11px] text-shell-muted">{b.owner_name || b.phone}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-shell-muted">{b.created_at ? formatDate(b.created_at) : '—'}</p>
                <p className="text-[10px] capitalize text-brand-300/90">{b.plan}</p>
              </div>
            </Link>
          ))}
        </AdminListCard>

        <AdminListCard
          title="Top shops by sales"
          subtitle="Most active on the platform"
          empty="No sales recorded yet."
          footerHref="/admin/businesses"
          footerLabel="Full rankings"
        >
          {metrics.topBySales.map((b, i) => (
            <Link
              key={b.id}
              to="/admin/businesses"
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-shell-surface-2/50"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 font-mono text-xs font-bold text-brand-200">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-shell-ink">{b.shop_name || 'Unnamed'}</p>
                <p className="text-[11px] text-shell-muted">{b.inventory_count} items in stock</p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-shell-ink">
                {b.sales_count}
              </span>
            </Link>
          ))}
        </AdminListCard>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
        <div className={cn(adminCard, 'lg:col-span-2')}>
          <h2 className="font-display text-sm font-semibold text-shell-ink">Signups (last 30 days)</h2>
          <p className="mb-4 text-xs text-shell-muted">Daily new shop registrations</p>
          <div className="h-72 w-full">
            <SimpleAreaChart
              data={lineData.map(point => ({ label: point.label, value: point.count }))}
              isDark={isDark}
              color="#00b398"
              valueFormatter={value => String(Math.round(value))}
            />
          </div>
        </div>

        <div className={adminCard}>
          <h2 className="font-display text-sm font-semibold text-shell-ink">Plan mix</h2>
          <p className="mb-2 text-xs text-shell-muted">Shops by subscription tier</p>
          <div className="flex min-h-[18rem] items-center justify-center py-2">
            {planDonut.length > 0 ? (
              <SimpleDonutChart data={planDonut} totalLabel={String(totals.total_businesses)} />
            ) : (
              <p className="text-sm text-shell-muted">No onboarded shops yet.</p>
            )}
          </div>
        </div>

        <div className={cn(adminCard, 'lg:col-span-3')}>
          <h2 className="font-display text-sm font-semibold text-shell-ink">Plan breakdown</h2>
          <p className="mb-4 text-xs text-shell-muted">Count by plan type</p>
          <div className="h-56 w-full md:h-64">
            <SimpleBarChart data={planBar.map(item => ({ label: item.name, value: item.count }))} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-brand-300/90" />
      <h2 className="text-xs font-bold uppercase tracking-wider text-shell-muted">{label}</h2>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'violet',
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
  accent?: 'violet' | 'sky' | 'amber' | 'emerald';
}) {
  const accentClass = {
    violet: 'bg-brand-500/15 text-brand-300',
    sky: 'bg-sky-500/15 text-sky-300',
    amber: 'bg-amber-500/15 text-amber-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
  }[accent];

  return (
    <div className={adminCard}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-shell-muted">{label}</p>
        <span className={cn('grid size-9 place-items-center rounded-xl', accentClass)}>
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums tracking-tight text-shell-ink md:text-[1.65rem]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-shell-muted">{hint}</p> : null}
    </div>
  );
}

function AdminListCard({
  title,
  subtitle,
  empty,
  footerHref,
  footerLabel,
  children,
}: {
  title: string;
  subtitle: string;
  empty: string;
  footerHref: string;
  footerLabel: string;
  children: ReactNode;
}) {
  const hasItems = Children.toArray(children).some(Boolean);

  return (
    <div className={cn(adminCard, 'flex flex-col')}>
      <div className="mb-4">
        <h2 className="font-display text-sm font-semibold text-shell-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-shell-muted">{subtitle}</p>
      </div>
      <div className="flex min-h-[12rem] flex-1 flex-col gap-1.5">
        {hasItems ? children : <p className="py-8 text-center text-sm text-shell-muted">{empty}</p>}
      </div>
      <Link
        to={footerHref}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
      >
        {footerLabel}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function AttentionBadge({ kind }: { kind: AdminAttentionItem['kind'] }) {
  const map = {
    trial_expiring: { label: 'Trial ending', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
    inactive: { label: 'Low activity', className: 'border-shell-line bg-shell-surface-2/50 text-shell-muted' },
    disabled: { label: 'Disabled', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
    onboarding_pending: { label: 'Pending', className: 'border-sky-500/30 bg-sky-500/10 text-sky-200' },
  } as const;
  const cfg = map[kind];
  return (
    <Badge variant="outline" className={cn('shrink-0 text-[10px]', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
