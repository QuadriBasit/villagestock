import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useShopLocation } from '@/context/ShopLocationContext';
import { useStockSummary } from '@/hooks/useInventory';
import { useTodaySalesSummary } from '@/hooks/useSales';
import { useOutstandingCreditsSummary } from '@/hooks/useCredits';
import { usePurchases } from '@/hooks/usePurchases';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import {
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  Truck,
  HandCoins,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardTodayHeader } from '@/components/dashboard/DashboardTodayHeader';
import { DashboardRevenueCard } from '@/components/dashboard/DashboardRevenueCard';
import { DashboardRecentSales } from '@/components/dashboard/DashboardRecentSales';
import { DashboardQuickActions } from '@/components/dashboard/DashboardQuickActions';
import { DashboardMoneyGlance } from '@/components/dashboard/DashboardMoneyGlance';
import { DashboardLowStockList } from '@/components/dashboard/DashboardLowStockList';
import { DashboardRepairsMini } from '@/components/dashboard/DashboardRepairsMini';
import { DashboardProfitByCategory } from '@/components/dashboard/DashboardProfitByCategory';
import { DashboardPortfolioStrip } from '@/components/dashboard/DashboardPortfolioStrip';
import { DashboardStockAccountability } from '@/components/dashboard/DashboardStockAccountability';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { useTodayReturnsSummary } from '@/hooks/useReturns';
import { useTodaySwapSummary } from '@/hooks/useSwaps';
import { useActiveRepairsSummary } from '@/hooks/useRepairs';

type DashboardLayout = 'overview' | 'operations' | 'analytics';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { canViewProfit, canAccessFinancialNav } = useShopAccess();
  const { profile: businessProfile } = useBusinessProfile();
  const { locations, activeLocationId } = useShopLocation();
  const { summary, isLoading } = useStockSummary();
  const { summary: todaySales } = useTodaySalesSummary();
  const { summary: todayReturns } = useTodayReturnsSummary();
  const { summary: todaySwaps } = useTodaySwapSummary();
  const { summary: creditsSummary } = useOutstandingCreditsSummary();
  const { summary: repairsSummary } = useActiveRepairsSummary();
  const { supplierDebt } = usePurchases();
  const { pendingCount } = useSyncStatus();
  const navigate = useNavigate();

  const [layout, setLayout] = useState<DashboardLayout>('overview');

  const branchName = locations.find(l => l.id === activeLocationId)?.name;
  const alertCount = (summary?.low_stock_count ?? 0) + (summary?.out_of_stock_count ?? 0);
  const totalItems = summary?.total_items ?? 0;
  const shelfHealthPct =
    totalItems === 0
      ? 100
      : Math.round(100 * ((totalItems - (summary?.out_of_stock_count ?? 0)) / totalItems));

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <DashboardTodayHeader
        ownerName={businessProfile?.owner_name}
        email={user?.email}
        branchName={branchName}
        todayRevenue={todaySales.revenue}
      />

      <StatGrid>
        <StatCard
          label="Today's revenue"
          value={formatCurrency(todaySales.revenue)}
          icon={ShoppingCart}
          iconClassName="text-brand-400"
          hint={todaySales.count > 0 ? `${todaySales.count} units sold` : undefined}
        />
        {canViewProfit ? (
          <StatCard
            label="Today's profit"
            value={formatCurrency(todaySales.profit)}
            icon={TrendingUp}
            iconClassName="text-emerald-400"
          />
        ) : (
          <StatCard label="Units sold" value={String(todaySales.count)} icon={ShoppingCart} />
        )}
        {canAccessFinancialNav && (
          <StatCard
            label="Owed to you"
            value={formatCurrency(creditsSummary.outstanding_amount)}
            icon={HandCoins}
            iconClassName="text-amber-400"
            hint={creditsSummary.overdue_count > 0 ? `${creditsSummary.overdue_count} overdue` : undefined}
            hintClassName="text-red-400"
          />
        )}
        {canAccessFinancialNav && (
          <StatCard
            label="Owed to suppliers"
            value={formatCurrency(supplierDebt)}
            icon={Truck}
            iconClassName="text-blue-400"
          />
        )}
      </StatGrid>

      <DashboardPortfolioStrip summary={summary} alertCount={alertCount} shelfHealthPct={shelfHealthPct} />

      {pendingCount > 0 && (
        <Card className="border-amber-500/25 bg-amber-500/10">
          <CardContent className="py-3 text-sm text-amber-200">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} waiting to sync to the cloud.
          </CardContent>
        </Card>
      )}

      <SegmentedTabs
        options={[
          { value: 'overview' as const, label: 'Overview' },
          { value: 'operations' as const, label: 'Operations' },
          { value: 'analytics' as const, label: 'Analytics' },
        ]}
        value={layout}
        onChange={setLayout}
      />

      {layout === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <div className="flex flex-col gap-4 xl:col-span-8">
              <DashboardRevenueCard />
              <DashboardRecentSales />
            </div>
            <div className="flex flex-col gap-4 xl:col-span-4">
              <DashboardQuickActions />
              <DashboardMoneyGlance />
              <DashboardLowStockList />
              <DashboardRepairsMini />
            </div>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <DashboardStockAccountability />
            <RecentActivityFeed limit={10} />
          </div>
        </div>
      )}

      {layout === 'operations' && (
        <div className="flex flex-col gap-4">
          <DashboardQuickActions />
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardLowStockList />
            <DashboardRepairsMini />
            <DashboardRecentSales />
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <DashboardRevenueCard />
            </div>
            <div className="xl:col-span-4">
              <DashboardMoneyGlance />
            </div>
          </div>
          <TodayPulseCards
            canAccessFinancialNav={canAccessFinancialNav}
            todayReturns={todayReturns}
            todaySwaps={todaySwaps}
            creditsSummary={creditsSummary}
            repairsSummary={repairsSummary}
            onNavigate={navigate}
          />
        </div>
      )}

      {layout === 'analytics' && (
        <div className="flex flex-col gap-4">
          <DashboardRevenueCard />
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-12">
            <div className="flex flex-col gap-4 xl:col-span-5">
              <DashboardProfitByCategory />
              <DashboardMoneyGlance />
            </div>
            <div className="flex flex-col gap-4 xl:col-span-7">
              <DashboardRecentSales />
              <RecentActivityFeed limit={12} />
            </div>
          </div>
          <DashboardLowStockList />
        </div>
      )}
    </div>
  );
}

