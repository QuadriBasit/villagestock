import { v4 as uuidv4 } from 'uuid';
import { db, generateReceiptNumber } from '@/lib/db';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
import { assertTrialAllowsMutations } from '@/lib/trial';
import { useAuthStore } from '@/store/auth';
import type { DeviceCondition, InventoryItem, PaymentMethod, PaymentStatus, SalesRecord, SwapRecord } from '@/types';

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

  async function processSwap(input: ProcessSwapInput): Promise<SalesRecord> {
    if (!user) throw new Error('Not authenticated');
    await assertTrialAllowsMutations(user.id);
    await assertTradingAllowedForStockPolicy(user.id);
    if (input.outgoingItem.mode !== 'serialized') throw new Error('Swaps only apply to serialized items');
    if (input.outgoingItem.status !== 'in_stock') throw new Error('Selected item is not in stock');

    const receiptNumber = await generateReceiptNumber(user.id);
    const saleId = uuidv4();
    const incomingItemId = uuidv4();
    const swapId = uuidv4();
    const now = input.date;
    const balancePaid = input.sale_price - input.incoming.trade_in_value;

    const incomingItem: InventoryItem = {
      id: incomingItemId,
      user_id: user.id,
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
      user_id: user.id,
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
      user_id: user.id,
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
      db.inventory_items,
      db.sales_records,
      db.swap_records,
      db.sync_queue,
      async () => {
        await db.inventory_items.update(input.outgoingItem.id, {
          status: 'sold',
          updated_at: now,
          sync_status: 'pending',
        });
        await db.inventory_items.add(incomingItem);
        await db.sales_records.add(saleRecord);
        await db.swap_records.add(swapRecord);

        await db.sync_queue.bulkAdd([
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
        ]);
      }
    );

    return saleRecord;
  }

  return { processSwap };
}
