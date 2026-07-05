import { useMemo, useState } from 'react';
import { RefreshCw, Search, Wallet } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { useAdminPayments } from '@/hooks/useAdminPayments';
import { AdminMetricTile, AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { SimpleBarChart } from '@/components/charts/LightCharts';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  adminField,
  adminRefreshBtn,
  adminTableHead,
  adminTableWrap,
} from '@/pages/admin/adminUi';

export default function AdminRevenuePage() {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const { data: snapshot, isLoading: snapLoading, isFetching, error: snapError, refetch } =
    useAdminDashboardSnapshot(true);
  const { data: payments, isLoading: payLoading, error: payError, refetch: refetchPay } =
    useAdminPayments(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const shopMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of snapshot?.businesses ?? []) {
      map.set(b.id, b.shop_name || b.owner_name || 'Shop');
    }
    return map;
  }, [snapshot?.businesses]);

  const rows = useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => {
      if (status !== 'all' && p.status !== status) return false;
      const shop = shopMap.get(p.user_id) ?? '';
      const q = search.trim().toLowerCase();
      if (q && !`${shop} ${p.plan} ${p.provider_ref ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, shopMap, search, status]);

  const revenueByPlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments ?? []) {
      if (p.status !== 'completed' && p.status !== 'success' && p.status !== 'paid') continue;
      map.set(p.plan, (map.get(p.plan) ?? 0) + p.amount_ngn);
    }
    return [...map.entries()].map(([name, amount]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), amount }));
  }, [payments]);

  const refreshAll = () => {
    void refetch();
    void refetchPay();
  };

  if (snapLoading || payLoading) return <AdminPageLoader />;
  if (snapError || payError || !snapshot) {
    return (
      <AdminPageError
        message={
          snapError instanceof Error
            ? snapError.message
            : payError instanceof Error
              ? payError.message
              : 'Could not load revenue data.'
        }
      />
    );
  }

  const paidTotal =
    snapshot.totals.paid_starter + snapshot.totals.paid_pro + snapshot.totals.paid_business;

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Revenue & payments" subtitle="Subscription payments and paid plan distribution.">
        <button type="button" onClick={refreshAll} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminMetricTile
          label="Recorded revenue"
          value={formatCurrency(snapshot.totals.revenue_ngn)}
          hint="From admin snapshot"
          icon={<Wallet size={16} />}
        />
        <AdminMetricTile label="Paid shops" value={String(paidTotal)} hint="Active paid plans" />
        <AdminMetricTile label="Starter" value={String(snapshot.totals.paid_starter)} />
        <AdminMetricTile label="Pro + Business" value={String(snapshot.totals.paid_pro + snapshot.totals.paid_business)} />
      </div>

      {revenueByPlan.length > 0 ? (
        <div className="rounded-xl border border-shell-line bg-shell-surface p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-shell-muted">Revenue by plan (payments)</p>
          <SimpleBarChart
            data={revenueByPlan.map(d => ({ label: d.name, value: d.amount }))}
            isDark={isDark}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-muted" />
          <Input
            type="search"
            placeholder="Search shop or reference…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(adminField, 'pl-10')}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="rounded-xl border-shell-line bg-shell-surface px-4 py-2.5 text-sm shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={adminTableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={adminTableHead}>
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-b border-shell-line last:border-0 hover:bg-shell-surface-2/35">
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3 font-medium text-shell-ink">{shopMap.get(p.user_id) ?? p.user_id.slice(0, 8)}</td>
                <td className="px-4 py-3 capitalize text-shell-ink">{p.plan}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(p.amount_ngn)}</td>
                <td className="px-4 py-3 capitalize text-shell-muted">{p.status}</td>
                <td className="px-4 py-3 text-shell-muted">{p.provider ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-shell-muted">No payments recorded yet.</p>
        ) : null}
      </div>
    </div>
  );
}
