import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { ExpenseRecurrence } from '@/types';

export type MoneyPeriod = 'today' | 'week' | 'month' | 'year';

export type MoneyPeriodRange = {
  start: Date;
  end: Date;
  label: string;
};

export const MONEY_PERIOD_LABELS: Record<MoneyPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

export const RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export function getMoneyPeriodRange(period: MoneyPeriod, anchor = new Date()): MoneyPeriodRange {
  switch (period) {
    case 'today':
      return {
        start: startOfDay(anchor),
        end: endOfDay(anchor),
        label: MONEY_PERIOD_LABELS.today,
      };
    case 'week':
      return {
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
        label: MONEY_PERIOD_LABELS.week,
      };
    case 'month':
      return {
        start: startOfMonth(anchor),
        end: endOfMonth(anchor),
        label: MONEY_PERIOD_LABELS.month,
      };
    case 'year':
      return {
        start: startOfYear(anchor),
        end: endOfYear(anchor),
        label: MONEY_PERIOD_LABELS.year,
      };
  }
}

/** Prorate a recurring cost into a date range (inclusive). */
export function recurringCostInRange(
  amount: number,
  recurrence: ExpenseRecurrence,
  start: Date,
  end: Date,
): number {
  const msPerDay = 86_400_000;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);

  switch (recurrence) {
    case 'daily':
      return amount * days;
    case 'weekly':
      return amount * (days / 7);
    case 'monthly':
      return amount * (days / 30.437);
    case 'yearly':
      return amount * (days / 365.25);
  }
}
