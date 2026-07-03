// ─── Enums ───────────────────────────────────────────────────────────────────

export type Category =
  | 'phones'
  | 'laptops'
  | 'tablets'
  | 'accessories'
  | 'parts';

export type ItemMode = 'serialized' | 'non_serialized';

// Only meaningful for serialized items (phones / laptops / tablets)
export type SerializedItemStatus =
  | 'in_stock'
  | 'sold'
  | 'reserved'
  | 'returned'
  | 'defective'
  | 'with_engineer'
  | 'missing';

export type MissingResolution = 'found' | 'stolen' | 'write_off';
export type DeviceCondition = 'working' | 'minor_faults' | 'major_faults' | 'not_working';
export type SaleType = 'sale' | 'swap';
export type PaymentStatus = 'paid' | 'credit';
export type CreditStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue';
export type RepairStatus = 'sent' | 'in_progress' | 'completed' | 'collected';
export type AppleICloudStatus = 'clean' | 'ibm' | 'idm' | 'icm' | 'icloud_locked' | 'find_my_on' | 'find_my_off';
export type AppleCarrierLock = 'factory_unlocked' | 'network_locked' | 'esim_only' | 'dual_sim';
export type AppleBiometricStatus = 'working' | 'not_working';
export type MacKeyboardStatus = 'working' | 'faulty_keys' | 'replaced';
export type MacScreenCondition = 'perfect' | 'minor_scratches' | 'cracked' | 'replaced';

export interface AppleMobileDeviceDetails {
  battery_health?: number;
  battery_cycle_count?: number;
  icloud_lock_status?: AppleICloudStatus;
  carrier_lock?: AppleCarrierLock;
  biometric_status?: AppleBiometricStatus;
  storage?: '64GB' | '128GB' | '256GB' | '512GB' | '1TB';
  color?: string;
  /**
   * iOS Settings → Battery / Parts history: “Unable to verify genuine Apple battery” / Unknown Part (battery).
   * Common from XR/XS onward when battery was replaced without Apple pairing. Multiple flags can be true.
   * @see https://support.apple.com/HT210323
   */
  important_battery_message?: boolean;
  /**
   * iOS Important Display Message / Unknown Part (display) after non-genuine or unpaired screen work.
   * @see https://support.apple.com/103256
   */
  important_display_message?: boolean;
  /**
   * Derived on save: `true` when `battery_health` is set and under 80%. Kept on the record for sync/search;
   * legacy rows may still have this flag alone.
   */
  serviced_battery_third_party?: boolean;
  /** Trade / MDM: IBM-style (bypass) profile — often stocked alongside battery unknown-part disclosures. */
  mdm_ibm?: boolean;
  /** Trade / MDM: IDM (iCloud disabled – MDM) — often associated with display/part warnings in listings. */
  mdm_idm?: boolean;
  /** Trade / MDM: ICM (iCloud managed / enterprise). */
  mdm_icm?: boolean;
}

export interface AppleLaptopDeviceDetails {
  battery_health?: number;
  battery_cycle_count?: number;
  storage?: '256GB' | '512GB' | '1TB' | '2TB';
  ram?: '8GB' | '16GB' | '18GB' | '24GB' | '32GB' | '36GB' | '64GB';
  chip?: string;
  screen_size?: '13"' | '14"' | '15"' | '16"';
  keyboard_status?: MacKeyboardStatus;
  screen_condition?: MacScreenCondition;
  color?: string;
}

export type DeviceDetails = AppleMobileDeviceDetails | AppleLaptopDeviceDetails | Record<string, never>;

export const SERIALIZED_CATEGORIES: Category[] = ['phones', 'laptops', 'tablets'];

export function getCategoryMode(category: Category): ItemMode {
  return SERIALIZED_CATEGORIES.includes(category) ? 'serialized' : 'non_serialized';
}

export function isAppleMobileDevice(brand: string, category: Category): boolean {
  return brand.trim().toLowerCase() === 'apple' && (category === 'phones' || category === 'tablets');
}

export function isAppleLaptopDevice(brand: string, category: Category): boolean {
  return brand.trim().toLowerCase() === 'apple' && category === 'laptops';
}

export function isAppleDevice(brand: string, category: Category): boolean {
  return isAppleMobileDevice(brand, category) || isAppleLaptopDevice(brand, category);
}

/** Serviced / low-health battery disclosure for iPhone & iPad: health under 80%, or legacy stored flag. */
export function appleMobileShowsServicedBattery(d: AppleMobileDeviceDetails): boolean {
  const h = d.battery_health;
  if (typeof h === 'number' && h < 80) return true;
  return d.serviced_battery_third_party === true;
}

