import { supabase, isOnline } from './supabase';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { getCategoryMode } from '@/types';
import type {
  BusinessProfile,
  CreditRecord,
  InventoryItem,
  RepairRecord,
  ReturnRecord,
  SalesRecord,
  SwapRecord,
  SyncQueueItem,
} from '@/types';
import type { Database, Json } from '@/types/supabase';

type RemoteInventoryRow = Database['public']['Tables']['inventory_items']['Row'];
type RemoteBusinessProfileRow = Database['public']['Tables']['business_profiles']['Row'];
type RemoteSalesRow = Database['public']['Tables']['sales_records']['Row'];
type RemoteReturnRow = Database['public']['Tables']['return_records']['Row'];
type RemoteSwapRow = Database['public']['Tables']['swap_records']['Row'];
type RemoteCreditRow = Database['public']['Tables']['credit_records']['Row'];
type RemoteRepairRow = Database['public']['Tables']['repair_records']['Row'];

function parseCreditPayments(json: unknown): CreditRecord['payments'] {
  if (!Array.isArray(json)) return [];
  return json as CreditRecord['payments'];
}

/** Strip Dexie-only fields and map keys so PostgREST accepts the body (unknown columns → 400). */
function inventoryItemToRemoteRow(item: InventoryItem): Database['public']['Tables']['inventory_items']['Insert'] {
  return {
    id: item.id,
    user_id: item.user_id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    price: item.price,
    cost_price: item.cost_price ?? null,
    mode: item.mode,
    status: item.status ?? null,
    quantity: item.quantity,
    low_stock_threshold: item.low_stock_threshold,
    serial_number: item.serial_number ?? null,
    imei: item.imei ?? null,
    imei2: item.imei2 ?? null,
    condition: item.condition ?? null,
    device_details:
      item.deviceDetails && typeof item.deviceDetails === 'object'
        ? (item.deviceDetails as unknown as Json)
        : null,
    barcode: item.barcode ?? null,
    description: item.description ?? null,
    image_url: item.image_url ?? null,
    deleted: item.deleted ?? false,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function salesRecordToRemoteRow(record: SalesRecord): Database['public']['Tables']['sales_records']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    item_id: record.item_id?.trim() ? record.item_id : null,
    sale_type: record.sale_type,
    item_name: record.item_name,
    item_category: record.item_category,
    item_brand: record.item_brand,
    item_mode: record.item_mode,
    serial_number: record.serial_number ?? null,
    imei: record.imei ?? null,
    device_details:
      record.device_details && typeof record.device_details === 'object'
        ? (record.device_details as unknown as Json)
        : null,
    sale_price: record.sale_price,
    cost_price: record.cost_price,
    profit: record.profit,
    quantity_sold: record.quantity_sold,
    payment_method: record.payment_method ?? null,
    payment_status: record.payment_status,
    amount_paid: record.amount_paid ?? null,
    balance_owed: record.balance_owed ?? null,
    due_date: record.due_date ?? null,
    customer_name: record.customer_name ?? null,
    customer_phone: record.customer_phone ?? null,
    sold_at: record.sold_at,
    receipt_number: record.receipt_number,
    swap_record_id: record.swap_record_id ?? null,
    trade_in_item_name: record.trade_in_item_name ?? null,
    trade_in_item_brand: record.trade_in_item_brand ?? null,
    trade_in_value: record.trade_in_value ?? null,
    balance_paid: record.balance_paid ?? null,
    returned: record.returned ?? false,
    return_id: record.return_id ?? null,
  };
}

// ─── Queue a write for later sync ────────────────────────────────────────────

export async function queueSync(
  table: SyncQueueItem['table'],
  operation: SyncQueueItem['operation'],
  payload: Record<string, unknown>
) {
  await db.sync_queue.add({
    id: uuidv4(),
    table,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  });
}

// ─── Flush pending queue to Supabase ─────────────────────────────────────────

