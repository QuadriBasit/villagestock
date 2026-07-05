import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import type { CreditRecord, SalesRecord } from '@/types';

/** Keep linked sales_records in sync when credit balance changes. */
export async function syncSaleFromCreditRecord(credit: CreditRecord): Promise<void> {
  const sale = await db.sales_records.get(credit.sale_id);
  if (!sale) return;

  const balanceOwed = credit.balance_owed;
  const amountPaid = credit.amount_paid;
  const paymentStatus = balanceOwed <= 0 ? 'paid' : 'credit';

  const patch: Partial<SalesRecord> = {
    amount_paid: amountPaid,
    balance_owed: balanceOwed,
    payment_status: paymentStatus,
    sync_status: 'pending',
  };

  await db.sales_records.update(credit.sale_id, patch);

  const latest = await db.sales_records.get(credit.sale_id);
  if (!latest) return;

  await db.sync_queue.add({
    id: uuidv4(),
    table: 'sales_records',
    operation: 'update',
    payload: latest as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
    retries: 0,
  });
}
