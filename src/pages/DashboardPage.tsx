import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useStockSummary } from '@/hooks/useInventory';
import { useTodaySalesSummary } from '@/hooks/useSales';
import { useTodayReturnsSummary } from '@/hooks/useReturns';
import { useTodaySwapSummary } from '@/hooks/useSwaps';
import { useOutstandingCreditsSummary } from '@/hooks/useCredits';
import { useActiveRepairsSummary } from '@/hooks/useRepairs';
import {
  Package,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Smartphone,
  Laptop,
  Tablet,
  Headphones,
  Cpu,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  ArrowRightLeft,
  HandCoins,
  Wrench,
  Sparkles,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { DashboardAnalytics } from '@/components/dashboard/DashboardAnalytics';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { DashboardStockAccountability } from '@/components/dashboard/DashboardStockAccountability';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  phones: <Smartphone size={18} />,
  laptops: <Laptop size={18} />,
  tablets: <Tablet size={18} />,
  accessories: <Headphones size={18} />,
  parts: <Cpu size={18} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  phones:
    'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/15 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20',
  laptops:
    'bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/15 dark:bg-violet-500/12 dark:text-violet-300 dark:ring-violet-500/20',
  tablets: 'bg-teal/15 text-teal-dark ring-1 ring-teal/20 dark:bg-teal/12 dark:text-teal-300 dark:ring-teal/25',
  accessories:
    'bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/15 dark:bg-orange-500/12 dark:text-orange-300 dark:ring-orange-500/20',
  parts:
    'bg-zinc-500/10 text-zinc-600 ring-1 ring-zinc-500/10 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/20',
};

