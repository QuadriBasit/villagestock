-- ═══════════════════════════════════════════════════════════════════════════
-- VillageStock — FRESH START (run everything in one go)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Includes: core retail schema, admin RPC/RLS, shop team (business_members),
-- audit_events, and shared-access RLS (owner / manager / staff).
--
-- When to use
--   • New Supabase project, OR you want a clean slate on an existing project.
--
-- Completely empty database (recommended for “start afresh”)
--   1. Supabase Dashboard → Project Settings → Database → Reset database
--      (or create a brand-new project)
--   2. SQL Editor → paste THIS ENTIRE FILE → Run
--
-- After it succeeds
--   • Authentication → enable Email (retail admin login) and Phone (shops)
--   • Create an email/password user for the admin console, then:
--       insert into public.admin_users (user_id, role)
--       values ('<that-user-uuid>', 'super_admin');
--
-- Safe to re-run on the same project: enums use duplicate_object guards;
-- policies and triggers use DROP IF EXISTS first.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Enum types (idempotent — safe if types already exist) ────────────────────

do $$ begin
  create type item_category as enum ('phones', 'laptops', 'tablets', 'accessories', 'parts');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_mode as enum ('serialized', 'non_serialized');
exception when duplicate_object then null; end $$;

do $$ begin
  create type serialized_item_status as enum ('in_stock', 'sold', 'reserved', 'returned', 'defective', 'with_engineer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_condition as enum ('working', 'minor_faults', 'major_faults', 'not_working');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum ('in', 'out', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'bank_transfer', 'pos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('paid', 'credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type return_reason as enum ('defective', 'changed_mind', 'wrong_item', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type return_type as enum ('refund', 'exchange');
exception when duplicate_object then null; end $$;

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  shop_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

drop policy if exists "Users can view their own profile" on profiles;
create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Inventory Items ──────────────────────────────────────────────────────────

create table if not exists inventory_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category item_category not null,
  brand text not null,
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2),

  -- Mode determines how stock is tracked
  mode item_mode not null,

  -- Serialized items (phones/laptops/tablets): one record per unit
  status serialized_item_status,   -- null for non-serialized

  -- Non-serialized items (accessories/parts): quantity-based
  quantity integer not null default 1 check (quantity >= 0),
  low_stock_threshold integer not null default 5,

  serial_number text,
  imei text,
  imei2 text,
  condition device_condition,
  device_details jsonb,
  barcode text,
  description text,
  image_url text,
  deleted boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists inventory_items_user_id_idx on inventory_items(user_id);
create index if not exists inventory_items_category_idx on inventory_items(user_id, category);
create index if not exists inventory_items_mode_idx on inventory_items(user_id, mode);
create index if not exists inventory_items_status_idx on inventory_items(user_id, status);
create index if not exists inventory_items_updated_idx on inventory_items(user_id, updated_at desc);

alter table inventory_items enable row level security;

drop policy if exists "Users manage their own inventory" on inventory_items;
create policy "Users manage their own inventory"
  on inventory_items for all using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_updated_at on inventory_items;
create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();

-- ─── Stock Movements ──────────────────────────────────────────────────────────

create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type movement_type not null,
  quantity integer not null check (quantity > 0),
  note text,
  created_at timestamptz default now() not null
);

create index if not exists stock_movements_item_idx on stock_movements(item_id);
create index if not exists stock_movements_user_idx on stock_movements(user_id, created_at desc);

alter table stock_movements enable row level security;

drop policy if exists "Users manage their own stock movements" on stock_movements;
create policy "Users manage their own stock movements"
  on stock_movements for all using (auth.uid() = user_id);

-- ─── Sales Records ────────────────────────────────────────────────────────────

