import { supabase, isOnline } from './supabase';
import { db, clearAllLocalShopData } from './db';
import { v4 as uuidv4 } from 'uuid';
import { getCategoryMode } from '@/types';
import type {
  AuditEvent,
  BusinessProfile,
  CashSessionRecord,
  ContactRecord,
  CreditRecord,
  ExpenseCategory,
  ExpenseRecord,
  InventoryItem,
  PurchaseLine,
  PurchaseRecord,
  RecurringExpenseRecord,
  RepairRecord,
  ReturnRecord,
  SalesRecord,
  ShopLocation,
  StockSession,
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
type RemoteContactRow = Database['public']['Tables']['contacts']['Row'];
type RemoteExpenseRow = Database['public']['Tables']['expense_records']['Row'];
type RemoteRecurringExpenseRow = Database['public']['Tables']['recurring_expenses']['Row'];
type RemotePurchaseRow = Database['public']['Tables']['purchase_records']['Row'];
type RemoteCashSessionRow = Database['public']['Tables']['cash_sessions']['Row'];
type RemoteStockSessionRow = Database['public']['Tables']['stock_sessions']['Row'];

function parseCreditPayments(json: unknown): CreditRecord['payments'] {
  if (!Array.isArray(json)) return [];
  return json as CreditRecord['payments'];
}

function parseWarrantyCover(json: unknown): SalesRecord['warranty_cover'] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return undefined;
  const value = (json as { value?: unknown }).value;
  const unit = (json as { unit?: unknown }).unit;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (unit !== 'days' && unit !== 'months') return undefined;
  return { value, unit };
}

function parseStockCondition(raw: unknown): SalesRecord['item_stock_condition'] {
  if (raw === 'new' || raw === 'used' || raw === 'uk_used' || raw === 'refurb') return raw;
  return undefined;
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
    warranty_cover: record.warranty_cover ? (record.warranty_cover as unknown as Json) : null,
    item_stock_condition: record.item_stock_condition ?? null,
    warranty_months: record.warranty_months ?? null,
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

/** Ensure parent `business_profiles` rows exist on the server before `shop_locations` (FK). */
function syncQueueTier(table: SyncQueueItem['table']): number {
  if (table === 'business_profiles') return 0;
  if (table === 'shop_locations') return 1;
  return 2;
}

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
  pending.sort((a, b) => {
    const tier = syncQueueTier(a.table) - syncQueueTier(b.table);
    if (tier !== 0) return tier;
    const byTime = a.created_at.localeCompare(b.created_at);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });

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
      } else if (item.table === 'contacts') {
        await syncContactRecord(item);
      } else if (item.table === 'expense_records') {
        await syncExpenseRecord(item);
      } else if (item.table === 'recurring_expenses') {
        await syncRecurringExpense(item);
      } else if (item.table === 'purchase_records') {
        await syncPurchaseRecord(item);
      } else if (item.table === 'cash_sessions') {
        await syncCashSession(item);
      } else if (item.table === 'stock_sessions') {
        await syncStockSession(item);
      }
      await markLocalShopOpsSynced(item);
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
    const { error } = await supabase.from('sales_records').upsert(row as never);
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
    logo_path: row.logo_path ?? undefined,
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
    logo_path: bp.logo_path ?? null,
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

function isDuplicateMainBranchError(err: unknown): boolean {
  const code = syncErrorCode(err);
  const msg = syncErrorMessage(err);
  return code === '23505' || /one_main_branch_per_shop|duplicate key/i.test(msg);
}

function isMissingBusinessProfileError(err: unknown): boolean {
  const code = syncErrorCode(err);
  const msg = syncErrorMessage(err);
  return code === '23503' || /shop_locations_business_id_fkey/i.test(msg);
}

