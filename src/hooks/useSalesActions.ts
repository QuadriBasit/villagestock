import { v4 as uuidv4 } from 'uuid';
import { db, generateReceiptNumber } from '@/lib/db';
import { flushSyncQueue, queueSync } from '@/lib/sync';
import { assertTradingAllowedForStockPolicy } from '@/lib/stockTradingGate';
import { useAuthStore } from '@/store/auth';
import { useShopAccess } from '@/context/ShopAccessContext';
import { useShopLocation } from '@/context/ShopLocationContext';
import { logShopAudit } from '@/lib/audit';
import { resolveAuditActorLabel } from '@/lib/auditActorLabel';
import { buildCreditPayment, getCreditStatus } from '@/lib/creditUtils';
import { saleBlockedMissingIdentifiers } from '@/lib/serializedIdentifiers';
import { getShopWarrantyPolicy, stockConditionFromItem, warrantyCoverFor } from '@/lib/warranty';
import type { CreditRecord, CreditRecordInput, InventoryItem, SalesRecord, SalesRecordInput } from '@/types';

function assertItemAvailableForSale(
  item: InventoryItem,
  activeLocationId: string,
  quantitySold: number,
): void {
  if (item.deleted) throw new Error('Item is no longer in inventory');
  if (item.location_id && item.location_id !== activeLocationId) {
    throw new Error('Item belongs to another branch');
  }
  if (item.mode === 'serialized') {
    if (item.status !== 'in_stock') throw new Error(`Unit is ${item.status?.replace(/_/g, ' ') ?? 'unavailable'}`);
    if (quantitySold !== 1) throw new Error('Serialized items sell one unit at a time');
    return;
  }
  if (quantitySold <= 0) throw new Error('Quantity must be at least 1');
  if (quantitySold > item.quantity) throw new Error('Not enough stock for this quantity');
}

type RecordSaleOptions = {
  credit?: Omit<CreditRecordInput, 'sale_id'>;
};

