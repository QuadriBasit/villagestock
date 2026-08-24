-- Custom shop roles with JSON permissions. Owner stays role='owner' with role_id null.

create table if not exists public.shop_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  slug text,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists shop_roles_business_name_idx
  on public.shop_roles (business_id, lower(trim(name)));

create unique index if not exists shop_roles_business_slug_idx
  on public.shop_roles (business_id, slug)
  where slug is not null;

create index if not exists shop_roles_business_idx on public.shop_roles (business_id, sort_order);

alter table public.shop_roles enable row level security;

alter table public.business_members
  add column if not exists role_id uuid references public.shop_roles (id) on delete restrict;

alter table public.staff_invites
  add column if not exists role_id uuid references public.shop_roles (id) on delete restrict;

-- Drop fixed role enums; legacy text column kept for owner + backfill.
alter table public.business_members drop constraint if exists business_members_role_check;
alter table public.staff_invites drop constraint if exists staff_invites_role_check;

create or replace function public.shop_default_staff_permissions ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'view_profit', false,
    'access_financial_nav', false,
    'manage_business_settings', false,
    'invite_team_members', false,
    'manage_roles', false,
    'edit_sales', false,
    'edit_swaps', false
  );
$$;

create or replace function public.shop_default_manager_permissions ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'view_profit', true,
    'access_financial_nav', true,
    'manage_business_settings', false,
    'invite_team_members', true,
    'manage_roles', false,
    'edit_sales', true,
    'edit_swaps', true
  );
$$;

create or replace function public.shop_owner_permissions ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'view_profit', true,
    'access_financial_nav', true,
    'manage_business_settings', true,
    'invite_team_members', true,
    'manage_roles', true,
    'edit_sales', true,
    'edit_swaps', true
  );
$$;