create table if not exists sales_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  sale_type text not null default 'sale',

  -- Snapshot of item at time of sale
  item_name text not null,
  item_category text not null,
  item_brand text not null,
  item_mode text not null default 'non_serialized',
  serial_number text,
  imei text,
  device_details jsonb,

  -- Financials
  sale_price numeric(12,2) not null check (sale_price >= 0),
  cost_price numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  quantity_sold integer not null default 1 check (quantity_sold > 0),

  -- Sale details
  payment_method payment_method,
  payment_status payment_status not null default 'paid',
  amount_paid numeric(12,2),
  balance_owed numeric(12,2),
  due_date timestamptz,
  customer_name text,
  customer_phone text,
  sold_at timestamptz default now() not null,
  receipt_number text not null default '',
  swap_record_id uuid,
  trade_in_item_name text,
  trade_in_item_brand text,
  trade_in_value numeric(12,2),
  balance_paid numeric(12,2),

  -- Return tracking
  returned boolean not null default false,
  return_id uuid
);

create index if not exists sales_records_user_idx on sales_records(user_id, sold_at desc);
create index if not exists sales_records_item_idx on sales_records(item_id);

alter table sales_records enable row level security;

drop policy if exists "Users manage their own sales" on sales_records;
create policy "Users manage their own sales"
  on sales_records for all using (auth.uid() = user_id);

-- ─── Swap Records ─────────────────────────────────────────────────────────────
create table if not exists swap_records (
  id uuid primary key default uuid_generate_v4(),
  outgoing_item_id uuid not null references inventory_items(id) on delete cascade,
  incoming_item_id uuid not null references inventory_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references sales_records(id) on delete cascade,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  trade_in_value numeric(12,2) not null check (trade_in_value >= 0),
  balance_paid numeric(12,2) not null,
  payment_method payment_method,
  customer_name text,
  customer_phone text,
  date timestamptz default now() not null,
  sync_status text not null default 'synced'
);

create index if not exists swap_records_user_idx on swap_records(user_id, date desc);
create index if not exists swap_records_sale_idx on swap_records(sale_id);

alter table swap_records enable row level security;

drop policy if exists "Users manage their own swaps" on swap_records;
create policy "Users manage their own swaps"
  on swap_records for all using (auth.uid() = user_id);

-- ─── Credit Records ───────────────────────────────────────────────────────────
create table if not exists credit_records (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  item_name text not null,
  total_amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  balance_owed numeric(12,2) not null,
  due_date timestamptz not null,
  status text not null,
  payments jsonb not null default '[]'::jsonb,
  notes text,
  sync_status text not null default 'synced'
);

create index if not exists credit_records_user_idx on credit_records(user_id, due_date asc);
alter table credit_records enable row level security;
drop policy if exists "Users manage their own credits" on credit_records;
create policy "Users manage their own credits"
  on credit_records for all using (auth.uid() = user_id);

-- ─── Repair Records ───────────────────────────────────────────────────────────
create table if not exists repair_records (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  engineer_name text not null,
  engineer_phone text,
  issue_description text not null,
  repair_cost numeric(12,2),
  date_sent timestamptz not null default now(),
  expected_return_date timestamptz,
  date_returned timestamptz,
  repair_status text not null,
  notes text,
  sync_status text not null default 'synced'
);

create index if not exists repair_records_user_idx on repair_records(user_id, date_sent desc);
create index if not exists repair_records_engineer_idx on repair_records(user_id, engineer_name);
alter table repair_records enable row level security;
drop policy if exists "Users manage their own repairs" on repair_records;
create policy "Users manage their own repairs"
  on repair_records for all using (auth.uid() = user_id);

-- ─── Return Records ───────────────────────────────────────────────────────────