const APPLE_MOBILE_SEARCH_FLAG_LABELS: Record<string, string> = {
  important_battery_message: 'important battery message unknown battery',
  important_display_message: 'important display message unknown display',
  serviced_battery_third_party: 'serviced battery third party battery',
  mdm_ibm: 'ibm mdm bypass',
  mdm_idm: 'idm mdm',
  mdm_icm: 'icm managed',
};

export function getDeviceDetailsSearchText(details?: DeviceDetails): string {
  if (!details) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === true && key in APPLE_MOBILE_SEARCH_FLAG_LABELS) {
      parts.push(APPLE_MOBILE_SEARCH_FLAG_LABELS[key]);
      continue;
    }
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      if (typeof value === 'string' || typeof value === 'number') {
        parts.push(String(value));
      }
    }
  }
  const mobileHint =
    typeof details === 'object' &&
    details !== null &&
    ('icloud_lock_status' in details || 'carrier_lock' in details);
  if (mobileHint) {
    const svcLabel = APPLE_MOBILE_SEARCH_FLAG_LABELS.serviced_battery_third_party;
    if (appleMobileShowsServicedBattery(details as AppleMobileDeviceDetails) && !parts.includes(svcLabel)) {
      parts.push(svcLabel);
    }
  }
  return parts.join(' ').toLowerCase();
}

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'pos';

export type ReturnReason = 'defective' | 'changed_mind' | 'wrong_item' | 'other';
export type ReturnType = 'refund' | 'exchange';

// ─── Core Models ─────────────────────────────────────────────────────────────

/** Branch / counter under a shop (`business_id` = `business_profiles.id` = owner `user_id`). */
export interface ShopLocation {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  /** Set after multi-branch migration / sync; treat missing as “needs backfill”. */
  location_id?: string;
  name: string;
  category: Category;
  brand: string;
  price: number;             // selling price in NGN
  cost_price?: number;       // optional purchase cost
  mode: ItemMode;            // derived from category on creation, stored explicitly

  // Serialized items (phones/laptops/tablets): each unit is a separate record
  status?: SerializedItemStatus; // only set for serialized items

  /** Set when closing stock flagged device as missing; cleared when resolved */
  missing_resolution?: MissingResolution;
  missing_resolution_note?: string;
  missing_resolved_at?: string;

  // Non-serialized items (accessories/parts): single record with quantity
  quantity: number;          // for non-serialized: stock count; for serialized: always 1
  low_stock_threshold: number; // only meaningful for non-serialized

  serial_number?: string;
  imei?: string;
  imei2?: string;
  condition?: DeviceCondition;
  deviceDetails?: DeviceDetails;
  barcode?: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted?: boolean;
}

export interface StockMovement {
  id: string;
  item_id: string;
  user_id: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  note?: string;
  created_at: string;
}

export interface SalesRecord {
  id: string;
  user_id: string;
  location_id?: string;
  item_id: string;
  sale_type: SaleType;
  item_name: string;
  item_category: Category;
  item_brand: string;
  item_mode: ItemMode;
  serial_number?: string;
  imei?: string;
  device_details?: DeviceDetails;
  sale_price: number;
  cost_price: number;
  profit: number;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  amount_paid?: number;
  balance_owed?: number;
  due_date?: string;
  customer_name?: string;
  customer_phone?: string;
  quantity_sold: number;
  sold_at: string;
  receipt_number: string;
  swap_record_id?: string;
  trade_in_item_name?: string;
  trade_in_item_brand?: string;
  trade_in_value?: number;
  balance_paid?: number;
  /** @deprecated Legacy month-only field; prefer warranty_cover */
  warranty_months?: number;
  /** Shop warranty / return window for this sale */
  warranty_cover?: WarrantyDuration;
  item_stock_condition?: WarrantyStockCondition;
  // Return tracking
  returned?: boolean;
  return_id?: string;
  sync_status: SyncStatus;
}

export interface ReturnRecord {
  id: string;
  sale_id: string;
  item_id: string;
  user_id: string;
  location_id?: string;
  reason: ReturnReason;
  return_type: ReturnType;
  notes?: string;
  returned_at: string;
  refund_amount: number;
  // Exchange only
  exchange_item_id?: string;
  exchange_item_name?: string;
  exchange_sale_id?: string;
  sync_status: SyncStatus;
}

export interface SwapRecord {
  id: string;
  outgoing_item_id: string;
  incoming_item_id: string;
  user_id: string;
  location_id?: string;
  sale_id: string;
  sale_price: number;
  trade_in_value: number;
  balance_paid: number;
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  date: string;
  sync_status: SyncStatus;
}