function shopLocationWriteError(err: unknown): Error {
  if (isDuplicateMainBranchError(err)) {
    return new Error('A branch named “Main branch” already exists. Use a different name.');
  }
  if (isMissingBusinessProfileError(err)) {
    return new Error(
      'Shop profile is not on the server yet. Save Shop details in Settings, then add the branch again.'
    );
  }
  if (isRlsViolation(err)) {
    return new Error(
      'You do not have permission to add branches. Ask the owner, or use a manager with access to all branches.'
    );
  }
  return new Error(syncErrorMessage(err) || 'Could not add branch');
}

async function ensureRemoteBusinessProfile(businessId: string): Promise<void> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (data) return;
  const local = await db.business_profiles.get(businessId);
  if (!local) {
    throw new Error(
      'Shop profile is not saved yet. Open Settings → Shop, save your shop details, then add the branch.'
    );
  }
  await syncBusinessProfile({
    id: 'ensure-profile',
    table: 'business_profiles',
    operation: 'insert',
    payload: local as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
    retries: 0,
  });
}

async function upsertRemoteShopLocation(payload: ShopLocation): Promise<void> {
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

async function syncShopLocation(item: SyncQueueItem) {
  const payload = item.payload as unknown as ShopLocation;
  if (item.operation === 'insert' || item.operation === 'update') {
    try {
      await upsertRemoteShopLocation(payload);
    } catch (err) {
      if (payload.name === 'Main branch' && isDuplicateMainBranchError(err)) {
        await pullRemoteShopLocations(payload.business_id);
        const remotes = await db.shop_locations.where('business_id').equals(payload.business_id).toArray();
        const remoteMain = remotes.find(r => r.name === 'Main branch' && r.id !== payload.id);
        if (remoteMain) {
          await remapLocationId(payload.business_id, payload.id, remoteMain.id);
          await db.shop_locations.delete(payload.id);
        }
        return;
      }
      throw err;
    }
  }
}

function requireLocationId(locationId: string | undefined, table: string): string {
  if (!locationId) throw new Error(`${table}.location_id required before sync`);
  return locationId;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

async function upsertShopOpsRow(
  table:
    | 'contacts'
    | 'expense_records'
    | 'recurring_expenses'
    | 'purchase_records'
    | 'cash_sessions'
    | 'stock_sessions',
  row: Record<string, unknown>,
) {
  const { error } = await supabase.from(table).upsert(row as never);
  if (error) throw error;
}

function contactToRemoteRow(record: ContactRecord): Database['public']['Tables']['contacts']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: requireLocationId(record.location_id, 'contacts'),
    type: record.type,
    name: record.name,
    phone: record.phone ?? null,
    note: record.note ?? null,
    location_text: record.location_text ?? null,
    balance_owed: record.balance_owed,
    deal_count: record.deal_count,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function expenseToRemoteRow(record: ExpenseRecord): Database['public']['Tables']['expense_records']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
    category: record.category,
    label: record.label,
    amount: record.amount,
    payment_method: record.payment_method ?? null,
    recorded_at: record.recorded_at,
    created_at: record.created_at,
  };
}

function recurringExpenseToRemoteRow(
  record: RecurringExpenseRecord,
): Database['public']['Tables']['recurring_expenses']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
    category: record.category,
    label: record.label,
    amount: record.amount,
    payment_method: record.payment_method ?? null,
    recurrence: record.recurrence,
    active: record.active,
    created_at: record.created_at,
  };
}

function purchaseToRemoteRow(record: PurchaseRecord): Database['public']['Tables']['purchase_records']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
    supplier_contact_id: record.supplier_contact_id ?? null,
    supplier_name: record.supplier_name,
    items: record.items as unknown as Json,
    total: record.total,
    paid: record.paid,
    payment_method: record.payment_method ?? null,
    terms: record.terms,
    purchased_at: record.purchased_at,
    received_at: record.received_at ?? null,
    created_at: record.created_at,
  };
}

