import type { CreditRecord, SalesRecord, SwapRecord } from '@/types';
import { computeCreditFromPayments } from '@/lib/creditUtils';

/** Cash the customer should have paid for this sale at the given unit price. */
export function expectedSaleCashAmount(
  sale: Pick<SalesRecord, 'sale_type' | 'sale_price' | 'quantity_sold' | 'trade_in_value'>,
): number {
  if (sale.sale_type === 'swap') {
    return sale.sale_price - (sale.trade_in_value ?? 0);
  }
  return sale.sale_price * (sale.quantity_sold || 1);
}

export function computeSalePriceCorrection(args: {
  sale: SalesRecord;
  salePrice: number;
  credit?: CreditRecord | null;
}): {
  salePatch: Partial<SalesRecord>;
  swapPatch: Partial<SwapRecord> | null;
  creditPatch: Partial<CreditRecord> | null;
} {
  const { sale, credit } = args;
  const salePrice = args.salePrice;
  const qty = sale.quantity_sold || 1;
  const isSwap = sale.sale_type === 'swap';
  const tradeIn = sale.trade_in_value ?? 0;
  const newDue = expectedSaleCashAmount({
    ...sale,
    sale_price: salePrice,
  });
  const dueForSettlement = Math.max(0, newDue);

  const salePatch: Partial<SalesRecord> = {
    sale_price: salePrice,
    profit: (salePrice - sale.cost_price) * qty,
    sync_status: 'pending',
  };

  if (isSwap) {
    salePatch.balance_paid = salePrice - tradeIn;
  }

  const swapPatch: Partial<SwapRecord> | null =
    isSwap && sale.swap_record_id
      ? {
          sale_price: salePrice,
          balance_paid: salePrice - tradeIn,
          sync_status: 'pending',
        }
      : null;

  let creditPatch: Partial<CreditRecord> | null = null;

  if (credit) {
    const next = computeCreditFromPayments(
      { total_amount: dueForSettlement, due_date: credit.due_date },
      credit.payments,
    );
    creditPatch = {
      total_amount: dueForSettlement,
      ...next,
      sync_status: 'pending',
    };
    salePatch.amount_paid = next.amount_paid;
    salePatch.balance_owed = next.balance_owed;
    salePatch.payment_status = next.balance_owed <= 0 ? 'paid' : 'credit';
  } else if (sale.payment_status === 'credit' && (sale.balance_owed ?? 0) > 0) {
    const paid = sale.amount_paid ?? 0;
    const balance = Math.max(0, dueForSettlement - paid);
    salePatch.amount_paid = paid;
    salePatch.balance_owed = balance;
    salePatch.payment_status = balance <= 0 ? 'paid' : 'credit';
  } else {
    salePatch.amount_paid = dueForSettlement;
    salePatch.balance_owed = 0;
    salePatch.payment_status = 'paid';
  }

  return { salePatch, swapPatch, creditPatch };
}
