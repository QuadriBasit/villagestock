import type { CreditPayment, CreditRecord, CreditStatus, PaymentMethod } from '@/types';

export function getCreditStatus(balanceOwed: number, dueDate: string): CreditStatus {
  if (balanceOwed <= 0) return 'paid';
  return new Date(dueDate) < new Date() ? 'overdue' : 'pending';
}

export function effectiveCreditStatus(record: Pick<CreditRecord, 'balance_owed' | 'amount_paid' | 'due_date'>): CreditStatus {
  if (record.balance_owed <= 0) return 'paid';
  if (record.amount_paid > 0) {
    return new Date(record.due_date) < new Date() ? 'overdue' : 'partially_paid';
  }
  return getCreditStatus(record.balance_owed, record.due_date);
}

export function buildCreditPayment(amount: number, date: string, method?: PaymentMethod): CreditPayment {
  return { amount, date, method };
}

export function computeCreditFromPayments(
  record: Pick<CreditRecord, 'total_amount' | 'due_date'>,
  payments: CreditPayment[],
): Pick<CreditRecord, 'amount_paid' | 'balance_owed' | 'status'> {
  const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceOwed = Math.max(0, record.total_amount - amountPaid);
  const status = effectiveCreditStatus({
    total_amount: record.total_amount,
    amount_paid: amountPaid,
    balance_owed: balanceOwed,
    due_date: record.due_date,
  } as CreditRecord);
  return { amount_paid: amountPaid, balance_owed: balanceOwed, status };
}