function cashSessionToRemoteRow(record: CashSessionRecord): Database['public']['Tables']['cash_sessions']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
    opening_float: record.opening_float,
    cash_sales: record.cash_sales,
    cash_collected: record.cash_collected,
    cash_expenses: record.cash_expenses,
    expected: record.expected,
    counted: record.counted,
    variance: record.variance,
    closed_at: record.closed_at,
    closed_by_label: record.closed_by_label ?? null,
  };
}

function stockSessionToRemoteRow(record: StockSession): Database['public']['Tables']['stock_sessions']['Insert'] {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: requireLocationId(record.location_id, 'stock_sessions'),
    date: record.date,
    opened_at: record.opened_at,
    closed_at: record.closed_at ?? null,
    opened_by_user_id: record.opened_by_user_id,
    closed_by_user_id: record.closed_by_user_id ?? null,
    opening_snapshot_ids: record.opening_snapshot_ids as unknown as Json,
    opening_device_snapshots: (record.opening_device_snapshots ?? null) as unknown as Json,
    opening_confirmed_ids: (record.opening_confirmed_ids ?? null) as unknown as Json,
    expected_closing_ids: record.expected_closing_ids as unknown as Json,
    expected_closing_snapshots: (record.expected_closing_snapshots ?? null) as unknown as Json,
    actual_closing_ids: record.actual_closing_ids as unknown as Json,
    closing_device_snapshots: (record.closing_device_snapshots ?? null) as unknown as Json,
    missing_item_ids: record.missing_item_ids as unknown as Json,
    missing_notes_by_item_id: record.missing_notes_by_item_id as unknown as Json,
    status: record.status,
    notes: record.notes ?? null,
    summary: (record.summary ?? null) as unknown as Json,
    audit_log: record.audit_log as unknown as Json,
  };
}

async function syncContactRecord(item: SyncQueueItem) {
  const record = item.payload as unknown as ContactRecord;
  if (item.operation === 'delete') {
    const { error } = await supabase.from('contacts').delete().eq('id', record.id);
    if (error) throw error;
    return;
  }
  await upsertShopOpsRow('contacts', contactToRemoteRow(record) as unknown as Record<string, unknown>);
}

async function syncExpenseRecord(item: SyncQueueItem) {
  await upsertShopOpsRow(
    'expense_records',
    expenseToRemoteRow(item.payload as unknown as ExpenseRecord) as unknown as Record<string, unknown>,
  );
}

async function syncRecurringExpense(item: SyncQueueItem) {
  await upsertShopOpsRow(
    'recurring_expenses',
    recurringExpenseToRemoteRow(item.payload as unknown as RecurringExpenseRecord) as unknown as Record<string, unknown>,
  );
}

async function syncPurchaseRecord(item: SyncQueueItem) {
  await upsertShopOpsRow(
    'purchase_records',
    purchaseToRemoteRow(item.payload as unknown as PurchaseRecord) as unknown as Record<string, unknown>,
  );
}

async function syncCashSession(item: SyncQueueItem) {
  await upsertShopOpsRow(
    'cash_sessions',
    cashSessionToRemoteRow(item.payload as unknown as CashSessionRecord) as unknown as Record<string, unknown>,
  );
}

async function syncStockSession(item: SyncQueueItem) {
  await upsertShopOpsRow(
    'stock_sessions',
    stockSessionToRemoteRow(item.payload as unknown as StockSession) as unknown as Record<string, unknown>,
  );
}

async function markLocalShopOpsSynced(item: SyncQueueItem) {
  const id = item.payload.id;
  if (typeof id !== 'string') return;
  if (item.table === 'contacts') await db.contacts.update(id, { sync_status: 'synced' });
  else if (item.table === 'expense_records') await db.expense_records.update(id, { sync_status: 'synced' });
  else if (item.table === 'recurring_expenses') await db.recurring_expenses.update(id, { sync_status: 'synced' });
  else if (item.table === 'purchase_records') await db.purchase_records.update(id, { sync_status: 'synced' });
  else if (item.table === 'cash_sessions') await db.cash_sessions.update(id, { sync_status: 'synced' });
  else if (item.table === 'stock_sessions') await db.stock_sessions.update(id, { sync_status: 'synced' });
}

