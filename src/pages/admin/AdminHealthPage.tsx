import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { AdminBusinessPlanPanel } from '@/components/admin/AdminBusinessPlanPanel';
import { AdminMetricTile, AdminPageError, AdminPageLoader } from '@/components/admin/AdminPageHelpers';
import { computeAdminPlatformMetrics, type AdminAttentionItem } from '@/lib/adminDashboardMetrics';
import { AdminPlanBadge } from '@/components/admin/AdminPlanBadge';
import { cn, formatDate } from '@/lib/utils';
import type { AdminBusinessRow } from '@/types/admin';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  adminCard,
  adminModalOverlay,
  adminModalPanel,
  adminRefreshBtn,
  adminTableHead,
  adminTableRow,
  adminTableWrap,
} from '@/pages/admin/adminUi';

type HealthTab = 'attention' | 'onboarding' | 'disabled' | 'inactive';

const ATTENTION_STYLE: Record<AdminAttentionItem['kind'], string> = {
  trial_expiring: 'bg-amber-500/15 text-amber-200',
  inactive: 'bg-slate-500/15 text-slate-200',
  disabled: 'bg-red-500/15 text-red-200',
  onboarding_pending: 'bg-violet-500/15 text-violet-200',
};

export default function AdminHealthPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const [tab, setTab] = useState<HealthTab>('attention');
  const [selected, setSelected] = useState<AdminBusinessRow | null>(null);

  const metrics = useMemo(() => (data ? computeAdminPlatformMetrics(data) : null), [data]);

  const tabRows = useMemo(() => {
    if (!metrics || !data) return [];
    switch (tab) {
      case 'onboarding':
        return metrics.pendingOnboarding;
      case 'disabled':
        return metrics.disabledAccounts;
      case 'inactive':
        return metrics.inactiveShops;
      default:
        return [];
    }
  }, [tab, metrics, data]);

  if (isLoading) return <AdminPageLoader />;
  if (error || !data || !metrics) {
    return <AdminPageError message={error instanceof Error ? error.message : 'Could not load health data.'} />;
  }

  const findBusiness = (id: string) => data.businesses.find(b => b.id === id.replace(/-(disabled|inactive|pending)$/, ''));

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Platform health"
        subtitle="Shops needing attention — onboarding gaps, expiring trials, disabled accounts, and low activity."
      >
        <button type="button" onClick={() => refetch()} disabled={isFetching} className={adminRefreshBtn}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminMetricTile label="Needs attention" value={String(metrics.attention.length)} icon={<AlertTriangle size={16} />} />
        <AdminMetricTile label="Pending onboarding" value={String(metrics.pendingOnboarding.length)} icon={<UserPlus size={16} />} />
        <AdminMetricTile label="Disabled accounts" value={String(metrics.disabledAccounts.length)} />
        <AdminMetricTile label="Low activity shops" value={String(metrics.inactiveShops.length)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['attention', 'Attention queue'],
            ['onboarding', 'Onboarding'],
            ['disabled', 'Disabled'],
            ['inactive', 'Inactive'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              tab === key
                ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/25'
                : 'border border-shell-line text-shell-muted hover:bg-shell-surface-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attention' ? (
        <div className={adminCard}>
          <ul className="divide-y divide-shell-line">
            {metrics.attention.map(item => {
              const biz = findBusiness(item.id);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-shell-ink">{item.shop_name}</p>
                    <p className="text-sm text-shell-muted">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={ATTENTION_STYLE[item.kind]}>{item.kind.replace('_', ' ')}</Badge>
                    {biz ? (
                      <button
                        type="button"
                        onClick={() => setSelected(biz)}
                        className="text-sm font-semibold text-violet-300 hover:underline"
                      >
                        Manage
                      </button>
                    ) : null}
                    {item.kind === 'trial_expiring' && biz ? (
                      <Link to="/admin/trials" className="text-sm text-shell-muted hover:text-shell-ink">
                        Trials →
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {metrics.attention.length === 0 ? (
              <li className="py-8 text-center text-sm text-shell-muted">All clear — nothing flagged right now.</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div className={adminTableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={adminTableHead}>
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Signup</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {tabRows.map(b => (
                <tr key={b.id} className={adminTableRow} onClick={() => setSelected(b)}>
                  <td className="px-4 py-3 font-medium">{b.shop_name || '—'}</td>
                  <td className="px-4 py-3 text-shell-muted">{b.owner_name || '—'}</td>
                  <td className="px-4 py-3">
                    <AdminPlanBadge plan={b.plan} status={b.plan_status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                    {b.created_at ? formatDate(b.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.inventory_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.sales_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tabRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-shell-muted">No shops in this category.</p>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className={adminModalOverlay} role="dialog" onClick={() => setSelected(null)}>
          <div className={cn(adminModalPanel, 'max-w-xl')} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-shell-line p-5">
              <div>
                <h2 className="font-display font-bold text-shell-ink">{selected.shop_name || 'Shop'}</h2>
                <p className="text-xs text-shell-muted">{selected.owner_name}</p>
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
