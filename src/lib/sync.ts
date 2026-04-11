import { supabase, isOnline } from './supabase';
import { db, clearAllLocalShopData } from './db';
import { v4 as uuidv4 } from 'uuid';
import { getCategoryMode } from '@/types';
import type {
  AuditEvent,
  BusinessProfile,
  CreditRecord,
  InventoryItem,
  RepairRecord,
  ReturnRecord,
  SalesRecord,
  ShopLocation,
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
type RemoteAuditRow = Database['public']['Tables']['audit_events']['Row'];
type RemoteShopLocationRow = Database['public']['Tables']['shop_locations']['Row'];

function parseCreditPayments(json: unknown): CreditRecord['payments'] {
  if (!Array.isArray(json)) return [];
  return json as CreditRecord['payments'];
}

/** Strip Dexie-only fields and map keys so PostgREST accepts the body (unknown columns → 400). */
function inventoryItemToRemoteRow(item: InventoryItem): Database['public']['Tables']['inventory_items']['Insert'] {
  if (!item.location_id) throw new Error('inventory_items.location_id required before sync');
  return {
    id: item.id,
    user_id: item.user_id,
    location_id: item.location_id,
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
  if (!record.location_id) throw new Error('sales_records.location_id required before sync');
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
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

function syncErrorMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return '';
}

function syncErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const o = err as { code?: unknown; cause?: unknown };
  if (typeof o.code === 'string') return o.code;
  if (o.cause) return syncErrorCode(o.cause);
  return undefined;
}

/** Postgres 42501 / RLS — retrying the same payload will not help until DB policies or membership change. */
function isRlsViolation(err: unknown): boolean {
  if (syncErrorCode(err) === '42501') return true;
  return /row-level security policy/i.test(syncErrorMessage(err));
}

const MAX_SYNC_QUEUE_RETRIES = 12;

// ─── Queue a write for later sync ────────────────────────────────────────────

/** Call before `signOut`: upload pending changes, then wipe IndexedDB so the next login starts clean. */
export async function prepareLocalDataForSignOut(): Promise<void> {
  try {
    await flushSyncQueue();
  } catch (e) {
    console.error('[sync] flush before sign out failed', e);
  }
  await clearAllLocalShopData();
}

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

let flushTail: Promise<void> = Promise.resolve();

async function runFlushSyncQueueOnce(): Promise<void> {
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
      } else if (item.table === 'shop_locations') {
        await syncShopLocation(item);
      }
      await db.sync_queue.delete(item.id);
    } catch (err) {
      if (isRlsViolation(err)) {
        console.error(
          '[sync] Server rejected this change (RLS). Removed from sync queue — retries would spam the console. ' +
            'Ensure Supabase has shop member policies (e.g. migration 20260408130000_shop_members_audit.sql). ' +
            'Local IndexedDB is unchanged; you may need to fix the project RLS and re-upload or reconcile data.',
          { table: item.table, operation: item.operation, queueId: item.id },
          err
        );
        await db.sync_queue.delete(item.id);
        continue;
      }

      const nextRetries = item.retries + 1;
      console.error('[sync] Failed to sync item', item.id, err);
      if (nextRetries >= MAX_SYNC_QUEUE_RETRIES) {
        console.error(
          '[sync] Dropping queue item after max retries; local data still exists offline',
          item.table,
          item.operation,
          item.id
        );
        await db.sync_queue.delete(item.id);
      } else {
        await db.sync_queue.update(item.id, { retries: nextRetries });
      }
    }
  }
}

