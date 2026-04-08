import { useMemo, useState } from 'react';
import { Search, RefreshCw, X, Building2 } from 'lucide-react';
import { useAdminDashboardSnapshot } from '@/hooks/useAdminDashboardSnapshot';
import { formatDate } from '@/lib/utils';
import type { AdminBusinessRow } from '@/types/admin';

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
      <div className="flex justify-center py-24 text-slate-500">
        <RefreshCw className="animate-spin" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
        {error instanceof Error ? error.message : 'Could not load businesses.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Businesses</h1>
          <p className="text-sm text-slate-500 mt-1">{rows.length} shops matching filters</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search shop, owner, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-full border border-slate-200/90 bg-white pl-10 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
          />
        </div>
        <select
          value={plan}
          onChange={e => setPlan(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm"
        >
          <option value="all">All plans</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-3xl border border-slate-900/[0.06] bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
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
          <tbody className="divide-y divide-slate-100">
            {rows.map(b => (
              <tr
                key={b.id}
                className="hover:bg-slate-50/80 cursor-pointer"
                onClick={() => setSelected(b)}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{b.shop_name || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{b.owner_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{b.phone || '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {b.created_at ? formatDate(b.created_at) : '—'}
                </td>
                <td className="px-4 py-3 capitalize">{b.plan}</td>
                <td className="px-4 py-3 capitalize">{b.plan_status}</td>
                <td className="px-4 py-3 text-right tabular-nums">{b.inventory_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{b.sales_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-slate-500 py-12 text-sm">No businesses match your filters.</p>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Building2 className="text-teal-700" size={22} />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-slate-900">{selected.shop_name || 'Shop'}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selected.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
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
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 text-right break-all">{value}</span>
    </div>
  );
}