export interface CreditPayment {
  amount: number;
  date: string;
  method?: PaymentMethod;
}

export interface CreditRecord {
  id: string;
  sale_id: string;
  user_id: string;
  location_id?: string;
  customer_name: string;
  customer_phone: string;
  item_name: string;
  total_amount: number;
  amount_paid: number;
  balance_owed: number;
  due_date: string;
  status: CreditStatus;
  payments: CreditPayment[];
  notes?: string;
  sync_status: SyncStatus;
}

export interface RepairRecord {
  id: string;
  item_id: string;
  user_id: string;
  location_id?: string;
  engineer_name: string;
  engineer_phone?: string;
  issue_description: string;
  repair_cost?: number;
  date_sent: string;
  expected_return_date?: string;
  date_returned?: string;
  repair_status: RepairStatus;
  notes?: string;
  sync_status: SyncStatus;
}

export type SalesRecordInput = Omit<
  SalesRecord,
  'id' | 'user_id' | 'sync_status' | 'receipt_number' | 'returned' | 'return_id' | 'sale_type'
> & {
  sale_type?: SaleType;
};

export type ReturnRecordInput = Omit<ReturnRecord, 'id' | 'user_id' | 'sync_status'>;
export type SwapRecordInput = Omit<SwapRecord, 'id' | 'user_id' | 'sync_status' | 'sale_id'>;
export type CreditRecordInput = Omit<CreditRecord, 'id' | 'user_id' | 'sync_status' | 'status' | 'balance_owed'>;
export type RepairRecordInput = Omit<RepairRecord, 'id' | 'user_id' | 'sync_status' | 'repair_status' | 'date_returned'>;

// ─── Business / billing ───────────────────────────────────────────────────────

export type BusinessPlan = 'trial' | 'starter' | 'pro' | 'business';
export type BusinessPlanStatus = 'active' | 'expired' | 'cancelled';

/** One row per shop (id = Supabase auth user id). Synced to Supabase `business_profiles`. */
export interface BusinessProfile {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  email?: string;
  address: string;
  logo_path?: string;
  trial_start_date: string;
  trial_end_date: string;
  plan: BusinessPlan;
  plan_status: BusinessPlanStatus;
  subscription_id?: string;
  onboarding_complete: boolean;
  updated_at: string;
  /** Signup / first-complete time from server */
  created_at?: string;
  /** When true, retailer sign-in should be blocked (enforced server-side + after sync). */
  account_disabled?: boolean;
  sync_status: SyncStatus;
}

// ─── Opening / closing stock (Business plan) ─────────────────────────────────

export type StockSessionStatus = 'open' | 'closed' | 'closed_with_discrepancy';

export type StockSessionAuditAction =
  | 'opened'
  | 'closed'
  | 'skipped_abandoned'
  | 'missing_item_noted'
  | 'missing_resolved';

export interface StockSessionAuditEntry {
  at: string;
  user_id: string;
  action: StockSessionAuditAction;
  detail?: string;
}

export interface StockSessionSummary {
  opening_count: number;
  sold_count: number;
  credit_sales_count: number;
  sent_engineer_count: number;
  returns_received_count: number;
  new_stock_count: number;
  expected_remaining: number;
}

/** Daily stock accountability session (local-first; optional remote sync later). */
export interface StockSession {
  id: string;
  /** Shop owner user id (= business id in app) */
  user_id: string;
  /** Branch this session belongs to */
  location_id?: string;
  /** Local calendar date YYYY-MM-DD when the session was opened */
  date: string;
  opened_at: string;
  closed_at?: string;
  opened_by_user_id: string;
  closed_by_user_id?: string;
  /** Serialized item ids that were in_stock at open */
  opening_snapshot_ids: string[];
  /** Ids we expect on hand at close (computed before/during reconcile) */
  expected_closing_ids: string[];
  /** Ids physically confirmed present */
  actual_closing_ids: string[];
  missing_item_ids: string[];
  /** Required note per missing item before close when discrepancy */
  missing_notes_by_item_id: Record<string, string>;
  status: StockSessionStatus;
  notes?: string;
  summary?: StockSessionSummary;
  audit_log: StockSessionAuditEntry[];
  sync_status: SyncStatus;
}

// ─── Contacts, expenses, purchasing (local-first) ───────────────────────────

export type ContactType = 'supplier' | 'customer';