create or replace function public.ensure_default_shop_roles (p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_business_id is null then
    return;
  end if;

  insert into public.shop_roles (business_id, name, slug, description, permissions, is_system, sort_order)
  select
    p_business_id,
    'Staff',
    'staff',
    'Sales and stock — no profit or financial pages.',
    public.shop_default_staff_permissions(),
    true,
    10
  where not exists (
    select 1 from public.shop_roles sr
    where sr.business_id = p_business_id and sr.slug = 'staff'
  );

  insert into public.shop_roles (business_id, name, slug, description, permissions, is_system, sort_order)
  select
    p_business_id,
    'Manager',
    'manager',
    'Profit, reports, invites, and deal corrections.',
    public.shop_default_manager_permissions(),
    true,
    20
  where not exists (
    select 1 from public.shop_roles sr
    where sr.business_id = p_business_id and sr.slug = 'manager'
  );
end;
$$;

revoke all on function public.ensure_default_shop_roles (uuid) from public;
grant execute on function public.ensure_default_shop_roles (uuid) to authenticated;

-- Seed defaults for every existing shop.
do $$
declare
  v_business_id uuid;
begin
  for v_business_id in
    select id from public.business_profiles
    union
    select distinct business_id from public.business_members
  loop
    perform public.ensure_default_shop_roles(v_business_id);
  end loop;
end;
$$;

update public.business_members bm
set role_id = sr.id
from public.shop_roles sr
where sr.business_id = bm.business_id
  and sr.slug = bm.role
  and bm.role in ('staff', 'manager')
  and bm.role_id is null;

update public.staff_invites si
set role_id = sr.id
from public.shop_roles sr
where sr.business_id = si.business_id
  and sr.slug = si.role
  and si.role in ('staff', 'manager')
  and si.role_id is null
  and si.accepted_at is null;

create or replace function public.shop_member_is_owner (p_business_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_business_id is not null
    and p_member_id is not null
    and (
      p_business_id = p_member_id
      or exists (
        select 1
        from public.business_members bm
        where bm.business_id = p_business_id
          and bm.member_user_id = p_member_id
          and bm.role = 'owner'
      )
    );
$$;

revoke all on function public.shop_member_is_owner (uuid, uuid) from public;
grant execute on function public.shop_member_is_owner (uuid, uuid) to authenticated;

create or replace function public.shop_member_permissions (
  p_business_id uuid,
  p_member_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.shop_member_is_owner(p_business_id, p_member_id) then public.shop_owner_permissions()
    else coalesce(sr.permissions, public.shop_default_staff_permissions())
  end
  from public.business_members bm
  left join public.shop_roles sr on sr.id = bm.role_id
  where bm.business_id = p_business_id
    and bm.member_user_id = p_member_id
  limit 1;
$$;

revoke all on function public.shop_member_permissions (uuid, uuid) from public;
grant execute on function public.shop_member_permissions (uuid, uuid) to authenticated;

create or replace function public.shop_member_has_permission (
  p_business_id uuid,
  p_member_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (public.shop_member_permissions(p_business_id, p_member_id) ->> p_permission)::boolean,
    false
  );
$$;

revoke all on function public.shop_member_has_permission (uuid, uuid, text) from public;
grant execute on function public.shop_member_has_permission (uuid, uuid, text) to authenticated;

drop policy if exists "shop_roles_select" on public.shop_roles;
create policy "shop_roles_select" on public.shop_roles for select using (
  public.is_admin_user ()
  or public.shop_has_member (business_id, (select auth.uid ()))
);

drop policy if exists "shop_roles_manage" on public.shop_roles;
create policy "shop_roles_manage" on public.shop_roles for all using (
  public.is_admin_user ()
  or business_id = (select auth.uid ())
  or public.shop_member_has_permission (business_id, (select auth.uid ()), 'manage_roles')
)
with check (
  public.is_admin_user ()
  or business_id = (select auth.uid ())
  or public.shop_member_has_permission (business_id, (select auth.uid ()), 'manage_roles')
);

create or replace function public.accept_staff_invite (p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invites%rowtype;
  v_email text;
  v_role_id uuid;
  v_role text;
begin
  if auth.uid () is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = auth.uid ();

  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'Your account has no email; this invite link is for email sign-in.';
  end if;

  select * into inv
  from public.staff_invites
  where token = p_token
    and accepted_at is null and expires_at > now ()
  for update;

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  if lower(trim(inv.email)) != lower(trim(v_email)) then
    raise exception 'Sign in with the same email the invitation was sent to.';
  end if;

  v_role_id := inv.role_id;
  if v_role_id is null then
    select sr.id into v_role_id
    from public.shop_roles sr
    where sr.business_id = inv.business_id
      and sr.slug = inv.role
    limit 1;
  end if;

  select coalesce(sr.slug, inv.role, 'staff') into v_role
  from public.shop_roles sr
  where sr.id = v_role_id;

  if v_role is null then
    v_role := coalesce(inv.role, 'staff');
  end if;

  insert into public.business_members (business_id, member_user_id, role, role_id, display_name, allowed_location_ids)
  values (inv.business_id, auth.uid (), v_role, v_role_id, inv.display_name, inv.allowed_location_ids)
  on conflict (business_id, member_user_id) do update
    set role = excluded.role,
        role_id = excluded.role_id,
        display_name = excluded.display_name,
        allowed_location_ids = excluded.allowed_location_ids;

  update public.staff_invites
  set accepted_at = now ()
  where id = inv.id;
end;
$$;

create or replace function public.business_members_restrict_manager_updates ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if (select auth.uid ()) = old.business_id or public.is_admin_user () then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.role_id is distinct from old.role_id
    or new.member_user_id is distinct from old.member_user_id
    or new.business_id is distinct from old.business_id then
    raise exception 'Only the shop owner can change role or membership';
  end if;

  return new;
end;
$$;

create or replace function public.shop_roles_prevent_delete_when_in_use ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.business_members bm where bm.role_id = old.id
  ) or exists (
    select 1 from public.staff_invites si
    where si.role_id = old.id and si.accepted_at is null
  ) then
    raise exception 'Cannot delete a role that is assigned to team members or pending invites';
  end if;
  return old;
end;
$$;

drop trigger if exists tr_shop_roles_prevent_delete_when_in_use on public.shop_roles;
create trigger tr_shop_roles_prevent_delete_when_in_use
  before delete on public.shop_roles
  for each row execute function public.shop_roles_prevent_delete_when_in_use ();