/** Serializes concurrent flushes so overlapping uploads don’t race the same queue. */
export async function flushSyncQueue(): Promise<void> {
  if (!isOnline()) return;
  const step = flushTail.then(() => runFlushSyncQueueOnce());
  flushTail = step.catch(err => {
    console.error('[sync] flush chain error', err);
  });
  await step;
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

async function syncShopLocation(item: SyncQueueItem) {
  const payload = item.payload as unknown as ShopLocation;
  if (item.operation === 'insert' || item.operation === 'update') {
    const row: Database['public']['Tables']['shop_locations']['Insert'] = {
      id: payload.id,
      business_id: payload.business_id,
      name: payload.name,
      sort_order: payload.sort_order,
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    };
    const { error } = await supabase.from('shop_locations').upsert(row as never);
    if (error) throw error;
  }
}

/** Assign first branch id to legacy rows missing `location_id`. */
export async function backfillMissingLocationIds(businessId: string): Promise<void> {
  const rows = await db.shop_locations.where('business_id').equals(businessId).sortBy('sort_order');
  const locId = rows[0]?.id;
  if (!locId) return;
  await db.inventory_items
    .where('user_id')
    .equals(businessId)
    .modify(i => {
      if (!i.location_id) i.location_id = locId;
    });
  await db.sales_records
    .where('user_id')
    .equals(businessId)
    .modify(r => {
      if (!r.location_id) r.location_id = locId;
    });
  await db.return_records
    .where('user_id')
    .equals(businessId)
    .modify(r => {
      if (!r.location_id) r.location_id = locId;
    });
  await db.swap_records
    .where('user_id')
    .equals(businessId)
    .modify(r => {
      if (!r.location_id) r.location_id = locId;
    });
  await db.credit_records
    .where('user_id')
    .equals(businessId)
    .modify(r => {
      if (!r.location_id) r.location_id = locId;
    });
  await db.repair_records
    .where('user_id')
    .equals(businessId)
    .modify(r => {
      if (!r.location_id) r.location_id = locId;
    });
  await db.stock_sessions
    .where('user_id')
    .equals(businessId)
    .modify(s => {
      if (!s.location_id) s.location_id = locId;
    });
}

/** When no branches exist locally (new shop or pre-migration), create Main branch and sync. */
/** Create an additional branch and queue sync (owner/manager only on server). */
export async function createShopLocation(businessId: string, name: string): Promise<ShopLocation> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Branch name required');
  if (trimmed.toLowerCase() === 'main branch') {
    const rows = await db.shop_locations.where('business_id').equals(businessId).toArray();
    if (rows.some(r => r.name.toLowerCase() === 'main branch')) {
      throw new Error('A branch named "Main branch" already exists. Pick another name.');
    }
  }
  const rows = await db.shop_locations.where('business_id').equals(businessId).sortBy('sort_order');
  const sort_order = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0;
  const id = uuidv4();
  const now = new Date().toISOString();
  const row: ShopLocation = {
    id,
    business_id: businessId,
    name: trimmed,
    sort_order,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await db.shop_locations.add(row);
  await queueSync('shop_locations', 'insert', row as unknown as Record<string, unknown>);
  await flushSyncQueue();
  return row;
}

export async function ensureDefaultShopLocation(businessId: string): Promise<string> {
  if (isOnline()) {
    try {
      await pullRemoteShopLocations(businessId);
    } catch (e) {
      console.error('[sync] ensureDefaultShopLocation: pull shop_locations failed', e);
    }
  }
  const rows = await db.shop_locations.where('business_id').equals(businessId).sortBy('sort_order');
  if (rows.length) {
    await backfillMissingLocationIds(businessId);
    return rows[0].id;
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const row: ShopLocation = {
    id,
    business_id: businessId,
    name: 'Main branch',
    sort_order: 0,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await db.shop_locations.add(row);
  await queueSync('shop_locations', 'insert', row as unknown as Record<string, unknown>);
  await flushSyncQueue();
  await backfillMissingLocationIds(businessId);
  return id;
}

// ─── Pull remote changes and merge into local DB ──────────────────────────────

export async function pullRemoteShopLocations(businessId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('shop_locations')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteShopLocationRow[];
  const mapped: ShopLocation[] = rows.map(row => ({
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sync_status: 'synced',
  }));

  await db.shop_locations.bulkPut(mapped);
}

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
      location_id: row.location_id,
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
  const parsed = remoteRowToBusinessProfile(row);
  const local = await db.business_profiles.get(userId);
  const remoteUpdated = new Date(row.updated_at).getTime();
  const localUpdated = local ? new Date(local.updated_at).getTime() : 0;

  if (remoteUpdated >= localUpdated) {
    // Avoid redundant Dexie writes — each `put` re-fires liveQuery and can leave OnboardingGate stuck on "pending".
    if (local && local.updated_at === parsed.updated_at) return;
    await db.business_profiles.put(parsed);
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
    location_id: row.location_id,
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
    location_id: row.location_id,
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
    location_id: row.location_id,
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
    location_id: row.location_id,
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
    location_id: row.location_id,
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

/** Shop owner id === business_profiles.id === audit_events.business_id */
export async function pullRemoteAuditEvents(businessId: string): Promise<void> {
  if (!isOnline()) return;

  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(750);

  if (error) throw error;
  if (!data?.length) return;

  const rows = data as unknown as RemoteAuditRow[];
  const mapped: AuditEvent[] = rows.map(row => ({
    id: row.id,
    business_id: row.business_id,
    actor_user_id: row.actor_user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata:
      typeof row.metadata === 'object' && row.metadata !== null && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at,
    sync_status: 'synced',
  }));

  await db.audit_events.bulkPut(mapped);
}

/** One in-flight full pull per shop — overlapping callers await the same work (avoids realtime + mount doubling traffic). */
const pullAllInFlight = new Map<string, Promise<void>>();

/** Wall-clock of last *completed* full pull (mount, online, or realtime) — used to cap realtime-driven pulls. */
const lastFullPullCompletedAt = new Map<string, number>();
/** Same for audit-only realtime pulls (full pull also refreshes audit_events). */
const lastAuditPullCompletedAt = new Map<string, number>();

/**
 * Initial `runInitialPull` must run once per (actor, shop) login — survives StrictMode/remount.
 * Cleared when auth user clears (`ShopAccessProvider` load with !userId).
 */
const shopBootstrapConsumedKeys = new Set<string>();

export function tryConsumeShopBootstrap(actorUserId: string, shopOwnerId: string): boolean {
  const k = `${actorUserId}::${shopOwnerId}`;
  if (shopBootstrapConsumedKeys.has(k)) return false;
  shopBootstrapConsumedKeys.add(k);
  return true;
}

export function resetShopBootstrapDedupe(): void {
  shopBootstrapConsumedKeys.clear();
}

async function runFullPullWork(userId: string): Promise<void> {
  const existing = pullAllInFlight.get(userId);
  if (existing) return existing;

  const run = (async () => {
    try {
      await pullRemoteBusinessProfile(userId);
      await pullRemoteShopLocations(userId);

      const pulls: [string, () => Promise<void>][] = [
        ['inventory_items', () => pullRemoteInventory(userId)],
        ['sales_records', () => pullRemoteSalesRecords(userId)],
        ['return_records', () => pullRemoteReturnRecords(userId)],
        ['swap_records', () => pullRemoteSwapRecords(userId)],
        ['credit_records', () => pullRemoteCreditRecords(userId)],
        ['repair_records', () => pullRemoteRepairRecords(userId)],
        ['audit_events', () => pullRemoteAuditEvents(userId)],
      ];

      await Promise.all(
        pulls.map(async ([label, fn]) => {
          try {
            await fn();
          } catch (err) {
            console.error(`[sync] pull ${label} failed`, err);
          }
        })
      );
      try {
        await backfillMissingLocationIds(userId);
        const locCount = await db.shop_locations.where('business_id').equals(userId).count();
        if (locCount === 0) {
          await ensureDefaultShopLocation(userId);
        }
      } catch (e) {
        console.error('[sync] backfill / default location failed', e);
      }
    } finally {
      const now = Date.now();
      lastFullPullCompletedAt.set(userId, now);
      lastAuditPullCompletedAt.set(userId, now);
    }
  })();

  pullAllInFlight.set(userId, run);
  try {
    await run;
  } finally {
    if (pullAllInFlight.get(userId) === run) pullAllInFlight.delete(userId);
  }
}

/**
 * Download server rows into IndexedDB (8 parallel SELECTs). Call after `flushSyncQueue`.
 * Mount / `online` use this directly so users get data immediately after load or reconnect.
 */
export async function pullAllRemoteShopData(userId: string): Promise<void> {
  return runFullPullWork(userId);
}

/**
 * Full pull only if the last one finished longer than `minAgeMs` ago.
 * Use for `window.online` so reconnect doesn’t replay eight SELECTs right after the initial load.
 */
export async function pullAllRemoteShopDataIfStale(userId: string, minAgeMs: number): Promise<void> {
  const last = lastFullPullCompletedAt.get(userId) ?? 0;
  if (Date.now() - last < minAgeMs) return;
  return runFullPullWork(userId);
}

const REALTIME_TABLES_WITH_USER_ID = [
  'inventory_items',
  'sales_records',
  'return_records',
  'swap_records',
  'credit_records',
  'repair_records',
] as const;

/** After Postgres noise goes quiet, wait this long before starting a full pull. */
const REALTIME_FULL_PULL_DEBOUNCE_MS = 20_000;
/** At most one full shop sync this often when triggered only by Realtime (each sync ≈ 8 DB round-trips). */
const REALTIME_FULL_PULL_MIN_GAP_MS = 90_000;
const REALTIME_AUDIT_DEBOUNCE_MS = 5_000;
const REALTIME_AUDIT_MIN_GAP_MS = 45_000;

/**
 * Subscribe to row changes for this shop. Realtime uses heavy debouncing + minimum gaps so
 * replication chatter cannot generate tens of thousands of REST calls (see Supabase usage charts).
 * Mount / `online` still call `pullAllRemoteShopData` immediately.
 *
 * Realtime is **opt-in** (`VITE_ENABLE_SHOP_REALTIME=true`) so a stock deploy never opens a shop
 * WebSocket unless you’ve enabled replication in Supabase. Otherwise the JS client retries failed
 * Realtime forever → console spam, battery drain, and useless load.
 *
 * Data still syncs: login / refresh full pull, writes via the queue, and `window` `online`.
 */
export function subscribeShopRemoteChanges(userId: string): () => void {
  if (import.meta.env.VITE_ENABLE_SHOP_REALTIME !== 'true') {
    return () => undefined;
  }

  if (!isOnline() || !userId) return () => undefined;

  let fullTimer: ReturnType<typeof setTimeout> | null = null;
  let auditTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleFullPullFromRealtime = () => {
    if (auditTimer) {
      clearTimeout(auditTimer);
      auditTimer = null;
    }
    if (fullTimer) clearTimeout(fullTimer);
    fullTimer = setTimeout(() => {
      fullTimer = null;
      void (async () => {
        try {
          const last = lastFullPullCompletedAt.get(userId) ?? 0;
          const extra = Math.max(0, REALTIME_FULL_PULL_MIN_GAP_MS - (Date.now() - last));
          if (extra > 0) await new Promise(r => setTimeout(r, extra));
          await runFullPullWork(userId);
        } catch (e) {
          console.error('[sync] realtime pull failed', e);
        }
      })();
    }, REALTIME_FULL_PULL_DEBOUNCE_MS);
  };

  const scheduleAuditPullFromRealtime = () => {
    if (auditTimer) clearTimeout(auditTimer);
    auditTimer = setTimeout(() => {
      auditTimer = null;
      void (async () => {
        try {
          const last = lastAuditPullCompletedAt.get(userId) ?? 0;
          const extra = Math.max(0, REALTIME_AUDIT_MIN_GAP_MS - (Date.now() - last));
          if (extra > 0) await new Promise(r => setTimeout(r, extra));
          await pullRemoteAuditEvents(userId);
          lastAuditPullCompletedAt.set(userId, Date.now());
        } catch (e) {
          console.error('[sync] realtime audit pull failed', e);
        }
      })();
    }, REALTIME_AUDIT_DEBOUNCE_MS);
  };

  const channel = supabase.channel(`shop-data:${userId}`);

  for (const table of REALTIME_TABLES_WITH_USER_ID) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      scheduleFullPullFromRealtime
    );
  }

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'business_profiles', filter: `id=eq.${userId}` },
    scheduleFullPullFromRealtime
  );

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'shop_locations', filter: `business_id=eq.${userId}` },
    scheduleFullPullFromRealtime
  );

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'audit_events', filter: `business_id=eq.${userId}` },
    scheduleAuditPullFromRealtime
  );

  channel.subscribe(status => {
    if (status === 'CHANNEL_ERROR') {
      console.warn(
        '[sync] Realtime unavailable or misconfigured. For instant multi-device updates, enable replication for public tables in Supabase (Dashboard → Database → Publications / Replication).'
      );
    }
  });

  return () => {
    if (fullTimer) clearTimeout(fullTimer);
    if (auditTimer) clearTimeout(auditTimer);
    void supabase.removeChannel(channel);
  };
}
