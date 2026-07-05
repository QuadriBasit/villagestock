import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { buildCreditPayment, computeCreditFromPayments, getCreditStatus } from '@/lib/creditUtils';
import { syncSaleFromCreditRecord } from '@/lib/syncSaleFromCredit';
import type { CreditRecord, CreditRecordInput, PaymentMethod } from '@/types';

export function useCreditActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId /* , role */ } = useShopAccess();

  async function createCreditRecord(input: CreditRecordInput): Promise<CreditRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    const saleRow = await db.sales_records.get(input.sale_id);
    if (!saleRow) throw new Error('Sale not found');
    const location_id = saleRow.location_id;
    if (!location_id) throw new Error('Sale is missing branch — sync and try again');

    const balanceOwed = Math.max(0, input.total_amount - input.amount_paid);
    const status = balanceOwed <= 0
      ? 'paid'
      : input.amount_paid > 0
      ? (new Date(input.due_date) < new Date() ? 'overdue' : 'partially_paid')
      : getCreditStatus(balanceOwed, input.due_date);

    const record: CreditRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id,
      balance_owed: balanceOwed,
      status,
      sync_status: 'pending',
    };

    await db.credit_records.add(record);
    await queueSync('credit_records', 'insert', record as unknown as Record<string, unknown>);
    await flushSyncQueue();
    if (actorUserId) {
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'credit.created',
        entityType: 'credit_record',
        entityId: record.id,
        metadata: {
          receipt: saleRow.receipt_number,
          customer: input.customer_name,
          total_amount: input.total_amount,
        },
        actorLabel,
      });
    }
    return record;
  }

  async function recordPayment(creditId: string, amount: number, date: string, method?: PaymentMethod): Promise<void> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');

    const existing = await db.credit_records.get(creditId);
    if (!existing) throw new Error('Credit not found');
    if (amount > existing.balance_owed) {
      throw new Error(`Amount cannot exceed balance owed (${existing.balance_owed})`);
    }

    const payments = [...existing.payments, buildCreditPayment(amount, date, method)];
    const totals = computeCreditFromPayments(existing, payments);

    const updated: Partial<CreditRecord> = {
      ...totals,
      payments,
      sync_status: 'pending',
    };

    await db.transaction('rw', [db.credit_records, db.sales_records, db.sync_queue], async () => {
      await db.credit_records.update(creditId, updated);
      const latest = await db.credit_records.get(creditId);
      if (!latest) throw new Error('Credit not found');
      await syncSaleFromCreditRecord(latest);
    });

    const latest = await db.credit_records.get(creditId);
    if (latest) {
      await queueSync('credit_records', 'update', latest as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    if (actorUserId) {
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'credit.payment_recorded',
        entityType: 'credit_record',
        entityId: creditId,
        metadata: {
          customer: existing.customer_name,
          amount,
          date,
          balance_remaining: totals.balance_owed,
        },
        actorLabel,
      });
    }
  }

  async function removeCreditPayment(creditId: string, paymentIndex: number): Promise<void> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    const existing = await db.credit_records.get(creditId);
    if (!existing) throw new Error('Credit not found');
    if (paymentIndex < 0 || paymentIndex >= existing.payments.length) {
      throw new Error('Payment not found');
    }

    const removed = existing.payments[paymentIndex];
    const payments = existing.payments.filter((_, index) => index !== paymentIndex);
    const totals = computeCreditFromPayments(existing, payments);

    const updated: Partial<CreditRecord> = {
      ...totals,
      payments,
      sync_status: 'pending',
    };

    await db.transaction('rw', [db.credit_records, db.sales_records, db.sync_queue], async () => {
      await db.credit_records.update(creditId, updated);
      const latest = await db.credit_records.get(creditId);
      if (!latest) throw new Error('Credit not found');
      await syncSaleFromCreditRecord(latest);
    });

    const latest = await db.credit_records.get(creditId);
    if (latest) {
      await queueSync('credit_records', 'update', latest as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();
    if (actorUserId) {
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'credit.payment_removed',
        entityType: 'credit_record',
        entityId: creditId,
        metadata: {
          customer: existing.customer_name,
          amount: removed.amount,
          date: removed.date,
          balance_remaining: totals.balance_owed,
        },
        actorLabel,
      });
    }
  }

  return { createCreditRecord, recordPayment, removeCreditPayment };
}
