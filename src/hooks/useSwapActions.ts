import { v4 as uuidv4 } from 'uuid';
import { db, generateReceiptNumber } from '@/lib/db';
import { flushSyncQueue } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { buildCreditPayment, getCreditStatus } from '@/lib/creditUtils';
import { saleBlockedMissingIdentifiers } from '@/lib/serializedIdentifiers';
import type { CreditRecord, DeviceCondition, InventoryItem, PaymentMethod, PaymentStatus, SalesRecord, SwapRecord } from '@/types';

interface ProcessSwapInput {
  outgoingItem: InventoryItem;
  incoming: {
    brand: string;
    model: string;
    serial_number?: string;
    imei?: string;
    condition: DeviceCondition;
    trade_in_value: number;
  };
  sale_price: number;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  amount_paid?: number;
  due_date?: string;
  customer_name?: string;
  customer_phone?: string;
  date: string;
}

export function useSwapActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function processSwap(input: ProcessSwapInput): Promise<SalesRecord> {
    if (!user || !shopOwnerId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    // await assertTrialAllowsMutations(shopOwnerId);
    await assertTradingAllowedForStockPolicy(shopOwnerId, activeLocationId);
    if (input.outgoingItem.mode !== 'serialized') throw new Error('Swaps only apply to serialized items');
    if (input.outgoingItem.status !== 'in_stock') throw new Error('Selected item is not in stock');
    const outgoingIdBlock = saleBlockedMissingIdentifiers(input.outgoingItem);
    if (outgoingIdBlock) throw new Error(outgoingIdBlock);

    const receiptNumber = await generateReceiptNumber(shopOwnerId);
    const saleId = uuidv4();
    const incomingItemId = uuidv4();
    const swapId = uuidv4();
    const now = input.date;
    const balancePaid = input.sale_price - input.incoming.trade_in_value;

    const incomingItem: InventoryItem = {
      id: incomingItemId,
      user_id: shopOwnerId,
      location_id: activeLocationId,
      name: input.incoming.model,
      category: input.outgoingItem.category,
      brand: input.incoming.brand,
      price: input.incoming.trade_in_value,
      cost_price: input.incoming.trade_in_value,
      mode: 'serialized',
      status: 'in_stock',
      quantity: 1,
      low_stock_threshold: 0,
      serial_number: input.incoming.serial_number,
      imei: input.incoming.imei,
      condition: input.incoming.condition,
      deviceDetails: {},
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
      deleted: false,
    };

    const saleRecord: SalesRecord = {
      id: saleId,
      user_id: shopOwnerId,
      location_id: activeLocationId,
      item_id: input.outgoingItem.id,
      sale_type: 'swap',
      item_name: input.outgoingItem.name,
      item_category: input.outgoingItem.category,
      item_brand: input.outgoingItem.brand,
      item_mode: input.outgoingItem.mode,
      serial_number: input.outgoingItem.serial_number,
      imei: input.outgoingItem.imei,
      device_details: input.outgoingItem.deviceDetails,
      sale_price: input.sale_price,
      cost_price: input.outgoingItem.cost_price ?? 0,
      // Swap profit is based on the final agreed selling amount for the outgoing device.
      profit: input.sale_price - (input.outgoingItem.cost_price ?? 0),
      payment_method: input.payment_method,
      payment_status: input.payment_status,
      amount_paid: input.amount_paid,
      balance_owed: input.payment_status === 'credit' ? Math.max(0, balancePaid - (input.amount_paid ?? 0)) : 0,
      due_date: input.due_date,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      quantity_sold: 1,
      sold_at: now,
      receipt_number: receiptNumber,
      swap_record_id: swapId,
      trade_in_item_name: input.incoming.model,
      trade_in_item_brand: input.incoming.brand,
      trade_in_value: input.incoming.trade_in_value,
      balance_paid: balancePaid,
      returned: false,
      sync_status: 'pending',
    };

    const swapRecord: SwapRecord = {
      id: swapId,
      outgoing_item_id: input.outgoingItem.id,
      incoming_item_id: incomingItemId,
      user_id: shopOwnerId,
      location_id: activeLocationId,
      sale_id: saleId,
      sale_price: input.sale_price,
      trade_in_value: input.incoming.trade_in_value,
      balance_paid: balancePaid,
      payment_method: input.payment_method,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      date: now,
      sync_status: 'pending',
    };

    await db.transaction(
      'rw',
      [db.inventory_items, db.sales_records, db.swap_records, db.credit_records, db.sync_queue],
      async () => {
        await db.inventory_items.update(input.outgoingItem.id, {
          status: 'sold',
          updated_at: now,
          sync_status: 'pending',
        });
        await db.inventory_items.add(incomingItem);
        await db.sales_records.add(saleRecord);
        await db.swap_records.add(swapRecord);

        const syncRows: Array<{
          id: string;
          table: 'inventory_items' | 'sales_records' | 'swap_records' | 'credit_records';
          operation: 'insert' | 'update';
          payload: Record<string, unknown>;
          created_at: string;
          retries: number;
        }> = [
          {
            id: uuidv4(),
            table: 'inventory_items',
            operation: 'update',
            payload: {
              ...input.outgoingItem,
              status: 'sold',
              updated_at: now,
              sync_status: 'pending',
            },
            created_at: now,
            retries: 0,
          },
          {
            id: uuidv4(),
            table: 'inventory_items',
            operation: 'insert',
            payload: incomingItem as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          },
          {
            id: uuidv4(),
            table: 'sales_records',
            operation: 'insert',
            payload: saleRecord as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          },
          {
            id: uuidv4(),
            table: 'swap_records',
            operation: 'insert',
            payload: swapRecord as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          },
        ];

        if (input.payment_status === 'credit' && input.due_date && input.customer_name && input.customer_phone) {
          const totalAmount = Math.max(0, balancePaid);
          const amountPaid = input.amount_paid ?? 0;
          const balanceOwed = Math.max(0, totalAmount - amountPaid);
          const creditRecord: CreditRecord = {
            id: uuidv4(),
            user_id: shopOwnerId,
            location_id: activeLocationId,
            sale_id: saleId,
            customer_name: input.customer_name,
            customer_phone: input.customer_phone,
            item_name: `${input.outgoingItem.brand} ${input.outgoingItem.name}`.trim(),
            total_amount: totalAmount,
            amount_paid: amountPaid,
            balance_owed: balanceOwed,
            due_date: input.due_date,
            payments:
              amountPaid > 0
                ? [buildCreditPayment(amountPaid, now, input.payment_method)]
                : [],
            status:
              balanceOwed <= 0
                ? 'paid'
                : amountPaid > 0
                  ? new Date(input.due_date) < new Date()
                    ? 'overdue'
                    : 'partially_paid'
                  : getCreditStatus(balanceOwed, input.due_date),
            notes: 'Swap credit',
            sync_status: 'pending',
          };
          await db.credit_records.add(creditRecord);
          syncRows.push({
            id: uuidv4(),
            table: 'credit_records',
            operation: 'insert',
            payload: creditRecord as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          });
        }

        await db.sync_queue.bulkAdd(syncRows);
      }
    );

    await flushSyncQueue();
    if (actorUserId) {
      const incoming = await db.inventory_items.get(incomingItemId);
      const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'swap.completed',
        entityType: 'swap_record',
        entityId: swapId,
        metadata: {
          receipt: receiptNumber,
          traded_out: `${input.outgoingItem.brand} ${input.outgoingItem.name}`.trim(),
          traded_in: incoming ? `${incoming.brand} ${incoming.name}`.trim() : undefined,
          sale_price: input.sale_price,
        },
        actorLabel,
      });
    }
    return saleRecord;
  }

  return { processSwap };
}