function MetricTile({
  label,
  value,
  icon,
  iconClass,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="ui-card-interactive group relative w-full p-4 text-left md:p-5">
      <span
        className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl ${iconClass} transition-transform duration-300 group-hover:scale-110`}
      >
        {icon}
      </span>
      <p className="text-3xl font-bold tabular-nums leading-[1.05] tracking-tight text-zinc-900 md:text-[2.1rem] dark:text-zinc-50">
        {value}
      </p>
      <p className="label-caps mt-2 max-w-[11rem] leading-snug text-zinc-500 dark:text-zinc-400">{label}</p>
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { summary, isLoading } = useStockSummary();
  const { summary: todaySales } = useTodaySalesSummary();
  const { summary: todayReturns } = useTodayReturnsSummary();
  const { summary: todaySwaps } = useTodaySwapSummary();
  const { summary: creditsSummary } = useOutstandingCreditsSummary();
  const { summary: repairsSummary } = useActiveRepairsSummary();
  const { isOnline, pendingCount } = useSyncStatus();
  const navigate = useNavigate();

  const firstName = user?.email?.split('@')[0] ?? 'there';
  const alertCount = (summary?.low_stock_count ?? 0) + (summary?.out_of_stock_count ?? 0);
  const totalItems = summary?.total_items ?? 0;
  const shelfHealthPct =
    totalItems === 0
      ? 100
      : Math.round(100 * ((totalItems - (summary?.out_of_stock_count ?? 0)) / totalItems));

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="app-page space-y-5 py-4 md:space-y-6 md:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps mb-1.5 flex flex-wrap items-center gap-2 text-primary">
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-amber-500" />
              Overview
            </span>
            <Badge variant={isOnline ? 'success' : 'secondary'} className="font-bold">
              {isOnline ? 'Live' : 'Offline'}
            </Badge>
          </p>
          <h2 className="text-3xl font-bold leading-none tracking-tighter text-zinc-900 sm:text-4xl md:text-[2.65rem] dark:text-zinc-50">
            {firstName}
            <span className="font-semibold text-zinc-400">,</span>
            <br className="sm:hidden" />
            <span className="block text-2xl font-semibold text-zinc-500 sm:inline sm:ml-2 sm:text-3xl md:text-[2rem] dark:text-zinc-400">
              your floor in one glance.
            </span>
          </h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-[0.18em]">Today</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </header>

      <Card className="border-sky-200/55 bg-sky-50/80 backdrop-blur-sm dark:border-sky-800/50 dark:bg-sky-950/35">
        <CardContent className="flex gap-3 py-3 !pt-4 md:gap-4 md:py-4 md:!pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/15 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-500/20">
            <Info size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
              {isOnline ? 'Your shop is connected' : 'You are working offline'}
            </p>
            <p className="text-xs leading-snug text-sky-900/85 dark:text-sky-200/80">
              {isOnline
                ? pendingCount > 0
                  ? `${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} will finish syncing in the background.`
                  : 'Inventory is up to date. Add sales and stock changes anytime.'
                : 'Edits are saved on this device first. They will sync automatically when you are back online.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/15 dark:border-primary/25">
        <CardContent className="space-y-2 py-4 !pt-4 md:py-4 md:!pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Shelf availability</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Units not marked out of stock vs total SKUs.</p>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {shelfHealthPct}%
            </Badge>
          </div>
          <Progress value={shelfHealthPct} className="h-2.5 bg-primary/10 dark:bg-primary/15" />
        </CardContent>
      </Card>

      <DashboardStockAccountability />

      {/* Hero — premium dark card */}
      <button
        type="button"
        onClick={() => navigate('/inventory')}
        className="relative w-full overflow-hidden rounded-2xl text-left text-white transition-all duration-200 hover:brightness-[1.03] active:scale-[0.998] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <div className="absolute inset-0 bg-[#111827]" />
        <div
          className="absolute inset-0 opacity-95 bg-[radial-gradient(ellipse_90%_70%_at_20%_0%,rgb(108_92_231/0.58),transparent_55%),radial-gradient(ellipse_70%_60%_at_90%_80%,rgb(255_107_61/0.38),transparent_50%),radial-gradient(ellipse_50%_40%_at_50%_100%,rgb(76_175_80/0.28),transparent_45%)]"
          aria-hidden
        />
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative p-5 md:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">Portfolio value</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <TrendingUp size={20} className="text-white/90" />
            </span>
          </div>
          <p className="text-4xl sm:text-5xl md:text-[3.25rem] font-extrabold tracking-tighter tabular-nums">
            {formatCurrency(summary?.total_value ?? 0)}
          </p>
          <p className="mt-2 max-w-md text-sm leading-snug text-white/70">
            {summary?.total_items ?? 0} SKU{(summary?.total_items ?? 0) !== 1 ? 's' : ''} · marked at selling price × quantity
          </p>
        </div>
      </button>

      <div className="label-caps text-zinc-500 px-0.5">Pulse</div>
      <div className="grid grid-cols-2 gap-2.5 md:gap-3 xl:grid-cols-4">
        <MetricTile
          label="Units in stock"
          value={summary?.total_items ?? 0}
          icon={<Package size={19} strokeWidth={2} />}
          iconClass="bg-primary/12 text-primary"
          onClick={() => navigate('/inventory')}
        />
        <MetricTile
          label="Sales today"
          value={todaySales.count}
          icon={<ShoppingCart size={19} strokeWidth={2} />}
          iconClass="bg-teal/12 text-teal-dark"
          onClick={() => navigate('/sales')}
        />
        <MetricTile
          label="Needs attention"
          value={alertCount}
          icon={<AlertTriangle size={19} strokeWidth={2} />}
          iconClass="bg-orange-500/12 text-accent-dark"
          onClick={() => navigate('/alerts')}
        />
        <MetricTile
          label="Out of stock"
          value={summary?.out_of_stock_count ?? 0}
          icon={<XCircle size={19} strokeWidth={2} />}
          iconClass="bg-red-500/12 text-red-600"
          onClick={() => navigate('/alerts')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DashboardAnalytics byCategory={summary?.by_category} />
        </div>
        <div className="lg:col-span-1">
          <RecentActivityFeed />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/sales')}
        className="ui-card-interactive relative w-full overflow-hidden p-4 text-left md:p-5"
      >
        <div className="absolute bottom-5 left-0 top-5 w-1 rounded-full bg-linear-to-b from-teal to-teal/40" aria-hidden />
        <div className="mb-3 flex items-center justify-between pl-4">
          <span className="label-caps text-teal-dark">Today&apos;s desk</span>
          <ShoppingCart size={18} className="text-teal-dark opacity-80" />
        </div>
        <div className="grid grid-cols-3 gap-3 pl-4 text-center sm:text-left">
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{todaySales.count}</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {todaySales.count === 1 ? 'Sold unit' : 'Sold units'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl dark:text-zinc-50">
              {formatCurrency(todaySales.revenue)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Revenue</p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold tabular-nums text-teal-dark sm:text-2xl dark:text-teal-300">
              {formatCurrency(todaySales.profit)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Profit</p>
          </div>
        </div>
      </button>

      {todayReturns.count > 0 && (
        <button
          type="button"
          onClick={() => navigate('/sales')}
          className="w-full overflow-hidden rounded-2xl bg-linear-to-br from-orange-500 via-accent to-rose-600 p-5 text-left text-white transition-all duration-200 hover:brightness-[1.03] active:scale-[0.998]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/85">Returns</span>
            <RotateCcw size={18} className="text-white/80" />
          </div>
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="text-4xl font-extrabold tabular-nums tracking-tighter">{todayReturns.count}</p>
              <p className="text-xs text-white/75 mt-1 font-medium">{todayReturns.count === 1 ? 'Return' : 'Returns'}</p>
            </div>
            <div className="border-l border-white/30 pl-8">
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(todayReturns.refund_value)}</p>
              <p className="text-xs text-white/75 mt-1 font-medium">Refunded</p>
            </div>
          </div>
        </button>
      )}

      {todaySwaps.count > 0 && (
        <button
          type="button"
          onClick={() => navigate('/sales')}
          className="w-full overflow-hidden rounded-2xl bg-linear-to-br from-primary-light to-primary-dark p-5 text-left text-white transition-all duration-200 hover:brightness-[1.03] active:scale-[0.998]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/85">Swaps</span>
            <ArrowRightLeft size={18} className="text-white/80" />
          </div>
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="text-4xl font-extrabold tabular-nums tracking-tighter">{todaySwaps.count}</p>
              <p className="text-xs text-white/75 mt-1 font-medium">{todaySwaps.count === 1 ? 'Swap' : 'Swaps'}</p>
            </div>
            <div className="border-l border-white/30 pl-8">
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(todaySwaps.tradeInValue)}</p>
              <p className="text-xs text-white/75 mt-1 font-medium">Trade-in</p>
            </div>
          </div>
        </button>
      )}

      {(creditsSummary.outstanding_amount > 0 || repairsSummary.active_count > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {creditsSummary.outstanding_amount > 0 && (
            <button type="button" onClick={() => navigate('/credits')} className="ui-card-interactive p-4 text-left md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-caps text-zinc-500 dark:text-zinc-400">Outstanding credits</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(creditsSummary.outstanding_amount)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {creditsSummary.overdue_count} overdue
                  </p>
                </div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/15">
                  <HandCoins size={24} />
                </span>
              </div>
            </button>
          )}
          {repairsSummary.active_count > 0 && (
            <button type="button" onClick={() => navigate('/engineers')} className="ui-card-interactive p-4 text-left md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-caps text-zinc-500 dark:text-zinc-400">With engineers</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {repairsSummary.active_count}
                  </p>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {repairsSummary.overdue_count} overdue
                  </p>
                </div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-500/10 text-zinc-700 ring-1 ring-zinc-500/10">
                  <Wrench size={24} />
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between px-0.5">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Categories</h3>
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="group flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider hover:gap-2 transition-all"
          >
            Open inventory <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(summary?.by_category ?? {}).map(([cat, catStats]) => {
            const { count, value } = catStats as { count: number; value: number };
            return (
              <button
                type="button"
                key={cat}
                onClick={() => navigate(`/inventory?category=${cat}`)}
                className="ui-card-interactive flex w-full items-center gap-3 px-4 py-3 md:gap-4 md:px-4 md:py-3.5"
              >
                <span
                  className={`rounded-2xl p-3 ${CATEGORY_COLORS[cat] ?? 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:ring-zinc-700/50'}`}
                >
                  {CATEGORY_ICONS[cat]}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{cat}</p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {count} unit{count !== 1 ? 's' : ''} on hand
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatCurrency(value)}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 px-0.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Shortcuts
        </h3>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            onClick={() => navigate('/inventory/new')}
            className="h-11 flex-1 rounded-full border-0 bg-linear-to-r from-primary to-accent hover:brightness-105"
          >
            <Package size={18} /> Add inventory
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/alerts')}
            className="h-11 flex-1 rounded-full"
          >
            <AlertTriangle size={18} className="text-accent-dark" /> Alert queue
          </Button>
        </div>
      </section>
    </div>
  );
}
