-- Multi-branch: one row per physical counter / location under a shop (business_profiles.id).

create table if not exists public.shop_locations (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists shop_locations_business_idx on public.shop_locations (business_id);

drop trigger if exists shop_locations_updated_at on public.shop_locations;
create trigger shop_locations_updated_at
  before update on public.shop_locations
  for each row execute function public.set_updated_at ();

alter table public.shop_locations enable row level security;

drop policy if exists "shop_locations_select" on public.shop_locations;
create policy "shop_locations_select" on public.shop_locations for select using (
  (select auth.uid ()) = business_id
  or public.shop_has_member (business_id, (select auth.uid ()))
  or public.is_admin_user ()
);

drop policy if exists "shop_locations_insert" on public.shop_locations;
create policy "shop_locations_insert" on public.shop_locations for insert with check (
  (select auth.uid ()) = business_id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = shop_locations.business_id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "shop_locations_update" on public.shop_locations;
create policy "shop_locations_update" on public.shop_locations for update using (
  (select auth.uid ()) = business_id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = shop_locations.business_id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
)
with check (
  (select auth.uid ()) = business_id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = shop_locations.business_id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "shop_locations_delete" on public.shop_locations;
create policy "shop_locations_delete" on public.shop_locations for delete using (
  (select auth.uid ()) = business_id
  or exists (
    select 1
    from public.business_members bm
    where bm.business_id = shop_locations.business_id
      and bm.member_user_id = (select auth.uid ())
      and bm.role in ('owner', 'manager')
  )
);

-- ─── Add location_id to retail tables (nullable → backfill → not null) ───

alter table public.inventory_items add column if not exists location_id uuid references public.shop_locations (id);

alter table public.sales_records add column if not exists location_id uuid references public.shop_locations (id);

alter table public.return_records add column if not exists location_id uuid references public.shop_locations (id);

alter table public.swap_records add column if not exists location_id uuid references public.shop_locations (id);

alter table public.credit_records add column if not exists location_id uuid references public.shop_locations (id);

alter table public.repair_records add column if not exists location_id uuid references public.shop_locations (id);

-- Default "Main branch" for every shop that has none
insert into public.shop_locations (business_id, name, sort_order)
select bp.id, 'Main branch', 0
from public.business_profiles bp
where not exists (
  select 1 from public.shop_locations sl where sl.business_id = bp.id
);

update public.inventory_items i
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = i.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where i.location_id is null;

update public.sales_records s
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = s.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where s.location_id is null;

update public.return_records r
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = r.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where r.location_id is null;

update public.swap_records w
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = w.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where w.location_id is null;

update public.credit_records c
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = c.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where c.location_id is null;

update public.repair_records p
set location_id = (
  select sl.id
  from public.shop_locations sl
  where sl.business_id = p.user_id
  order by sl.sort_order, sl.created_at
  limit 1
)
where p.location_id is null;

alter table public.inventory_items alter column location_id set not null;
alter table public.sales_records alter column location_id set not null;
alter table public.return_records alter column location_id set not null;
alter table public.swap_records alter column location_id set not null;
alter table public.credit_records alter column location_id set not null;
alter table public.repair_records alter column location_id set not null;

create index if not exists inventory_items_location_idx on public.inventory_items (user_id, location_id);
create index if not exists sales_records_location_idx on public.sales_records (user_id, location_id);

-- New shops: one default branch when business_profiles row is created
create or replace function public.create_default_shop_location_for_new_business ()
returns trigger
language plpgsql
as $$
begin
  insert into public.shop_locations (business_id, name, sort_order)
  values (new.id, 'Main branch', 0);
  return new;
end;
$$;

drop trigger if exists tr_business_profiles_default_shop_location on public.business_profiles;
create trigger tr_business_profiles_default_shop_location
  after insert on public.business_profiles
  for each row execute function public.create_default_shop_location_for_new_business ();
