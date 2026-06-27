import { useMemo, useState } from 'react';
import { Search, RefreshCw, X, Building2 } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { cn, formatDate } from '@/lib/utils';
import type { AdminBusinessRow } from '@/types/admin';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  adminField,
  adminModalOverlay,
  adminModalPanel,
  adminRefreshBtn,
  adminTableHead,
  adminTableRow,
  adminTableWrap,
} from '@/pages/admin/adminUi';

export default function AdminBusinessesPage() {
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboardSnapshot(true);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [selected, setSelected] = useState<AdminBusinessRow | null>(null);

  const rows = useMemo(() => {
    if (!data?.businesses) return [];
    return data.businesses.filter(b => {
      if (!b.onboarding_complete) return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const blob = `${b.shop_name} ${b.owner_name} ${b.phone} ${b.email ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (plan !== 'all' && b.plan !== plan) return false;
      if (status !== 'all' && b.plan_status !== status) return false;
      return true;
    });
  }, [data?.businesses, search, plan, status]);

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
        {error instanceof Error ? error.message : 'Could not load businesses.'}
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Businesses" subtitle={`${rows.length} shops matching filters`}>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-muted" />
          <Input
            type="search"
            placeholder="Search shop, owner, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(adminField, 'pl-10')}
          />
        </div>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="rounded-xl border-shell-line bg-shell-surface px-4 py-2.5 text-sm font-medium text-shell-ink shadow-none">
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="rounded-xl border-shell-line bg-shell-surface px-4 py-2.5 text-sm font-medium text-shell-ink shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={adminTableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={adminTableHead}>
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Signup</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id} className={adminTableRow} onClick={() => setSelected(b)}>
                <td className="px-4 py-3 font-medium text-shell-ink">{b.shop_name || '—'}</td>
                <td className="px-4 py-3 text-shell-ink/90">{b.owner_name || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">{b.phone || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-shell-muted">
                  {b.created_at ? formatDate(b.created_at) : '—'}
                </td>
                <td className="px-4 py-3 capitalize text-shell-ink">{b.plan}</td>
                <td className="px-4 py-3 capitalize text-shell-muted">{b.plan_status}</td>
                <td className="px-4 py-3 text-right tabular-nums text-shell-ink">{b.inventory_count}</td>
                <td className="px-4 py-3 text-right tabular-nums text-shell-ink">{b.sales_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-shell-muted">No businesses match your filters.</p>
        )}
      </div>

      {selected ? (
        <div className={adminModalOverlay} role="dialog" onClick={() => setSelected(null)}>
          <div className={adminModalPanel} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-shell-line p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
                  <Building2 className="text-violet-300" size={22} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-shell-ink">{selected.shop_name || 'Shop'}</h2>
                  <p className="mt-0.5 font-mono text-xs text-shell-muted">{selected.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-shell-muted transition-colors hover:bg-shell-surface-2 hover:text-shell-ink"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <DetailRow label="Owner" value={selected.owner_name} />
              <DetailRow label="Phone" value={selected.phone} />
              <DetailRow label="Email" value={selected.email ?? '—'} />
              <DetailRow label="Address" value={selected.address || '—'} />
              <DetailRow label="Plan" value={`${selected.plan} · ${selected.plan_status}`} />
              <DetailRow label="Signup" value={selected.created_at ? formatDate(selected.created_at) : '—'} />
              <DetailRow label="Trial window" value={`${selected.trial_start_date} → ${selected.trial_end_date}`} />
              <DetailRow label="Account disabled" value={selected.account_disabled ? 'Yes' : 'No'} />
              <DetailRow label="Inventory items (excl. deleted)" value={String(selected.inventory_count)} />
              <DetailRow label="Sales records" value={String(selected.sales_count)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-shell-line/70 py-1.5 last:border-0">
      <span className="shrink-0 text-shell-muted">{label}</span>
      <span className="break-all text-right text-shell-ink">{value}</span>
    </div>
  );
}