export async function flushSyncQueue(): Promise<void> {
  if (!isOnline()) return;

  const pending = await db.sync_queue.orderBy('created_at').toArray();

  for (const item of pending) {
    try {
      if (item.table === 'inventory_items') {
        await syncInventoryItem(item);
      } else if (item.table === 'stock_movements') {
        await syncStockMovement(item);
      } else if (item.table === 'sales_records') {
        await syncSaleRecord(item);
      } else if (item.table === 'return_records') {
        await syncReturnRecord(item);
      } else if (item.table === 'swap_records') {
        await syncSwapRecord(item);
      } else if (item.table === 'credit_records') {
        await syncCreditRecord(item);
      } else if (item.table === 'repair_records') {
        await syncRepairRecord(item);
      } else if (item.table === 'business_profiles') {
        await syncBusinessProfile(item);
      }
      await db.sync_queue.delete(item.id);
    } catch (err) {
      console.error('[sync] Failed to sync item', item.id, err);
      await db.sync_queue.update(item.id, { retries: item.retries + 1 });
    }
  }
}

async function syncInventoryItem(item: SyncQueueItem) {
  const payload = item.payload as Partial<InventoryItem>;
  if (item.operation === 'insert' || item.operation === 'update') {
    const row = inventoryItemToRemoteRow(payload as InventoryItem);
    const { error } = await supabase.from('inventory_items').upsert(row as never);
    if (error) throw error;
  } else if (item.operation === 'delete') {
    const { error } = await supabase
      .from('inventory_items')
      .update({ deleted: true } as never)
      .eq('id', payload.id as string);
    if (error) throw error;
  }
}

async function syncStockMovement(item: SyncQueueItem) {
  if (item.operation === 'insert') {
    const { error } = await supabase
      .from('stock_movements')
      .insert(item.payload as never);
    if (error) throw error;
  }
}

async function syncSaleRecord(item: SyncQueueItem) {
  const record = item.payload as unknown as SalesRecord;
  if (item.operation === 'insert') {
    const row = salesRecordToRemoteRow(record);
    const { error } = await supabase.from('sales_records').insert(row as never);
    if (error) throw error;
  } else if (item.operation === 'update') {
    const row = salesRecordToRemoteRow(record);
    const { id, ...updates } = row;
    const { error } = await supabase.from('sales_records').update(updates as never).eq('id', id as string);
    if (error) throw error;
  }
}

async function syncReturnRecord(item: SyncQueueItem) {
  if (item.operation === 'insert') {
    const { error } = await supabase
      .from('return_records')
      .insert(item.payload as never);
    if (error) throw error;
  }
}

async function syncSwapRecord(item: SyncQueueItem) {
  if (item.operation === 'insert') {
    const { error } = await supabase
      .from('swap_records')
      .insert(item.payload as never);
    if (error) throw error;
  }
}

async function syncCreditRecord(item: SyncQueueItem) {
  if (item.operation === 'insert') {
    const { error } = await supabase.from('credit_records').insert(item.payload as never);
    if (error) throw error;
  } else if (item.operation === 'update') {
    const payload = item.payload as { id: string };
    const { error } = await supabase.from('credit_records').update(item.payload as never).eq('id', payload.id);
    if (error) throw error;
  }
}

async function syncRepairRecord(item: SyncQueueItem) {
  if (item.operation === 'insert') {
    const { error } = await supabase.from('repair_records').insert(item.payload as never);
    if (error) throw error;
  } else if (item.operation === 'update') {
    const payload = item.payload as { id: string };
    const { error } = await supabase.from('repair_records').update(item.payload as never).eq('id', payload.id);
    if (error) throw error;
  }
}

function remoteRowToBusinessProfile(row: RemoteBusinessProfileRow): BusinessProfile {
  return {
    id: row.id,
    shop_name: row.shop_name,
    owner_name: row.owner_name,
    phone: row.phone,
    email: row.email ?? undefined,
    address: row.address,
    trial_start_date: row.trial_start_date,
    trial_end_date: row.trial_end_date,
    plan: row.plan as BusinessProfile['plan'],
    plan_status: row.plan_status as BusinessProfile['plan_status'],
    subscription_id: row.subscription_id ?? undefined,
    onboarding_complete: row.onboarding_complete,
    updated_at: row.updated_at,
    created_at: row.created_at ? String(row.created_at) : undefined,
    account_disabled: typeof row.account_disabled === 'boolean' ? row.account_disabled : undefined,
    sync_status: 'synced',
  };
}