export function useSalesActions() {
  const { user } = useAuthStore();
  const { shopOwnerId, actorUserId } = useShopAccess();
  const { activeLocationId, ready: locationReady } = useShopLocation();

  async function recordSale(input: SalesRecordInput, options?: RecordSaleOptions): Promise<SalesRecord> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    await assertTradingAllowedForStockPolicy(shopOwnerId, activeLocationId);

    const itemPre = await db.inventory_items.get(input.item_id);
    if (!itemPre) throw new Error('Item not found');
    const idBlock = saleBlockedMissingIdentifiers(itemPre);
    if (idBlock) throw new Error(idBlock);
    assertItemAvailableForSale(itemPre, activeLocationId, input.quantity_sold);

    const receipt_number = await generateReceiptNumber(shopOwnerId);
    const warrantyPolicy = await getShopWarrantyPolicy();
    const stockCondition = input.item_stock_condition ?? stockConditionFromItem(itemPre);
    const warrantyCover =
      input.warranty_cover ?? warrantyCoverFor(warrantyPolicy, input.item_category, stockCondition);

    const record: SalesRecord = {
      ...input,
      id: uuidv4(),
      user_id: shopOwnerId,
      location_id: activeLocationId,
      sale_type: input.sale_type ?? 'sale',
      payment_status: input.payment_status ?? 'paid',
      device_details: input.device_details,
      item_stock_condition: input.item_stock_condition ?? stockCondition,
      warranty_cover: warrantyCover,
      warranty_months:
        warrantyCover.unit === 'months'
          ? warrantyCover.value
          : warrantyCover.value > 0
            ? undefined
            : 0,
      receipt_number,
      sync_status: 'pending',
    };

    let creditRecord: CreditRecord | undefined;
    const creditInput = options?.credit;
    const now = new Date().toISOString();

    if (creditInput) {
      const balanceOwed = Math.max(0, creditInput.total_amount - creditInput.amount_paid);
      creditRecord = {
        ...creditInput,
        sale_id: record.id,
        id: uuidv4(),
        user_id: shopOwnerId,
        location_id: activeLocationId,
        balance_owed: balanceOwed,
        status:
          balanceOwed <= 0
            ? 'paid'
            : creditInput.amount_paid > 0
              ? new Date(creditInput.due_date) < new Date()
                ? 'overdue'
                : 'partially_paid'
              : getCreditStatus(balanceOwed, creditInput.due_date),
        sync_status: 'pending',
      };
    }

    await db.transaction(
      'rw',
      [db.sales_records, db.inventory_items, db.credit_records, db.sync_queue],
      async () => {
        const item = await db.inventory_items.get(input.item_id);
        if (!item) throw new Error('Item not found');
        assertItemAvailableForSale(item, activeLocationId, input.quantity_sold);

        await db.sales_records.add(record);

        if (item.mode === 'serialized') {
          await db.inventory_items.update(input.item_id, {
            status: 'sold',
            updated_at: now,
            sync_status: 'pending',
          });
        } else {
          const newQty = Math.max(0, item.quantity - input.quantity_sold);
          await db.inventory_items.update(input.item_id, {
            quantity: newQty,
            updated_at: now,
            sync_status: 'pending',
          });
        }

        const updatedItem = await db.inventory_items.get(input.item_id);
        const syncRows: Array<{
          id: string;
          table: 'sales_records' | 'inventory_items' | 'credit_records';
          operation: 'insert' | 'update';
          payload: Record<string, unknown>;
          created_at: string;
          retries: number;
        }> = [
          {
            id: uuidv4(),
            table: 'sales_records',
            operation: 'insert',
            payload: record as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          },
        ];

        if (updatedItem) {
          syncRows.push({
            id: uuidv4(),
            table: 'inventory_items',
            operation: 'update',
            payload: updatedItem as unknown as Record<string, unknown>,
            created_at: now,
            retries: 0,
          });
        }

        if (creditRecord) {
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
      },
    );

    await flushSyncQueue();

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    const itemLabel = `${itemPre.brand} ${itemPre.name}`.trim();
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'sale.recorded',
      entityType: 'sales_record',
      entityId: record.id,
      metadata: {
        receipt: record.receipt_number,
        item: itemLabel,
        sale_price: record.sale_price,
        quantity_sold: record.quantity_sold,
      },
      actorLabel,
    });

    if (creditRecord && actorUserId) {
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'credit.created',
        entityType: 'credit_record',
        entityId: creditRecord.id,
        metadata: {
          receipt: record.receipt_number,
          customer: creditInput!.customer_name,
          total_amount: creditInput!.total_amount,
        },
        actorLabel,
      });
    }

    return record;
  }

  type QuickTillLine = {
    item: InventoryItem;
    qty: number;
    lineAmt: number;
    linePaid: number;
    lineOwed: number;
  };

  async function checkoutQuickTill(input: {
    lines: QuickTillLine[];
    payMethod: SalesRecordInput['payment_method'];
    customerName: string;
    customerPhone: string;
    dueIso?: string;
    soldAt: string;
  }): Promise<{ lastReceipt?: string; totalOwed: number }> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    if (!locationReady || !activeLocationId) throw new Error('Select a branch first');
    if (input.lines.length === 0) throw new Error('Cart is empty');
    await assertTradingAllowedForStockPolicy(shopOwnerId, activeLocationId);

    const warrantyPolicy = await getShopWarrantyPolicy();
    const results: SalesRecord[] = [];
    let totalOwed = 0;

    await db.transaction(
      'rw',
      [db.sales_records, db.inventory_items, db.credit_records, db.sync_queue],
      async () => {
        for (const line of input.lines) {
          const { item, qty, lineAmt, linePaid, lineOwed } = line;
          const qtySold = item.mode === 'serialized' ? 1 : qty;
          const fresh = await db.inventory_items.get(item.id);
          if (!fresh) throw new Error(`${item.name} is no longer in inventory`);
          assertItemAvailableForSale(fresh, activeLocationId, qtySold);

          const idBlock = saleBlockedMissingIdentifiers(fresh);
          if (idBlock) throw new Error(idBlock);

          totalOwed += lineOwed;
          const receipt_number = await generateReceiptNumber(shopOwnerId);
          const stockCondition = stockConditionFromItem(fresh);
          const warrantyCover = warrantyCoverFor(warrantyPolicy, fresh.category, stockCondition);
          const now = input.soldAt;

          const record: SalesRecord = {
            id: uuidv4(),
            user_id: shopOwnerId,
            location_id: activeLocationId,
            item_id: item.id,
            sale_type: 'sale',
            item_name: item.name,
            item_category: item.category,
            item_brand: item.brand,
            item_mode: item.mode,
            serial_number: item.serial_number,
            imei: item.imei,
            device_details: item.deviceDetails,
            sale_price: item.price,
            cost_price: item.cost_price ?? 0,
            profit: (item.price - (item.cost_price ?? 0)) * qtySold,
            payment_method: input.payMethod,
            payment_status: lineOwed > 0 ? 'credit' : 'paid',
            amount_paid: linePaid,
            balance_owed: lineOwed,
            due_date: lineOwed > 0 ? input.dueIso : undefined,
            customer_name: input.customerName || undefined,
            customer_phone: input.customerPhone || undefined,
            sold_at: now,
            quantity_sold: qtySold,
            item_stock_condition: stockCondition,
            warranty_cover: warrantyCover,
            warranty_months:
              warrantyCover.unit === 'months'
                ? warrantyCover.value
                : warrantyCover.value > 0
                  ? undefined
                  : 0,
            receipt_number,
            sync_status: 'pending',
          };

          await db.sales_records.add(record);
          results.push(record);

          if (fresh.mode === 'serialized') {
            await db.inventory_items.update(item.id, {
              status: 'sold',
              updated_at: now,
              sync_status: 'pending',
            });
          } else {
            await db.inventory_items.update(item.id, {
              quantity: Math.max(0, fresh.quantity - qtySold),
              updated_at: now,
              sync_status: 'pending',
            });
          }

          const updatedItem = await db.inventory_items.get(item.id);
          const syncRows: Array<{
            id: string;
            table: 'sales_records' | 'inventory_items' | 'credit_records';
            operation: 'insert' | 'update';
            payload: Record<string, unknown>;
            created_at: string;
            retries: number;
          }> = [
            {
              id: uuidv4(),
              table: 'sales_records',
              operation: 'insert',
              payload: record as unknown as Record<string, unknown>,
              created_at: now,
              retries: 0,
            },
          ];

          if (updatedItem) {
            syncRows.push({
              id: uuidv4(),
              table: 'inventory_items',
              operation: 'update',
              payload: updatedItem as unknown as Record<string, unknown>,
              created_at: now,
              retries: 0,
            });
          }

          if (lineOwed > 0 && input.dueIso) {
            const balanceOwed = lineOwed;
            const creditRecord: CreditRecord = {
              id: uuidv4(),
              user_id: shopOwnerId,
              location_id: activeLocationId,
              sale_id: record.id,
              customer_name: input.customerName,
              customer_phone: input.customerPhone,
              item_name: item.name,
              total_amount: lineAmt,
              amount_paid: linePaid,
              balance_owed: balanceOwed,
              due_date: input.dueIso,
              payments:
                linePaid > 0
                  ? [buildCreditPayment(linePaid, now, input.payMethod ?? undefined)]
                  : [],
              status:
                balanceOwed <= 0
                  ? 'paid'
                  : linePaid > 0
                    ? new Date(input.dueIso) < new Date()
                      ? 'overdue'
                      : 'partially_paid'
                    : getCreditStatus(balanceOwed, input.dueIso),
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
      },
    );

    await flushSyncQueue();

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    for (const record of results) {
      void logShopAudit({
        businessId: shopOwnerId,
        actorUserId,
        action: 'sale.recorded',
        entityType: 'sales_record',
        entityId: record.id,
        metadata: {
          receipt: record.receipt_number,
          item: record.item_name,
          sale_price: record.sale_price,
          quantity_sold: record.quantity_sold,
        },
        actorLabel,
      });
    }

    return {
      lastReceipt: results.at(-1)?.receipt_number,
      totalOwed,
    };
  }

  async function updateSaleSoldAt(saleId: string, soldAt: string): Promise<void> {
    if (!user || !shopOwnerId || !actorUserId) throw new Error('Not authenticated');
    const existing = await db.sales_records.get(saleId);
    if (!existing) throw new Error('Sale not found');
    const parsed = new Date(soldAt);
    if (Number.isNaN(parsed.getTime())) throw new Error('Invalid sale date');

    const iso = parsed.toISOString();
    await db.sales_records.update(saleId, { sold_at: iso, sync_status: 'pending' });
    const latest = await db.sales_records.get(saleId);
    if (latest) {
      await queueSync('sales_records', 'update', latest as unknown as Record<string, unknown>);
    }
    await flushSyncQueue();

    const actorLabel = await resolveAuditActorLabel(actorUserId, shopOwnerId);
    void logShopAudit({
      businessId: shopOwnerId,
      actorUserId,
      action: 'sale.sold_at_updated',
      entityType: 'sales_record',
      entityId: saleId,
      metadata: {
        receipt: existing.receipt_number,
        item: existing.item_name,
        sold_at: iso,
      },
      actorLabel,
    });
  }

  return { recordSale, checkoutQuickTill, updateSaleSoldAt };
}
