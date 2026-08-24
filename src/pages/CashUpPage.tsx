import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Fuel, Plus, Wallet } from 'lucide-react';
import { setSetting, getSetting } from '@/lib/db';
import { EXPENSE_CATEGORY_ICONS, expenseCategoryLabel } from '@/lib/expenseCategories';
import { useTodayExpenses } from '@/hooks/useExpenses';
import { useExpenseActions } from '@/hooks/useExpenseActions';
import { useTodayTill } from '@/hooks/useTodayTill';
import { useCashSessions, useCashSessionActions } from '@/hooks/useCashSessions';
import { useShopLocation } from '@/context/ShopLocationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import AddExpenseModal from '@/components/cash/AddExpenseModal';
import { CashOverviewSection } from '@/components/cash/CashOverviewSection';
import CashCountModal from '@/components/cash/CashCountModal';
import { cn, formatCurrency } from '@/lib/utils';
import type { CashSessionRecord, ExpenseCategory, ExpenseRecord, PaymentMethod } from '@/types';

const EXPENSE_ICONS = EXPENSE_CATEGORY_ICONS;

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Transfer',
  pos: 'POS',
};

function formatSessionDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function CashUpPage() {
  const { expenses, summary: expSummary, isLoading: expLoading } = useTodayExpenses();
  const { recordExpense } = useExpenseActions();
  const { till, isLoading: tillLoading } = useTodayTill(expenses);
  const { sessions } = useCashSessions();
  const { closeCashDay } = useCashSessionActions();
  const { activeLocationId } = useShopLocation();

  const openingFloat = useLiveQuery(() => getSetting<number>('opening_float', 0), []);

  const [addOpen, setAddOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  const handleSaveExpense = async (input: {
    category: ExpenseCategory;
    label: string;
    amount: number;
    payment_method: PaymentMethod;
  }) => {
    if (!activeLocationId) return;
    await recordExpense({
      ...input,
      recorded_at: new Date().toISOString(),
      location_id: activeLocationId,
    });
  };

  if (expLoading || tillLoading || till === null) {
    return <div className="app-page py-8 text-sm text-shell-muted">Loading cash desk…</div>;
  }

  const tillRows = [
    { label: 'Opening float', value: formatCurrency(till.openingFloat), tone: 'text-shell-ink' },
    { label: 'Cash sales', value: `+${formatCurrency(till.cashSales)}`, tone: 'text-emerald-400' },
    { label: 'Cash collected on debts', value: `+${formatCurrency(till.cashCollected)}`, tone: 'text-emerald-400' },
    { label: 'Cash expenses', value: `−${formatCurrency(till.cashExpenses)}`, tone: 'text-red-400' },
  ] as const;

  return (
    <div className="app-page space-y-4 py-4 md:py-5">
      <PageHeader title="Cash & expenses" subtitle="What goes out, and what should be in the drawer right now">
        <Button
          variant="outline"
          size="sm"
          className="border-shell-line bg-transparent text-shell-ink hover:bg-shell-surface-2"
          onClick={() => setCountOpen(true)}
        >
          <Wallet size={16} />
          Close day
        </Button>
        <Button size="sm" className="bg-brand-400 text-[#04231d] hover:bg-brand-300" onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          Add expense
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Opening float" value={formatCurrency(till.openingFloat)} icon={Wallet} />
        <StatCard
          label="Cash sales today"
          value={formatCurrency(till.cashSales)}
          icon={Wallet}
          iconClassName=" text-emerald-400"
        />
        <StatCard
          label="Expenses today"
          value={formatCurrency(expSummary.total)}
          hint={`${expSummary.count} items`}
          hintClassName="text-amber-300"
          icon={Fuel}
          iconClassName=" text-amber-300"
        />
        <StatCard
          label="Expected in drawer"
          value={formatCurrency(till.expected)}
          icon={Wallet}
          iconClassName=" text-brand-300"
        />
      </StatGrid>

      <CashOverviewSection />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
          <div className="flex items-center justify-between border-b border-shell-line px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-shell-ink">Today&apos;s expenses</h3>
            <span className="font-mono text-sm font-semibold text-red-400">−{formatCurrency(expSummary.total)}</span>
          </div>
          {expenses.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-shell-muted">No expenses logged today.</p>
          ) : (
            <ul className="divide-y divide-shell-line">
              {expenses.map(e => (
                <ExpenseRow key={e.id} expense={e} />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center justify-center gap-2 border-t border-shell-line py-3 text-sm font-medium text-brand-300 transition-colors hover:bg-shell-surface-2/40"
          >
            <Plus size={16} />
            Add expense
          </button>
        </Card>

        <div className="space-y-4">
          <Card className="border-shell-line bg-shell-surface shadow-none">
            <CardContent className="space-y-3 p-4">
              <h3 className="font-display text-sm font-semibold text-shell-ink">The till — right now</h3>
              <div className="divide-y divide-shell-line">
                {tillRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] text-shell-muted">{row.label}</span>
                    <span className={cn('font-mono text-[13px] font-semibold tabular-nums', row.tone)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-brand-400/20 bg-brand-400/8 px-3 py-3">
                <span className="text-sm font-semibold text-shell-ink">Expected cash</span>
                <span className="font-mono text-xl font-bold tabular-nums text-shell-ink">
                  {formatCurrency(till.expected)}
                </span>
              </div>
              <Button
                className="w-full bg-brand-400 text-[#04231d] hover:bg-brand-300"
                onClick={() => setCountOpen(true)}
              >
                <Wallet size={16} />
                Count drawer & close day
              </Button>
            </CardContent>
          </Card>

          <Card className="border-shell-line bg-shell-surface shadow-none">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-display text-sm font-semibold text-shell-ink">Banked (non-cash) today</h3>
              <TillLine label="Transfer sales" value={till.transferSales} />
              <TillLine label="POS sales" value={till.posSales} />
              <TillLine label="Transfers on debts" value={till.transferCollected} />
            </CardContent>
          </Card>

          <Card className="border-shell-line bg-shell-surface shadow-none">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-display text-sm font-semibold text-shell-ink">Opening float</h3>
              <p className="text-xs text-shell-muted">
                Cash you started the day with in the drawer. Leave at ₦0 if you don&apos;t keep float in the drawer.
              </p>
              <CurrencyInput
                value={openingFloat ?? till.openingFloat}
                onValueChange={v => void setSetting('opening_float', v ?? 0)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {sessions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-semibold text-shell-ink">Past cash-ups</h3>
          <Card className="overflow-hidden border-shell-line bg-shell-surface p-0 shadow-none">
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_0.9fr] gap-3 border-b border-shell-line bg-shell-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-shell-muted">
                  <span>Day</span>
                  <span className="text-right">Expected</span>
                  <span className="text-right">Counted</span>
                  <span className="text-right">Variance</span>
                  <span className="text-right">By</span>
                </div>
                {sessions.map((s: CashSessionRecord) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1.1fr_1fr_1fr_1fr_0.9fr] gap-3 items-center border-b border-shell-line/80 px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-shell-ink">{formatSessionDay(s.closed_at)}</p>
                      <p className="font-mono text-[11px] text-shell-muted">{s.id.slice(0, 8)}</p>
                    </div>
                    <span className="text-right font-mono text-sm text-shell-muted">{formatCurrency(s.expected)}</span>
                    <span className="text-right font-mono text-sm font-semibold text-shell-ink">
                      {formatCurrency(s.counted)}
                    </span>
                    <span className="flex justify-end">
                      {s.variance === 0 ? (
                        <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">Balanced</Badge>
                      ) : (
                        <Badge
                          className={
                            s.variance < 0
                              ? 'border-red-500/25 bg-red-500/10 text-red-300'
                              : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                          }
                        >
                          {s.variance < 0 ? '−' : '+'}
                          {formatCurrency(Math.abs(s.variance))}
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-right text-xs text-shell-muted">{s.closed_by_label ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <AddExpenseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleSaveExpense}
      />

      {countOpen ? (
        <CashCountModal
          open={countOpen}
          till={till}
          onClose={() => setCountOpen(false)}
          onCloseDay={closeCashDay}
        />
      ) : null}
    </div>
  );
}

function ExpenseRow({ expense: e }: { expense: ExpenseRecord }) {
  const Icon = EXPENSE_ICONS[e.category] ?? Wallet;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-shell-line bg-shell-surface-2/50 text-amber-300">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-shell-ink">{e.label}</p>
        <p className="text-[11px] capitalize text-shell-muted">
          {expenseCategoryLabel(e.category)} · {formatTime(e.recorded_at)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold text-shell-ink">−{formatCurrency(e.amount)}</p>
        <Badge
          className={
            e.payment_method === 'cash'
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
              : 'border-shell-line bg-shell-surface-2 text-shell-muted'
          }
        >
          {PAY_LABELS[e.payment_method]}
        </Badge>
      </div>
    </li>
  );
}

function TillLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-t border-shell-line pt-2 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-shell-muted">{label}</span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-shell-ink">{formatCurrency(value)}</span>
    </div>
  );
}