function businessProfileToRemotePayload(bp: BusinessProfile): RemoteBusinessProfileRow {
  return {
    id: bp.id,
    shop_name: bp.shop_name,
    owner_name: bp.owner_name,
    phone: bp.phone,
    email: bp.email ?? null,
    address: bp.address,
    trial_start_date: bp.trial_start_date,
    trial_end_date: bp.trial_end_date,
    plan: bp.plan,
    plan_status: bp.plan_status,
    subscription_id: bp.subscription_id ?? null,
    onboarding_complete: bp.onboarding_complete,
    updated_at: bp.updated_at,
    created_at: bp.created_at ?? new Date().toISOString(),
    account_disabled: bp.account_disabled ?? false,
  };
}

async function syncBusinessProfile(item: SyncQueueItem) {
  const payload = item.payload as unknown as BusinessProfile;
  const row = businessProfileToRemotePayload(payload);
  if (item.operation === 'insert' || item.operation === 'update') {
    const { error } = await supabase.from('business_profiles').upsert(row as never);
    if (error) throw error;
  }
}

// ─── Pull remote changes and merge into local DB ──────────────────────────────

export async function pullRemoteInventory(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data) return;

  const rows = data as unknown as RemoteInventoryRow[];
  const mapped: InventoryItem[] = rows.map(row => {
    const category = row.category as InventoryItem['category'];
    const mode = (row.mode as InventoryItem['mode']) ?? getCategoryMode(category);
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      category,
      brand: row.brand,
      price: row.price,
      cost_price: row.cost_price ?? undefined,
      mode,
      status: (row.status as InventoryItem['status']) ?? (mode === 'serialized' ? 'in_stock' : undefined),
      quantity: row.quantity,
      low_stock_threshold: row.low_stock_threshold,
      serial_number: row.serial_number ?? undefined,
      imei: row.imei ?? undefined,
      imei2: row.imei2 ?? undefined,
      condition: row.condition ?? undefined,
      deviceDetails: (typeof row.device_details === 'object' && row.device_details && !Array.isArray(row.device_details)
        ? row.device_details
        : undefined) as InventoryItem['deviceDetails'],
      barcode: row.barcode ?? undefined,
      description: row.description ?? undefined,
      image_url: row.image_url ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted: row.deleted,
      sync_status: 'synced' as const,
    };
  });

  await db.inventory_items.bulkPut(mapped);
}

export async function pullRemoteBusinessProfile(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const row = data as RemoteBusinessProfileRow;
  const local = await db.business_profiles.get(userId);
  const remoteUpdated = new Date(row.updated_at).getTime();
  const localUpdated = local ? new Date(local.updated_at).getTime() : 0;

  if (remoteUpdated >= localUpdated) {
    await db.business_profiles.put(remoteRowToBusinessProfile(row));
  }
}

export async function pullRemoteSalesRecords(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('sales_records')
    .select('*')
    .eq('user_id', userId)
    .order('sold_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteSalesRow[];
  const mapped: SalesRecord[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    item_id: row.item_id ?? '',
    sale_type: row.sale_type,
    item_name: row.item_name,
    item_category: row.item_category as SalesRecord['item_category'],
    item_brand: row.item_brand,
    item_mode: row.item_mode,
    serial_number: row.serial_number ?? undefined,
    imei: row.imei ?? undefined,
    device_details: (typeof row.device_details === 'object' && row.device_details && !Array.isArray(row.device_details)
      ? row.device_details
      : undefined) as SalesRecord['device_details'],
    sale_price: row.sale_price,
    cost_price: row.cost_price ?? 0,
    profit: row.profit ?? 0,
    payment_method: row.payment_method ?? undefined,
    payment_status: row.payment_status,
    amount_paid: row.amount_paid ?? undefined,
    balance_owed: row.balance_owed ?? undefined,
    due_date: row.due_date ?? undefined,
    customer_name: row.customer_name ?? undefined,
    customer_phone: row.customer_phone ?? undefined,
    quantity_sold: row.quantity_sold ?? 1,
    sold_at: row.sold_at,
    receipt_number: row.receipt_number,
    swap_record_id: row.swap_record_id ?? undefined,
    trade_in_item_name: row.trade_in_item_name ?? undefined,
    trade_in_item_brand: row.trade_in_item_brand ?? undefined,
    trade_in_value: row.trade_in_value ?? undefined,
    balance_paid: row.balance_paid ?? undefined,
    returned: row.returned,
    return_id: row.return_id ?? undefined,
    sync_status: 'synced',
  }));

  await db.sales_records.bulkPut(mapped);
}