async function enqueueUnsyncedShopOps(userId: string) {
  const enqueue = async (
    table: SyncQueueItem['table'],
    rows: Array<{ id: string; sync_status?: string; location_id?: string }>,
  ) => {
    for (const row of rows) {
      if (row.sync_status === 'synced' || !row.location_id) continue;
      await queueSync(table, 'update', row as unknown as Record<string, unknown>);
    }
  };
  await enqueue('contacts', await db.contacts.where('user_id').equals(userId).toArray());
  await enqueue('expense_records', await db.expense_records.where('user_id').equals(userId).toArray());
  await enqueue('recurring_expenses', await db.recurring_expenses.where('user_id').equals(userId).toArray());
  await enqueue('purchase_records', await db.purchase_records.where('user_id').equals(userId).toArray());
  await enqueue('cash_sessions', await db.cash_sessions.where('user_id').equals(userId).toArray());
  await enqueue('stock_sessions', await db.stock_sessions.where('user_id').equals(userId).toArray());
}

async function mergePulledRows<T extends { id: string; sync_status?: string }>(
  table: { bulkGet: (ids: string[]) => Promise<(T | undefined)[]>; bulkPut: (rows: T[]) => Promise<unknown> },
  mapped: T[],
) {
  if (!mapped.length) return;
  const locals = (await table.bulkGet(mapped.map(row => row.id))).filter((row): row is T => Boolean(row));
  const localById = new Map(locals.map(row => [row.id, row]));
  await table.bulkPut(
    mapped.map(row => (localById.get(row.id)?.sync_status === 'pending' ? localById.get(row.id)! : row)),
  );
}

async function remapLocationId(businessId: string, fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;
  const rewrite = (row: { location_id?: string }) => {
    if (row.location_id === fromId) row.location_id = toId;
  };
  await db.inventory_items.where('user_id').equals(businessId).modify(rewrite);
  await db.sales_records.where('user_id').equals(businessId).modify(rewrite);
  await db.return_records.where('user_id').equals(businessId).modify(rewrite);
  await db.swap_records.where('user_id').equals(businessId).modify(rewrite);
  await db.credit_records.where('user_id').equals(businessId).modify(rewrite);
  await db.repair_records.where('user_id').equals(businessId).modify(rewrite);
  await db.stock_sessions.where('user_id').equals(businessId).modify(rewrite);
  await db.expense_records.where('user_id').equals(businessId).modify(rewrite);
  await db.purchase_records.where('user_id').equals(businessId).modify(rewrite);
  await db.cash_sessions.where('user_id').equals(businessId).modify(rewrite);
  await db.contacts.where('user_id').equals(businessId).modify(rewrite);
  await db.recurring_expenses.where('user_id').equals(businessId).modify(rewrite);
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
  if (isOnline()) {
    try {
      await pullRemoteShopLocations(businessId);
    } catch (e) {
      console.error('[sync] createShopLocation: pull shop_locations failed', e);
    }
  }
  const existing = await db.shop_locations.where('business_id').equals(businessId).toArray();
  if (trimmed.toLowerCase() === 'main branch' && existing.some(r => r.name.toLowerCase() === 'main branch')) {
    throw new Error('A branch named “Main branch” already exists. Pick another name.');
  }
  const sort_order = existing.length ? Math.max(...existing.map(r => r.sort_order)) + 1 : 0;
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
  if (!isOnline()) {
    await queueSync('shop_locations', 'insert', row as unknown as Record<string, unknown>);
    return row;
  }
  try {
    await ensureRemoteBusinessProfile(businessId);
    await upsertRemoteShopLocation(row);
    await db.shop_locations.update(id, { sync_status: 'synced' });
    return { ...row, sync_status: 'synced' };
  } catch (err) {
    await db.shop_locations.delete(id);
    throw shopLocationWriteError(err);
  }
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

  const locals = await db.inventory_items.bulkGet(mapped.map(row => row.id));
  const merged = mapped.map((row, index) => {
    const local = locals[index];
    if (local?.sync_status === 'pending') return local;
    return row;
  });
  await db.inventory_items.bulkPut(merged);
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
    warranty_cover: parseWarrantyCover(row.warranty_cover),
    item_stock_condition: parseStockCondition(row.item_stock_condition),
    warranty_months: row.warranty_months ?? undefined,
    sync_status: 'synced',
  }));

  const locals = (await db.sales_records.bulkGet(mapped.map(row => row.id))).filter(
    (row): row is SalesRecord => Boolean(row),
  );
  const localById = new Map(locals.map(row => [row.id, row]));
  const merged = mapped.map(row => {
    const local = localById.get(row.id);
    if (local?.sync_status === 'pending') return local;
    return {
      ...row,
      warranty_cover: row.warranty_cover ?? local?.warranty_cover,
      item_stock_condition: row.item_stock_condition ?? local?.item_stock_condition,
      warranty_months: row.warranty_months ?? local?.warranty_months,
    };
  });

  await db.sales_records.bulkPut(merged);
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

