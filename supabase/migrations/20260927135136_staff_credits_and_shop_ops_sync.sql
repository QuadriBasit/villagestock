-- Staff can collect customer credit. Shop-ops tables (contacts, expenses,
-- purchases, cash-up, stock-take) sync like sales.

create or replace function public.shop_default_staff_permissions_v2 ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'access_till', true,
    'access_sales', true,
    'record_sales', true,
    'record_swaps', true,
    'process_returns', true,
    'edit_sales', false,
    'edit_swaps', false,
    'view_inventory', true,
    'add_items', true,
    'edit_items', true,
    'delete_items', false,
    'transfer_stock', true,
    'view_profit', false,
    'access_cashup', false,
    'access_purchasing', false,
    'manage_credits', true,
    'access_stock_take', false,
    'manage_stock_sessions', false,
    'access_repairs', true,
    'access_contacts', true,
    'access_analytics', false,
    'access_reports', false,
    'access_audit_log', false,
    'access_alerts', true,
    'access_price_list', true,
    'access_settings', true,
    'manage_shop_settings', false,
    'manage_team', false,
    'manage_roles', false
  );
$$;

update public.shop_roles
set permissions = jsonb_set(coalesce(permissions, '{}'::jsonb), '{manage_credits}', 'true'::jsonb, true)
where slug = 'staff';

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  type text not null check (type in ('supplier', 'customer')),
  name text not null,
  phone text,
  note text,
  location_text text,
  balance_owed numeric not null default 0,
  deal_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  category text not null,
  label text not null,
  amount numeric not null check (amount >= 0),
  payment_method public.payment_method,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  category text not null,
  label text not null,
  amount numeric not null check (amount >= 0),
  payment_method public.payment_method,
  recurrence text not null check (recurrence in ('daily', 'weekly', 'monthly', 'yearly')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  supplier_contact_id uuid references public.contacts (id),
  supplier_name text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null check (total >= 0),
  paid numeric not null default 0 check (paid >= 0),
  payment_method public.payment_method,
  terms text not null check (terms in ('paid', 'credit', 'partial')),
  purchased_at timestamptz not null default now(),
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  opening_float numeric not null default 0,
  cash_sales numeric not null default 0,
  cash_collected numeric not null default 0,
  cash_expenses numeric not null default 0,
  expected numeric not null default 0,
  counted numeric not null default 0,
  variance numeric not null default 0,
  closed_at timestamptz not null default now(),
  closed_by_label text
);

create table if not exists public.stock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  location_id uuid not null references public.shop_locations (id),
  date text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by_user_id uuid not null references auth.users (id),
  closed_by_user_id uuid references auth.users (id),
  opening_snapshot_ids jsonb not null default '[]'::jsonb,
  opening_device_snapshots jsonb,
  opening_confirmed_ids jsonb,
  expected_closing_ids jsonb not null default '[]'::jsonb,
  expected_closing_snapshots jsonb,
  actual_closing_ids jsonb not null default '[]'::jsonb,
  closing_device_snapshots jsonb,
  missing_item_ids jsonb not null default '[]'::jsonb,
  missing_notes_by_item_id jsonb not null default '{}'::jsonb,
  status text not null check (status in ('open', 'closed', 'closed_with_discrepancy')),
  notes text,
  summary jsonb,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists contacts_user_id_idx on public.contacts (user_id);
create index if not exists contacts_location_id_idx on public.contacts (location_id);
create index if not exists expense_records_user_id_idx on public.expense_records (user_id, recorded_at desc);
create index if not exists expense_records_location_id_idx on public.expense_records (location_id);
create index if not exists recurring_expenses_user_id_idx on public.recurring_expenses (user_id);
create index if not exists purchase_records_user_id_idx on public.purchase_records (user_id, purchased_at desc);
create index if not exists purchase_records_supplier_idx on public.purchase_records (supplier_contact_id);
create index if not exists cash_sessions_user_id_idx on public.cash_sessions (user_id, closed_at desc);
create index if not exists stock_sessions_user_id_idx on public.stock_sessions (user_id, date desc);
create unique index if not exists stock_sessions_one_open_per_branch
  on public.stock_sessions (user_id, location_id)
  where status = 'open';

alter table public.contacts enable row level security;
alter table public.expense_records enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.purchase_records enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.stock_sessions enable row level security;

create policy "Shop access contacts" on public.contacts for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

create policy "Shop access expense_records" on public.expense_records for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

create policy "Shop access recurring_expenses" on public.recurring_expenses for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

create policy "Shop access purchase_records" on public.purchase_records for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

create policy "Shop access cash_sessions" on public.cash_sessions for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

create policy "Shop access stock_sessions" on public.stock_sessions for all
  using (
    (select auth.uid()) = user_id
    or (
      shop_has_member(user_id, (select auth.uid()))
      and shop_member_can_access_location(user_id, location_id)
    )
  );

grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.expense_records to authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.purchase_records to authenticated;
grant select, insert, update, delete on public.cash_sessions to authenticated;
grant select, insert, update, delete on public.stock_sessions to authenticated;
