import { supabase, isOnline } from './supabase';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { getCategoryMode } from '@/types';
import type { BusinessProfile, InventoryItem, SyncQueueItem } from '@/types';
import type { Database } from '@/types/supabase';

type RemoteInventoryRow = Database['public']['Tables']['inventory_items']['Row'];
type RemoteBusinessProfileRow = Database['public']['Tables']['business_profiles']['Row'];

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
    const { error } = await supabase
      .from('inventory_items')
      .upsert(payload as never);
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
  if (item.operation === 'insert') {
    const { error } = await supabase
      .from('sales_records')
      .insert(item.payload as never);
    if (error) throw error;
  } else if (item.operation === 'update') {
    const payload = item.payload as { id: string };
    const { error } = await supabase
      .from('sales_records')
      .update(item.payload as never)
      .eq('id', payload.id);
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