export async function pullRemoteReturnRecords(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('return_records')
    .select('*')
    .eq('user_id', userId)
    .order('returned_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteReturnRow[];
  const mapped: ReturnRecord[] = rows.map(row => ({
    id: row.id,
    sale_id: row.sale_id,
    item_id: row.item_id,
    user_id: row.user_id,
    reason: row.reason,
    return_type: row.return_type,
    notes: row.notes ?? undefined,
    returned_at: row.returned_at,
    refund_amount: row.refund_amount,
    exchange_item_id: row.exchange_item_id ?? undefined,
    exchange_item_name: row.exchange_item_name ?? undefined,
    exchange_sale_id: row.exchange_sale_id ?? undefined,
    sync_status: 'synced',
  }));

  await db.return_records.bulkPut(mapped);
}

export async function pullRemoteSwapRecords(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('swap_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteSwapRow[];
  const mapped: SwapRecord[] = rows.map(row => ({
    id: row.id,
    outgoing_item_id: row.outgoing_item_id,
    incoming_item_id: row.incoming_item_id,
    user_id: row.user_id,
    sale_id: row.sale_id,
    sale_price: row.sale_price,
    trade_in_value: row.trade_in_value,
    balance_paid: row.balance_paid,
    payment_method: row.payment_method ?? undefined,
    customer_name: row.customer_name ?? undefined,
    customer_phone: row.customer_phone ?? undefined,
    date: row.date,
    sync_status: 'synced',
  }));

  await db.swap_records.bulkPut(mapped);
}

export async function pullRemoteCreditRecords(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('credit_records')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: false });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteCreditRow[];
  const mapped: CreditRecord[] = rows.map(row => ({
    id: row.id,
    sale_id: row.sale_id,
    user_id: row.user_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    item_name: row.item_name,
    total_amount: row.total_amount,
    amount_paid: row.amount_paid,
    balance_owed: row.balance_owed,
    due_date: row.due_date,
    status: row.status,
    payments: parseCreditPayments(row.payments),
    notes: row.notes ?? undefined,
    sync_status: 'synced',
  }));

  await db.credit_records.bulkPut(mapped);
}

export async function pullRemoteRepairRecords(userId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('repair_records')
    .select('*')
    .eq('user_id', userId)
    .order('date_sent', { ascending: false });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteRepairRow[];
  const mapped: RepairRecord[] = rows.map(row => ({
    id: row.id,
    item_id: row.item_id,
    user_id: row.user_id,
    engineer_name: row.engineer_name,
    engineer_phone: row.engineer_phone ?? undefined,
    issue_description: row.issue_description,
    repair_cost: row.repair_cost ?? undefined,
    date_sent: row.date_sent,
    expected_return_date: row.expected_return_date ?? undefined,
    date_returned: row.date_returned ?? undefined,
    repair_status: row.repair_status,
    notes: row.notes ?? undefined,
    sync_status: 'synced',
  }));

  await db.repair_records.bulkPut(mapped);
}

/** Run after `flushSyncQueue`: download server rows into IndexedDB for this device. */
export async function pullAllRemoteShopData(userId: string): Promise<void> {
  const pulls: [string, () => Promise<void>][] = [
    ['business_profiles', () => pullRemoteBusinessProfile(userId)],
    ['inventory_items', () => pullRemoteInventory(userId)],
    ['sales_records', () => pullRemoteSalesRecords(userId)],
    ['return_records', () => pullRemoteReturnRecords(userId)],
    ['swap_records', () => pullRemoteSwapRecords(userId)],
    ['credit_records', () => pullRemoteCreditRecords(userId)],
    ['repair_records', () => pullRemoteRepairRecords(userId)],
  ];

  for (const [label, fn] of pulls) {
    try {
      await fn();
    } catch (err) {
      console.error(`[sync] pull ${label} failed`, err);
    }
  }
}
