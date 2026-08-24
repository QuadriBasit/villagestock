import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Wallet } from 'lucide-react';
import { useTodayExpenses } from '@/hooks/useExpenses';
import { usePurchases } from '@/hooks/usePurchases';
import { useTodaySalesSummary } from '@/hooks/useSales';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DashboardSectionHead } from './DashboardSectionHead';

export function DashboardMoneyGlance() {
  const navigate = useNavigate();
  const { shopOwnerId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();
  const { summary: expenses } = useTodayExpenses();
  const { supplierDebt } = usePurchases();
  const { summary: todaySales } = useTodaySalesSummary();

  const cashSalesToday = useLiveQuery(async () => {
    if (!shopOwnerId || !locationReady || !activeLocationId) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await db.sales_records
      .where('user_id')
      .equals(shopOwnerId)
      .filter(
        s =>
          s.location_id === activeLocationId &&
          new Date(s.sold_at) >= start &&
          s.payment_method === 'cash'
      )
      .toArray();
    return sales.reduce((a, s) => a + s.sale_price * s.quantity_sold, 0);
  }, [shopOwnerId, activeLocationId, locationReady]);

  const expectedDrawer = useMemo(() => {
    const cashIn = cashSalesToday ?? 0;
    return Math.max(0, cashIn - expenses.cash);
  }, [cashSalesToday, expenses.cash]);

  const rows = [
    { label: 'Expenses today', value: expenses.total, color: 'text-red-400', to: '/cashup' },
    { label: 'Owed to suppliers', value: supplierDebt, color: 'text-amber-400', to: '/purchasing' },
  ] as const;

  return (
    <Card className="border-shell-line bg-shell-surface">
      <CardContent className="p-4 md:p-5">
        <DashboardSectionHead title="Cash position" action="Cash desk" onAction={() => navigate('/cashup')} />

        <div className="mb-3 flex items-center justify-between rounded-xl bg-brand-400/[0.13] px-3.5 py-3">
          <div>
            <p className="text-xs text-shell-muted">Expected in drawer</p>
            <p className="mt-0.5 font-mono text-[22px] font-bold text-shell-ink">{formatCurrency(expectedDrawer)}</p>
            <p className="mt-1 text-[11px] text-shell-muted">
              {formatCurrency(cashSalesToday ?? 0)} cash in · {formatCurrency(expenses.cash)} cash out
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-[11px] border border-shell-line bg-shell-surface text-brand-400">
            <Wallet size={19} />
          </span>
        </div>

        <div className="flex flex-col">
          {rows.map((row, i) => (
            <button
              key={row.label}
              type="button"
              onClick={() => navigate(row.to)}
              className={`flex items-center justify-between rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-shell-surface-2 ${i > 0 ? 'border-t border-shell-line' : ''}`}
            >
              <span className="text-[13.5px] text-shell-muted">{row.label}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`font-mono text-[13.5px] font-semibold ${row.color}`}>
                  {formatCurrency(row.value)}
                </span>
                <ChevronRight size={14} className="text-shell-muted" />
              </span>
            </button>
          ))}
        </div>

        {todaySales.revenue > 0 && (
          <p className="mt-3 border-t border-shell-line pt-3 text-xs text-shell-muted">
            Total desk revenue today:{' '}
            <span className="font-semibold text-shell-ink">{formatCurrency(todaySales.revenue)}</span>
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-brand-400 hover:text-brand-300"
          onClick={() => navigate('/cashup')}
        >
          Count drawer & close day
        </Button>
      </CardContent>
    </Card>
  );
}