create table if not exists return_records (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales_records(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason return_reason not null,
  return_type return_type not null,
  notes text,
  returned_at timestamptz default now() not null,
  refund_amount numeric(12,2) not null default 0,
  exchange_item_id uuid references inventory_items(id) on delete set null,
  exchange_item_name text,
  exchange_sale_id uuid references sales_records(id) on delete set null,
  sync_status text not null default 'synced'
);

create index if not exists return_records_user_idx on return_records(user_id, returned_at desc);
create index if not exists return_records_sale_idx on return_records(sale_id);

alter table return_records enable row level security;

drop policy if exists "Users manage their own returns" on return_records;
create policy "Users manage their own returns"
  on return_records for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Business profiles (shops, trial, onboarding sync)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.business_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  shop_name text not null default '',
  owner_name text not null default '',
  phone text not null default '',
  email text,
  address text not null default '',
  trial_start_date timestamptz not null default '1970-01-01T00:00:00Z',
  trial_end_date timestamptz not null default '1970-01-01T00:00:00Z',
  plan text not null default 'trial',
  plan_status text not null default 'active',
  subscription_id text,
  onboarding_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  account_disabled boolean not null default false
);

alter table public.business_profiles enable row level security;

drop policy if exists "Users can read own business profile" on public.business_profiles;
create policy "Users can read own business profile"
  on public.business_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own business profile" on public.business_profiles;
create policy "Users can insert own business profile"
  on public.business_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own business profile" on public.business_profiles;
create policy "Users can update own business profile"
  on public.business_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Admin console: roster, Paystack placeholder, RPC, extra RLS
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own"
  on public.admin_users for select
  using (auth.uid() = user_id);

create or replace function public.is_admin_user ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin_user () from public;
grant execute on function public.is_admin_user () to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Shop members (owner / manager / staff), audit log, shared shop RLS
-- ═══════════════════════════════════════════════════════════════════════════
-- business_members.business_id = business_profiles.id = the shop owner’s
-- auth user id. Retail rows use user_id = that same id.

create table if not exists public.business_members (
  id uuid primary key default uuid_generate_v4 (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  display_name text,
  created_at timestamptz not null default now (),
  unique (business_id, member_user_id)
);

create index if not exists business_members_member_idx on public.business_members (member_user_id);
create index if not exists business_members_business_idx on public.business_members (business_id);

alter table public.business_members enable row level security;

drop policy if exists "business_members_select" on public.business_members;
create policy "business_members_select" on public.business_members for select using (
  member_user_id = (select auth.uid ())
  or business_id = (select auth.uid ())
  or exists (
    select 1
    from public.business_members m
    where m.business_id = business_members.business_id
      and m.member_user_id = (select auth.uid ())
      and m.role in ('owner', 'manager')
  )
  or public.is_admin_user ()
);

drop policy if exists "business_members_owner_insert" on public.business_members;
create policy "business_members_owner_insert" on public.business_members for insert with check (
  public.is_admin_user ()
  or exists (
    select 1
    from public.business_members m
    where m.business_id = business_members.business_id
      and m.member_user_id = (select auth.uid ())
      and m.role in ('owner', 'manager')
  )
);

drop policy if exists "business_members_owner_update" on public.business_members;
create policy "business_members_owner_update" on public.business_members for update using (
  business_id = (select auth.uid ())
  or public.is_admin_user ()
)
with check (
  business_id = (select auth.uid ())
  or public.is_admin_user ()
);

drop policy if exists "business_members_owner_delete" on public.business_members;
create policy "business_members_owner_delete" on public.business_members for delete using (
  business_id = (select auth.uid ())
  or public.is_admin_user ()
);

create or replace function public.seed_business_owner_member ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, member_user_id, role, display_name)
  values (new.id, new.id, 'owner', null)
  on conflict (business_id, member_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tr_seed_business_owner_member on public.business_profiles;
create trigger tr_seed_business_owner_member
  after insert on public.business_profiles
  for each row execute function public.seed_business_owner_member ();

insert into public.business_members (business_id, member_user_id, role, display_name)
select id, id, 'owner', owner_name
from public.business_profiles bp
where not exists (
  select 1
  from public.business_members bm
  where bm.business_id = bp.id
    and bm.member_user_id = bp.id
)
on conflict (business_id, member_user_id) do nothing;

-- True when p_member may access rows keyed by shop owner user id p_shop_user_id.
create or replace function public.shop_has_member (p_shop_user_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    p_shop_user_id is not null
    and p_member_id is not null
    and p_shop_user_id = p_member_id
  )
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_shop_user_id
      and bm.member_user_id = p_member_id
  );
