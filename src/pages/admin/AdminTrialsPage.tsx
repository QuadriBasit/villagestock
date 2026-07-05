import { useMemo, useState } from 'react';
import { Clock, RefreshCw, X } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { AdminBusinessPlanPanel } from '@/components/admin/AdminBusinessPlanPanel';
import { AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { trialDaysRemaining } from '@/lib/adminPlanHelpers';
import { AdminPlanBadge } from '@/components/admin/AdminPlanBadge';
import { computeAdminPlatformMetrics } from '@/lib/adminDashboardMetrics';
import { cn, formatDate } from '@/lib/utils';
import type { AdminBusinessRow } from '@/types/admin';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  adminModalOverlay,
  adminModalPanel,
  adminRefreshBtn,
  adminTableHead,
  adminTableRow,
  adminTableWrap,
} from '@/pages/admin/adminUi';

type TrialFilter = 'all' | 'active' | 'expiring' | 'expired';

export default function AdminTrialsPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const { extendTrial, isPending } = useAdminActions();
  const [filter, setFilter] = useState<TrialFilter>('expiring');
  const [selected, setSelected] = useState<AdminBusinessRow | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const metrics = useMemo(() => (data ? computeAdminPlatformMetrics(data) : null), [data]);

  const rows = useMemo(() => {
    if (!data?.businesses) return [];
    const trials = data.businesses.filter(b => b.onboarding_complete && b.plan === 'trial');
    return trials
      .filter(b => {
        const days = trialDaysRemaining(b.trial_end_date);
        if (filter === 'active') return b.plan_status === 'active' && (days == null || days > 0);
        if (filter === 'expired') return b.plan_status === 'expired' || (days != null && days <= 0);
        if (filter === 'expiring') {
          return (
            b.plan_status === 'active' &&
            days != null &&
            days > 0 &&
            days <= 7
          );
        }
        return true;
      })
      .sort((a, b) => a.trial_end_date.localeCompare(b.trial_end_date));
  }, [data?.businesses, filter]);

  const extendAllExpiring = async () => {
    if (!metrics?.trialsExpiringSoon.length) return;
    setBulkMsg(null);
    try {
      for (const b of metrics.trialsExpiringSoon) {
        await extendTrial(b.id, b.trial_end_date, 14);
      }
      setBulkMsg(`Extended ${metrics.trialsExpiringSoon.length} trial(s) by 14 days.`);
      await refetch();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : 'Bulk extend failed.');
    }
  };

  if (isLoading) return <AdminPageLoader />;
  if (error || !data) return <AdminPageError message={error instanceof Error ? error.message : 'Could not load trials.'} />;

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Trials"
        subtitle={`${data.totals.trials_active} active · ${data.totals.trials_expired} expired · ${metrics?.trialsExpiringSoon.length ?? 0} ending within 7 days`}
      >
        <button type="button" onClick={() => refetch()} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {(['expiring', 'active', 'expired', 'all'] as TrialFilter[]).map(f => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'expiring' ? 'Expiring (7d)' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        {filter === 'expiring' && (metrics?.trialsExpiringSoon.length ?? 0) > 0 ? (
          <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => void extendAllExpiring()}>
            Extend all +14 days
          </Button>
        ) : null}
      </div>

      {bulkMsg ? (
        <p className="rounded-lg bg-violet-500/15 px-3 py-2 text-sm text-violet-200">{bulkMsg}</p>
      ) : null}

      <div className={adminTableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={adminTableHead}>
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Trial ends</th>
              <th className="px-4 py-3">Days left</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Sales</th>
              <th className="px-4 py-3">Quick extend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => {
              const days = trialDaysRemaining(b.trial_end_date);
              return (
                <tr key={b.id} className={adminTableRow}>
                  <td className="px-4 py-3" onClick={() => setSelected(b)}>
                    <p className="font-medium text-shell-ink">{b.shop_name || '—'}</p>
                    <p className="text-xs text-shell-muted">{b.owner_name}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-shell-muted" onClick={() => setSelected(b)}>
                    {b.trial_end_date ? formatDate(b.trial_end_date) : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums" onClick={() => setSelected(b)}>
                    <span className={cn(days != null && days <= 7 && days > 0 ? 'text-amber-300' : 'text-shell-ink')}>
                      {days == null ? '—' : days <= 0 ? 'Expired' : days}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={() => setSelected(b)}>
                    <AdminPlanBadge plan={b.plan} status={b.plan_status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" onClick={() => setSelected(b)}>
                    {b.inventory_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" onClick={() => setSelected(b)}>
                    {b.sales_count}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {[7, 30].map(d => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => void extendTrial(b.id, b.trial_end_date, d).then(() => refetch())}
                        >
                          +{d}d
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-shell-muted">No trials in this view.</p>
        ) : null}
      </div>

      {selected ? (
        <div className={adminModalOverlay} role="dialog" onClick={() => setSelected(null)}>
          <div className={cn(adminModalPanel, 'max-w-xl')} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-shell-line p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
                  <Clock className="text-amber-300" size={22} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-shell-ink">{selected.shop_name || 'Shop'}</h2>
                  <p className="text-xs text-shell-muted">Trial management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-shell-muted hover:bg-shell-surface-2"
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
