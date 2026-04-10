-- Shop members (owner/manager/staff), audit log, and RLS so staff act on behalf
-- of the shop owner row (user_id).
--
-- If you bootstrap the DB with supabase/FRESH_START.sql, this migration is already
-- applied there — run this file only when upgrading an existing database that was
-- created from an older FRESH_START without this block.

create extension if not exists "uuid-ossp";

-- ─── business_members (before shop_has_member; FK uses business_profiles) ───

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

-- Seed owner row when a shop profile is created.
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

-- Depends on business_members.
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

-- ─── audit_events (append-only shop log) ───────────────────────────────────

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

-- ─── Replace shop data policies (owner OR shop member) ─────────────────────

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