function parsePurchaseItems(json: unknown): PurchaseLine[] {
  if (!Array.isArray(json)) return [];
  return json.filter((row): row is PurchaseLine => {
    if (!row || typeof row !== 'object') return false;
    const item = row as PurchaseLine;
    return typeof item.name === 'string' && typeof item.qty === 'number' && typeof item.unit_cost === 'number';
  });
}

export async function pullRemoteContacts(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase.from('contacts').select('*').eq('user_id', userId);
  if (error) throw error;
  if (!data?.length) return;
  const mapped: ContactRecord[] = (data as RemoteContactRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    type: row.type,
    name: row.name,
    phone: row.phone ?? undefined,
    note: row.note ?? undefined,
    location_text: row.location_text ?? undefined,
    balance_owed: row.balance_owed,
    deal_count: row.deal_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sync_status: 'synced',
  }));
  await mergePulledRows(db.contacts, mapped);
}

export async function pullRemoteExpenseRecords(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase
    .from('expense_records')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return;
  const mapped: ExpenseRecord[] = (data as RemoteExpenseRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    category: row.category as ExpenseCategory,
    label: row.label,
    amount: row.amount,
    payment_method: row.payment_method ?? 'cash',
    recorded_at: row.recorded_at,
    created_at: row.created_at,
    sync_status: 'synced',
  }));
  await mergePulledRows(db.expense_records, mapped);
}

export async function pullRemoteRecurringExpenses(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase.from('recurring_expenses').select('*').eq('user_id', userId);
  if (error) throw error;
  if (!data?.length) return;
  const mapped: RecurringExpenseRecord[] = (data as RemoteRecurringExpenseRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    category: row.category as ExpenseCategory,
    label: row.label,
    amount: row.amount,
    payment_method: row.payment_method ?? 'cash',
    recurrence: row.recurrence,
    active: row.active,
    created_at: row.created_at,
    sync_status: 'synced',
  }));
  await mergePulledRows(db.recurring_expenses, mapped);
}

export async function pullRemotePurchaseRecords(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase
    .from('purchase_records')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return;
  const mapped: PurchaseRecord[] = (data as RemotePurchaseRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    supplier_contact_id: row.supplier_contact_id ?? undefined,
    supplier_name: row.supplier_name,
    items: parsePurchaseItems(row.items),
    total: row.total,
    paid: row.paid,
    payment_method: row.payment_method ?? undefined,
    terms: row.terms,
    purchased_at: row.purchased_at,
    received_at: row.received_at ?? undefined,
    created_at: row.created_at,
    sync_status: 'synced',
  }));
  await mergePulledRows(db.purchase_records, mapped);
}