$$;

revoke all on function public.shop_has_member (uuid, uuid) from public;
grant execute on function public.shop_has_member (uuid, uuid) to authenticated;

create table if not exists public.audit_events (
  id uuid primary key default uuid_generate_v4 (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now ()
);

create index if not exists audit_events_shop_time_idx on public.audit_events (business_id, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select" on public.audit_events;
create policy "audit_events_select" on public.audit_events for select using (
  public.shop_has_member (business_id, (select auth.uid ()))
  or public.is_admin_user ()
);

drop policy if exists "audit_events_insert" on public.audit_events;
create policy "audit_events_insert" on public.audit_events for insert with check (
  actor_user_id = (select auth.uid ())
  and public.shop_has_member (business_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own inventory" on public.inventory_items;
create policy "Shop access inventory" on public.inventory_items for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own stock movements" on public.stock_movements;
create policy "Shop access stock_movements" on public.stock_movements for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own sales" on public.sales_records;
create policy "Shop access sales" on public.sales_records for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own swaps" on public.swap_records;
create policy "Shop access swaps" on public.swap_records for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own credits" on public.credit_records;
create policy "Shop access credits" on public.credit_records for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own repairs" on public.repair_records;
create policy "Shop access repairs" on public.repair_records for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users manage their own returns" on public.return_records;
create policy "Shop access returns" on public.return_records for all using (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
)
with check (
  (select auth.uid ()) = user_id
  or public.shop_has_member (user_id, (select auth.uid ()))
);

drop policy if exists "Users can read own business profile" on public.business_profiles;
drop policy if exists "Shop can read business profile" on public.business_profiles;
create policy "Shop can read business profile" on public.business_profiles for select using (
  (select auth.uid ()) = id
  or public.shop_has_member (id, (select auth.uid ()))
  or public.is_admin_user ()
);

drop policy if exists "Users can insert own business profile" on public.business_profiles;
drop policy if exists "Users insert own business profile" on public.business_profiles;
create policy "Users insert own business profile" on public.business_profiles for insert with check (
  (select auth.uid ()) = id
);

drop policy if exists "Users can update own business profile" on public.business_profiles;
drop policy if exists "Shop owners and managers update profile" on public.business_profiles;
create policy "Shop owners and managers update profile" on public.business_profiles for update using (
  (select auth.uid ()) = id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_profiles.id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
  or public.is_admin_user ()
)
with check (
  (select auth.uid ()) = id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_profiles.id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
  or public.is_admin_user ()
);

create or replace function public.business_profiles_protect_admin_fields ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin_user() then
      new.account_disabled := old.account_disabled;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_business_profiles_admin_fields on public.business_profiles;
create trigger tr_business_profiles_admin_fields
  before update on public.business_profiles
  for each row execute function public.business_profiles_protect_admin_fields();

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null,
  amount_ngn numeric(14, 2) not null check (amount_ngn >= 0),
  provider text,
  provider_ref text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_user_idx on public.subscription_payments (user_id, created_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists "subscription_payments_own_select" on public.subscription_payments;
create policy "subscription_payments_own_select"
  on public.subscription_payments for select
  using (auth.uid() = user_id);

drop policy if exists "subscription_payments_admin_select" on public.subscription_payments;
create policy "subscription_payments_admin_select"
  on public.subscription_payments for select
  using (public.is_admin_user ());

drop policy if exists "Admins read all business profiles" on public.business_profiles;
create policy "Admins read all business profiles"
  on public.business_profiles for select
  using (public.is_admin_user ());

drop policy if exists "Admins update business profiles" on public.business_profiles;
create policy "Admins update business profiles"
  on public.business_profiles for update
  using (public.is_admin_user ())
  with check (public.is_admin_user ());

drop policy if exists "Admins read all inventory" on public.inventory_items;
create policy "Admins read all inventory"
  on public.inventory_items for select
  using (public.is_admin_user ());

drop policy if exists "Admins read all sales" on public.sales_records;
create policy "Admins read all sales"
  on public.sales_records for select
  using (public.is_admin_user ());

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles"
  on public.profiles for select
  using (public.is_admin_user ());

create or replace function public.admin_dashboard_snapshot ()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := (timezone('utc', now()))::date;
  v_week_start timestamptz := timezone('utc', now()) - interval '7 days';
  v_month_start timestamptz := date_trunc('month', timezone('utc', now()));
  v_chart_from timestamptz := timezone('utc', now()) - interval '30 days';
begin
  if not public.is_admin_user () then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', to_jsonb(v_now),
    'businesses', (
      select coalesce(
        jsonb_agg(r order by (r->>'created_at') desc nulls last),
        '[]'::jsonb
      )
      from (
        select jsonb_build_object(
          'id', bp.id,
          'shop_name', bp.shop_name,
          'owner_name', bp.owner_name,
          'phone', bp.phone,
          'email', bp.email,
          'address', bp.address,
          'plan', bp.plan,
          'plan_status', bp.plan_status,
          'onboarding_complete', bp.onboarding_complete,
          'trial_start_date', bp.trial_start_date,
          'trial_end_date', bp.trial_end_date,
          'created_at', bp.created_at,
          'account_disabled', bp.account_disabled,
          'updated_at', bp.updated_at,
          'inventory_count', (
            select count(*)::int
            from public.inventory_items i
            where i.user_id = bp.id and not coalesce(i.deleted, false)
          ),
          'sales_count', (
            select count(*)::int
            from public.sales_records s
            where s.user_id = bp.id
          )
        ) as r
        from public.business_profiles bp
      ) sub
    ),
    'totals', jsonb_build_object(
      'total_businesses', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
      ),
      'signups_today', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and (created_at at time zone 'utc')::date = v_today
      ),
      'signups_week', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and created_at >= v_week_start
      ),
      'signups_month', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and created_at >= v_month_start
      ),
      'trials_active', (
        select count(*)::int
        from public.business_profiles bp
        where bp.onboarding_complete
          and bp.plan = 'trial'
          and bp.plan_status = 'active'
          and bp.trial_end_date > v_now
      ),
      'trials_expired', (
        select count(*)::int
        from public.business_profiles bp
        where bp.onboarding_complete
          and bp.plan = 'trial'
          and (
            bp.trial_end_date <= v_now
            or bp.plan_status = 'expired'
          )
      ),
      'paid_starter', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and plan = 'starter'
          and plan_status = 'active'
      ),
      'paid_pro', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and plan = 'pro'
          and plan_status = 'active'
      ),
      'paid_business', (
        select count(*)::int
        from public.business_profiles
        where onboarding_complete
          and plan = 'business'
          and plan_status = 'active'
      ),
      'revenue_ngn', coalesce(
        (
          select sum(amount_ngn)
          from public.subscription_payments
          where status = 'completed'
        ),
        0
      )
    ),
    'signups_by_day', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('day', d, 'count', c)
          order by d asc
        ),
        '[]'::jsonb
      )
      from (
        select
          (created_at at time zone 'utc')::date as d,
          count(*)::int as c
        from public.business_profiles
        where onboarding_complete
          and created_at >= v_chart_from
        group by 1
      ) x
    )
  );
end;
$$;

revoke all on function public.admin_dashboard_snapshot () from public;
grant execute on function public.admin_dashboard_snapshot () to authenticated;