function TodayPulseCards({
  canAccessFinancialNav,
  todayReturns,
  todaySwaps,
  creditsSummary,
  repairsSummary,
  onNavigate,
}: {
  canAccessFinancialNav: boolean;
  todayReturns: { count: number; refund_value: number };
  todaySwaps: { count: number; tradeInValue: number };
  creditsSummary: { outstanding_amount: number; overdue_count: number };
  repairsSummary: { active_count: number; overdue_count: number };
  onNavigate: (path: string) => void;
}) {
  const cards = [];

  if (todayReturns.count > 0) {
    cards.push(
      <PulseCard
        key="returns"
        label="Returns today"
        value={String(todayReturns.count)}
        sub={formatCurrency(todayReturns.refund_value) + ' refunded'}
        icon={<RotateCcw size={18} />}
        onClick={() => onNavigate('/sales')}
      />
    );
  }
  if (todaySwaps.count > 0) {
    cards.push(
      <PulseCard
        key="swaps"
        label="Swaps today"
        value={String(todaySwaps.count)}
        sub={formatCurrency(todaySwaps.tradeInValue) + ' trade-in'}
        icon={<ArrowRightLeft size={18} />}
        onClick={() => onNavigate('/sales')}
      />
    );
  }
  if (canAccessFinancialNav && creditsSummary.outstanding_amount > 0) {
    cards.push(
      <PulseCard
        key="credits"
        label="Outstanding credits"
        value={formatCurrency(creditsSummary.outstanding_amount)}
        sub={`${creditsSummary.overdue_count} overdue`}
        icon={<HandCoins size={18} />}
        onClick={() => onNavigate('/credits')}
      />
    );
  }
  if (repairsSummary.active_count > 0) {
    cards.push(
      <PulseCard
        key="repairs"
        label="Active repairs"
        value={String(repairsSummary.active_count)}
        sub={`${repairsSummary.overdue_count} overdue`}
        icon={<AlertTriangle size={18} />}
        onClick={() => onNavigate('/repair')}
      />
    );
  }

  if (cards.length === 0) return null;

  return <div className="grid gap-3 sm:grid-cols-2">{cards}</div>;
}

function PulseCard({
  label,
  value,
  sub,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-shell-line bg-shell-surface p-4 text-left transition-colors hover:border-brand-400/30 hover:bg-shell-surface-2"
    >
      <div className="mb-2 flex items-center justify-between text-shell-muted">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-shell-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-shell-ink">{value}</p>
      <p className="mt-0.5 text-xs text-shell-muted">{sub}</p>
    </button>
  );
}