export async function pullRemoteCashSessions(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('closed_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return;
  const mapped: CashSessionRecord[] = (data as RemoteCashSessionRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    opening_float: row.opening_float,
    cash_sales: row.cash_sales,
    cash_collected: row.cash_collected,
    cash_expenses: row.cash_expenses,
    expected: row.expected,
    counted: row.counted,
    variance: row.variance,
    closed_at: row.closed_at,
    closed_by_label: row.closed_by_label ?? undefined,
    sync_status: 'synced',
  }));
  await mergePulledRows(db.cash_sessions, mapped);
}

export async function pullRemoteStockSessions(userId: string): Promise<void> {
  if (!isOnline()) return;
  const { data, error } = await supabase
    .from('stock_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  if (!data?.length) return;
  const mapped: StockSession[] = (data as RemoteStockSessionRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    location_id: row.location_id,
    date: row.date,
    opened_at: row.opened_at,
    closed_at: row.closed_at ?? undefined,
    opened_by_user_id: row.opened_by_user_id,
    closed_by_user_id: row.closed_by_user_id ?? undefined,
    opening_snapshot_ids: asStringArray(row.opening_snapshot_ids),
    opening_device_snapshots: (row.opening_device_snapshots ?? undefined) as StockSession['opening_device_snapshots'],
    opening_confirmed_ids: row.opening_confirmed_ids ? asStringArray(row.opening_confirmed_ids) : undefined,
    expected_closing_ids: asStringArray(row.expected_closing_ids),
    expected_closing_snapshots: (row.expected_closing_snapshots ?? undefined) as StockSession['expected_closing_snapshots'],
    actual_closing_ids: asStringArray(row.actual_closing_ids),
    closing_device_snapshots: (row.closing_device_snapshots ?? undefined) as StockSession['closing_device_snapshots'],
    missing_item_ids: asStringArray(row.missing_item_ids),
    missing_notes_by_item_id:
      row.missing_notes_by_item_id && typeof row.missing_notes_by_item_id === 'object' && !Array.isArray(row.missing_notes_by_item_id)
        ? (row.missing_notes_by_item_id as Record<string, string>)
        : {},
    status: row.status,
    notes: row.notes ?? undefined,
    summary: (row.summary ?? undefined) as StockSession['summary'],
    audit_log: Array.isArray(row.audit_log)
      ? (row.audit_log as unknown as StockSession['audit_log'])
      : [],
    sync_status: 'synced',
  }));
  await mergePulledRows(db.stock_sessions, mapped);
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
      try {
        await backfillMissingLocationIds(userId);
      } catch (e) {
        console.error('[sync] location backfill before shop-ops upload failed', e);
      }
      await enqueueUnsyncedShopOps(userId);
      await flushSyncQueue();

      const pulls: [string, () => Promise<void>][] = [
        ['inventory_items', () => pullRemoteInventory(userId)],
        ['sales_records', () => pullRemoteSalesRecords(userId)],
        ['return_records', () => pullRemoteReturnRecords(userId)],
        ['swap_records', () => pullRemoteSwapRecords(userId)],
        ['credit_records', () => pullRemoteCreditRecords(userId)],
        ['repair_records', () => pullRemoteRepairRecords(userId)],
        ['contacts', () => pullRemoteContacts(userId)],
        ['expense_records', () => pullRemoteExpenseRecords(userId)],
        ['recurring_expenses', () => pullRemoteRecurringExpenses(userId)],
        ['purchase_records', () => pullRemotePurchaseRecords(userId)],
        ['cash_sessions', () => pullRemoteCashSessions(userId)],
        ['stock_sessions', () => pullRemoteStockSessions(userId)],
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
  await flushSyncQueue();
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
  'contacts',
  'expense_records',
  'recurring_expenses',
  'purchase_records',
  'cash_sessions',
  'stock_sessions',
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