/** Supplier or customer contact (local Dexie; not synced to Supabase yet). */
export interface ContactRecord {
  id: string;
  user_id: string;
  location_id?: string;
  type: ContactType;
  name: string;
  phone?: string;
  note?: string;
  location_text?: string;
  /** Supplier: amount still owed to them (positive). Customer: outstanding credit (positive). */
  balance_owed: number;
  deal_count: number;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | 'generator'
  | 'nepa'
  | 'transport'
  | 'feeding'
  | 'rent'
  | 'supplies'
  | 'other';

export interface ExpenseRecord {
  id: string;
  user_id: string;
  location_id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  payment_method: PaymentMethod;
  recorded_at: string;
  created_at: string;
}

/** End-of-day cash drawer count for a branch. */
export interface CashSessionRecord {
  id: string;
  user_id: string;
  location_id: string;
  opening_float: number;
  cash_sales: number;
  cash_collected: number;
  cash_expenses: number;
  expected: number;
  counted: number;
  variance: number;
  closed_at: string;
  closed_by_label?: string;
}

export interface PurchaseLine {
  name: string;
  qty: number;
  unit_cost: number;
}

export type PurchaseTerms = 'paid' | 'credit' | 'partial';

export interface PurchaseRecord {
  id: string;
  user_id: string;
  location_id: string;
  supplier_contact_id?: string;
  supplier_name: string;
  items: PurchaseLine[];
  total: number;
  paid: number;
  payment_method?: PaymentMethod;
  terms: PurchaseTerms;
  purchased_at: string;
  created_at: string;
}

export type ContactRecordInput = Omit<ContactRecord, 'id' | 'user_id' | 'deal_count' | 'created_at' | 'updated_at'>;
export type ExpenseRecordInput = Omit<ExpenseRecord, 'id' | 'user_id' | 'created_at'>;
export type CashSessionInput = Omit<
  CashSessionRecord,
  'id' | 'user_id' | 'location_id' | 'closed_at' | 'closed_by_label'
> & {
  closed_by_label?: string;
};
export type PurchaseRecordInput = Omit<PurchaseRecord, 'id' | 'user_id' | 'created_at'>;

// ─── Shop Profile ─────────────────────────────────────────────────────────────

export interface ReceiptTheme {
  header_color: string;
  accent_color: string;
  text_color: string;
  paper_color: string;
}

/** Stock intake label — stored at the start of item `description`. */
export type WarrantyStockCondition = 'new' | 'used' | 'uk_used' | 'refurb';

export type WarrantyDurationUnit = 'days' | 'months';

export type WarrantyDuration = {
  value: number;
  unit: WarrantyDurationUnit;
};

/** Warranty / return cover per category and stock condition. */
export type WarrantyPolicy = Record<Category, Record<WarrantyStockCondition, WarrantyDuration>>;

export interface ShopProfile {
  shop_name: string;
  address: string;
  phone: string;
  logo_data_url?: string;
  logo_path?: string;
  receipt_theme?: ReceiptTheme;
  warranty_policy?: WarrantyPolicy;
}

export interface AppSetting<T = string> {
  key: string;
  value: T;
}

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
  shop_name?: string;
  avatar_url?: string;
  created_at: string;
}

// ─── Form / Input types ───────────────────────────────────────────────────────

// mode and status are auto-derived in useInventoryActions.addItem
export type InventoryItemInput = Omit<
  InventoryItem,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'sync_status' | 'deleted' | 'mode' | 'status'
>;

// ─── Dashboard / Summary types ────────────────────────────────────────────────

export interface StockSummary {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  by_category: Record<Category, { count: number; value: number }>;
}

export interface SalesSummary {
  count: number;
  revenue: number;
  profit: number;
}

export interface ReturnsSummary {
  count: number;
  refund_value: number;
}

export interface CreditsSummary {
  outstanding_amount: number;
  overdue_count: number;
}

export interface RepairsSummary {
  active_count: number;
  overdue_count: number;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type ShopRole = 'owner' | 'manager' | 'staff';

export interface AuditEvent {
  id: string;
  business_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  sync_status?: SyncStatus;
}

export interface SyncQueueItem {
  id: string;
  table:
    | 'inventory_items'
    | 'stock_movements'
    | 'sales_records'
    | 'return_records'
    | 'swap_records'
    | 'credit_records'
    | 'repair_records'
    | 'business_profiles'
    | 'shop_locations';
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
}

// ─── Filter / Search ─────────────────────────────────────────────────────────

export interface InventoryFilters {
  search: string;
  category: Category | 'all';
  lowStockOnly: boolean;
  showSold: boolean;
  sortBy: 'name' | 'price' | 'quantity' | 'updated_at';
  sortDir: 'asc' | 'desc';
}
