import { useState } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { useMoneyOverview } from '@/hooks/useMoneyOverview';
import { useRecurringExpenses } from '@/hooks/useRecurringExpenses';
import { useRecurringExpenseActions } from '@/hooks/useRecurringExpenseActions';
import RecurringExpenseModal from '@/components/cash/RecurringExpenseModal';
import { MONEY_PERIOD_LABELS, RECURRENCE_LABELS, type MoneyPeriod } from '@/lib/moneyPeriods';
import { expenseCategoryLabel } from '@/lib/expenseCategories';
import { cn, formatCurrency } from '@/lib/utils';
import type { RecurringExpenseInput } from '@/types';

const PERIOD_OPTIONS = (Object.keys(MONEY_PERIOD_LABELS) as MoneyPeriod[]).map(value => ({
  value,
  label: MONEY_PERIOD_LABELS[value],
}));

export function CashOverviewSection() {
  const [period, setPeriod] = useState<MoneyPeriod>('month');
  const [recurringOpen, setRecurringOpen] = useState(false);
  const { overview, isLoading } = useMoneyOverview(period);
  const { items: recurring } = useRecurringExpenses();
  const { addRecurringExpense, removeRecurringExpense } = useRecurringExpenseActions();

  const saveRecurring = async (input: RecurringExpenseInput) => {
    await addRecurringExpense(input);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-shell-ink">Revenue & costs</h3>
          <p className="text-xs text-shell-muted">Sales vs logged expenses and fixed recurring costs</p>
        </div>
        <SegmentedTabs options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      {isLoading || !overview ? (
        <p className="text-sm text-shell-muted">Loading overview…</p>
      ) : (
        <StatGrid>
          <StatCard
            label={`Revenue · ${overview.rangeLabel.toLowerCase()}`}
            value={formatCurrency(overview.revenue)}
            icon={TrendingUp}
            iconClassName="text-emerald-400"
          />
          <StatCard
            label="Logged expenses"
            value={formatCurrency(overview.loggedExpenses)}
            hint={`${overview.expenses.length} items`}
            icon={TrendingDown}
            iconClassName="text-red-400"
          />
          <StatCard
            label="Recurring (est.)"
            value={formatCurrency(overview.recurringEstimate)}
            hint={`${recurring.length} fixed cost${recurring.length === 1 ? '' : 's'}`}
            icon={TrendingDown}
            iconClassName="text-amber-300"
          />
          <StatCard
            label="Net (est.)"
            value={formatCurrency(overview.net)}
            hint="Revenue minus all costs"
            icon={TrendingUp}
            iconClassName={overview.net >= 0 ? 'text-brand-300' : 'text-red-400'}
          />
        </StatGrid>
      )}

      <Card className="border-shell-line bg-shell-surface shadow-none">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-shell-ink">Fixed recurring costs</h3>
              <p className="mt-0.5 text-xs text-shell-muted">
                Rent, salaries, LAWMA, security, and other regular outgoings — prorated into the period view above.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-shell-line"
              onClick={() => setRecurringOpen(true)}
            >
              <Plus size={14} />
              Add
            </Button>
          </div>

          {recurring.length === 0 ? (
            <p className="rounded-lg border border-dashed border-shell-line px-3 py-6 text-center text-xs text-shell-muted">
              No recurring costs yet. Add rent, staff salaries, LAWMA, security, or other fixed bills.
            </p>
          ) : (
            <ul className="divide-y divide-shell-line rounded-lg border border-shell-line">
              {recurring.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-shell-ink">{item.label}</p>
                    <p className="text-[11px] text-shell-muted">
                      {RECURRENCE_LABELS[item.recurrence]} · {expenseCategoryLabel(item.category)}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold tabular-nums text-shell-ink">
                    {formatCurrency(item.amount)}
                  </p>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-shell-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => void removeRecurringExpense(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {overview ? (
            <p className={cn('text-[11px] leading-relaxed text-shell-muted')}>
              Log one-off spends with <strong className="text-shell-muted">Add expense</strong>. Fixed costs here
              are estimated for the selected period — e.g. monthly rent counts fully in{' '}
              <strong className="text-shell-muted">This month</strong> and is split across weeks/days.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RecurringExpenseModal open={recurringOpen} onClose={() => setRecurringOpen(false)} onSave={saveRecurring} />
    </div>
  );
}
