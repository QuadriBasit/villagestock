import { useMemo, useState } from 'react';
import { CreditCard, RefreshCw, Search, X } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { AdminBusinessPlanPanel } from '@/components/admin/AdminBusinessPlanPanel';
import { AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { isPaidPlan, isTrialActive } from '@/lib/adminPlanHelpers';
import { AdminPlanBadge } from '@/components/admin/AdminPlanBadge';
import { cn, formatDate } from '@/lib/utils';
import type { AdminBusinessRow } from '@/types/admin';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { PAID_PLANS } from '@/lib/plans';
import {
  adminField,
  adminModalOverlay,
  adminModalPanel,
  adminRefreshBtn,
  adminTableHead,
  adminTableRow,
  adminTableWrap,
} from '@/pages/admin/adminUi';

export default function AdminSubscriptionsPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('all');
  const [selected, setSelected] = useState<AdminBusinessRow | null>(null);

  const rows = useMemo(() => {
    if (!data?.businesses) return [];
    return data.businesses
      .filter(b => b.onboarding_complete)
      .filter(b => {
        const q = search.trim().toLowerCase();
        if (q) {
          const blob = `${b.shop_name} ${b.owner_name} ${b.phone}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        if (plan !== 'all' && b.plan !== plan) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.plan === 'trial' && b.plan !== 'trial') return -1;
        if (b.plan === 'trial' && a.plan !== 'trial') return 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
  }, [data?.businesses, search, plan]);

  const summary = useMemo(() => {
    const onboarded = data?.businesses.filter(b => b.onboarding_complete) ?? [];
    return {
      trials: onboarded.filter(isTrialActive).length,
      paid: onboarded.filter(isPaidPlan).length,
      expired: onboarded.filter(b => b.plan_status === 'expired').length,
    };
  }, [data?.businesses]);

  if (isLoading) return <AdminPageLoader />;
  if (error || !data) return <AdminPageError message={error instanceof Error ? error.message : 'Could not load subscriptions.'} />;

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Subscriptions & plans"
        subtitle="Manage trial windows, upgrade shops, and control plan status across the platform."
      >
        <button type="button" onClick={() => refetch()} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PlanCard name="Trial (active)" count={summary.trials} />
        <PlanCard name="Paid (active)" count={summary.paid} />
        <PlanCard name="Expired / cancelled" count={summary.expired} />
        <div className="col-span-2 rounded-xl border border-shell-line bg-shell-surface p-4 md:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-shell-muted">Catalog</p>
          <ul className="mt-2 space-y-1 text-xs text-shell-muted">
            {PAID_PLANS.map(p => (
              <li key={p.id}>
                <span className="font-semibold capitalize text-shell-ink">{p.title}</span> · {p.priceLabel}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-muted" />
          <Input
            type="search"
            placeholder="Search shop or owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(adminField, 'pl-10')}
          />
        </div>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="rounded-xl border-shell-line bg-shell-surface px-4 py-2.5 text-sm font-medium shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={adminTableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={adminTableHead}>
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Trial ends</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Sales</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id} className={adminTableRow} onClick={() => setSelected(b)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-shell-ink">{b.shop_name || '—'}</p>
                  <p className="text-xs text-shell-muted">{b.owner_name}</p>
                </td>
                <td className="px-4 py-3">
                  <AdminPlanBadge plan={b.plan} status={b.plan_status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                  {b.plan === 'trial' && b.trial_end_date ? formatDate(b.trial_end_date) : '—'}
                </td>
                <td className="px-4 py-3 capitalize text-shell-muted">{b.plan_status}</td>
                <td className="px-4 py-3 text-right tabular-nums">{b.sales_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                  {b.updated_at ? formatDate(b.updated_at) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-shell-muted">No shops match your filters.</p>
        ) : null}
      </div>

      {selected ? (
        <div className={adminModalOverlay} role="dialog" onClick={() => setSelected(null)}>
          <div className={cn(adminModalPanel, 'max-w-xl')} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-shell-line p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-400/30 bg-brand-400/10">
                  <CreditCard className="text-brand-300" size={22} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-shell-ink">{selected.shop_name || 'Shop'}</h2>
                  <p className="text-xs text-shell-muted">{selected.owner_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-shell-muted hover:bg-shell-surface-2 hover:text-shell-ink"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <AdminBusinessPlanPanel business={selected} compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanCard({ name, count }: { name: string; count: number }) {
  return (
    <div className="rounded-xl border border-shell-line bg-shell-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-shell-muted">{name}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-shell-ink">{count}</p>
    </div>
  );
}
