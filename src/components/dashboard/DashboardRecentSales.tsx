import { useNavigate } from 'react-router-dom';
import { useSalesHistory } from '@/hooks/useSales';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardSectionHead } from './DashboardSectionHead';

function saleDateLabel(iso: string): string {
  const dateKey = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const time = new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  if (dateKey === today) return `Today · ${time}`;
  if (dateKey === yesterday) return `Yesterday · ${time}`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) + ` · ${time}`;
}

export function DashboardRecentSales() {
  const navigate = useNavigate();
  const { sales, isLoading } = useSalesHistory();
  const rows = sales.slice(0, 5);

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="Recent sales" action="All orders" onAction={() => navigate('/sales')} />

        {isLoading ? (
          <p className="py-4 text-sm text-shell-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-shell-muted">No sales recorded yet.</p>
        ) : (
          <div className="flex flex-col">
            {rows.map((s, idx) => {
              const total = s.sale_price * s.quantity_sold;
              const extra = s.quantity_sold > 1 ? ` · ${s.quantity_sold}×` : '';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate('/sales')}
                  className={`flex items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-shell-surface-2 ${idx > 0 ? 'border-t border-shell-line' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-shell-ink">
                      {s.item_name}
                      {extra}
                    </p>
                    <p className="truncate text-xs text-shell-muted">
                      {s.customer_name || 'Walk-in'} · {saleDateLabel(s.sold_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[13.5px] font-semibold text-shell-ink">{formatCurrency(total)}</p>
                    <p className="font-mono text-[11.5px] font-semibold text-emerald-400">
                      +{formatCurrency(s.profit)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
