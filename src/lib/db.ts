import Dexie, { type Table } from 'dexie';
import type {
  InventoryItem,
  StockMovement,
  SyncQueueItem,
  SalesRecord,
  AppSetting,
  ReturnRecord,
  SwapRecord,
  CreditRecord,
  RepairRecord,
  BusinessProfile,
  StockSession,
} from '@/types';

export class VillageStockDB extends Dexie {
  inventory_items!: Table<InventoryItem>;
  stock_movements!: Table<StockMovement>;
  sales_records!: Table<SalesRecord>;
  return_records!: Table<ReturnRecord>;
  swap_records!: Table<SwapRecord>;
  credit_records!: Table<CreditRecord>;
  repair_records!: Table<RepairRecord>;
  business_profiles!: Table<BusinessProfile>;
  stock_sessions!: Table<StockSession>;
  sync_queue!: Table<SyncQueueItem>;
  settings!: Table<AppSetting>;

  constructor() {
    super('VillageStockDB');

    this.version(1).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'sync_status', 'updated_at', '[user_id+category]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sync_queue: 'id, table, operation, created_at',
    });

    this.version(2).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'sync_status', 'updated_at', '[user_id+category]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, payment_method, [user_id+sold_at]',
      sync_queue: 'id, table, operation, created_at',
    });

    this.version(3).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'sync_status', 'updated_at', '[user_id+category]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, [user_id+sold_at]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    this.version(4).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'sync_status', 'updated_at', '[user_id+category]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    // v5: add mode + status indexes for the serialized/non-serialized split
    this.version(5).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    }).upgrade(tx => {
      // Migrate existing items: derive mode from category, default status
      return tx.table('inventory_items').toCollection().modify((item: InventoryItem) => {
        if (!item.mode) {
          const serialized = ['phones', 'laptops', 'tablets'].includes(item.category);
          item.mode = serialized ? 'serialized' : 'non_serialized';
          if (serialized && !item.status) {
            item.status = item.quantity > 0 ? 'in_stock' : 'sold';
          }
        }
      });
    });

    this.version(6).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'condition', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, sale_type, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      swap_records: 'id, user_id, sale_id, outgoing_item_id, incoming_item_id, date, payment_method, [user_id+date]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    this.version(7).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'condition', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, sale_type, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      swap_records: 'id, user_id, sale_id, outgoing_item_id, incoming_item_id, date, payment_method, [user_id+date]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    this.version(8).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'condition', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, payment_status, sale_type, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      swap_records: 'id, user_id, sale_id, outgoing_item_id, incoming_item_id, date, payment_method, [user_id+date]',
      credit_records: 'id, user_id, sale_id, customer_name, due_date, status, [user_id+due_date]',
      repair_records: 'id, user_id, item_id, engineer_name, date_sent, repair_status, expected_return_date, [user_id+engineer_name]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    this.version(9).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'condition', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, payment_status, sale_type, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      swap_records: 'id, user_id, sale_id, outgoing_item_id, incoming_item_id, date, payment_method, [user_id+date]',
      credit_records: 'id, user_id, sale_id, customer_name, due_date, status, [user_id+due_date]',
      repair_records: 'id, user_id, item_id, engineer_name, date_sent, repair_status, expected_return_date, [user_id+engineer_name]',
      business_profiles: 'id, plan, plan_status, updated_at, onboarding_complete',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });

    this.version(10).stores({
      inventory_items: [
        'id', 'user_id', 'category', 'name', 'brand', 'quantity',
        'mode', 'status', 'condition', 'sync_status', 'updated_at',
        '[user_id+category]', '[user_id+mode]', '[user_id+status]', '[user_id+sync_status]',
      ].join(', '),
      stock_movements: 'id, item_id, user_id, type, created_at',
      sales_records: 'id, user_id, item_id, sold_at, receipt_number, payment_method, payment_status, sale_type, [user_id+sold_at]',
      return_records: 'id, user_id, sale_id, item_id, returned_at, [user_id+returned_at]',
      swap_records: 'id, user_id, sale_id, outgoing_item_id, incoming_item_id, date, payment_method, [user_id+date]',
      credit_records: 'id, user_id, sale_id, customer_name, due_date, status, [user_id+due_date]',
      repair_records: 'id, user_id, item_id, engineer_name, date_sent, repair_status, expected_return_date, [user_id+engineer_name]',
      business_profiles: 'id, plan, plan_status, updated_at, onboarding_complete',
      stock_sessions:
        'id, user_id, date, status, opened_at, closed_at, [user_id+date], [user_id+status]',
      sync_queue: 'id, table, operation, created_at',
      settings: 'key',
    });
  }
}

export const db = new VillageStockDB();

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value } as AppSetting);
}

// ─── Receipt number generation ────────────────────────────────────────────────
// Format: VS-YYYYMMDD-NNN (NNN = daily sequence number, zero-padded)

export async function generateReceiptNumber(userId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = await db.sales_records
    .where('user_id')
    .equals(userId)
    .filter(s => new Date(s.sold_at) >= startOfDay)
    .count();

  const seq = String(todayCount + 1).padStart(3, '0');
  return `VS-${dateStr}-${seq}`;
}

// ─── Inventory helpers ────────────────────────────────────────────────────────

export async function getInventoryByUser(userId: string): Promise<InventoryItem[]> {
  return db.inventory_items
    .where('user_id')
    .equals(userId)
    .filter(item => !item.deleted)
    .toArray();
}
