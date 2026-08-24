-- Expand shop role permissions to the v2 key set and accept legacy aliases server-side.

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
    'manage_credits', false,
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

create or replace function public.shop_default_manager_permissions_v2 ()
returns jsonb
language sql
immutable
as $$
  select public.shop_default_staff_permissions_v2()
    || jsonb_build_object(
      'delete_items', true,
      'view_profit', true,
      'access_cashup', true,
      'access_purchasing', true,
      'manage_credits', true,
      'access_stock_take', true,
      'manage_stock_sessions', true,
      'access_analytics', true,
      'access_reports', true,
      'access_audit_log', true,
      'manage_shop_settings', true,
      'manage_team', true,
      'edit_sales', true,
      'edit_swaps', true
    );
$$;

create or replace function public.shop_owner_permissions_v2 ()
returns jsonb
language sql
immutable
as $$
  select public.shop_default_manager_permissions_v2()
    || jsonb_build_object('manage_roles', true);
$$;

create or replace function public.shop_member_has_permission (
  p_business_id uuid,
  p_member_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  perms jsonb;
  direct boolean;
begin
  if public.shop_member_is_owner(p_business_id, p_member_id) then
    return true;
  end if;

  perms := public.shop_member_permissions(p_business_id, p_member_id);

  direct := coalesce((perms ->> p_permission)::boolean, false);
  if direct then
    return true;
  end if;

  -- Legacy aliases from the first custom-roles rollout.
  if p_permission = 'manage_team' then
    return coalesce((perms ->> 'invite_team_members')::boolean, false);
  end if;
  if p_permission = 'manage_shop_settings' then
    return coalesce((perms ->> 'manage_business_settings')::boolean, false);
  end if;
  if p_permission in ('access_cashup', 'access_purchasing', 'manage_credits', 'access_analytics', 'access_reports', 'access_audit_log') then
    return coalesce((perms ->> 'access_financial_nav')::boolean, false);
  end if;

  return false;
end;
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
    public.shop_default_staff_permissions_v2(),
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
    public.shop_default_manager_permissions_v2(),
    true,
    20
  where not exists (
    select 1 from public.shop_roles sr
    where sr.business_id = p_business_id and sr.slug = 'manager'
  );
end;
$$;

-- Refresh built-in role templates; leave custom roles untouched.
update public.shop_roles
set permissions = public.shop_default_staff_permissions_v2()
where slug = 'staff';

update public.shop_roles
set permissions = public.shop_default_manager_permissions_v2()
where slug = 'manager';

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
    when public.shop_member_is_owner(p_business_id, p_member_id) then public.shop_owner_permissions_v2()
    else coalesce(sr.permissions, public.shop_default_staff_permissions_v2())
  end
  from public.business_members bm
  left join public.shop_roles sr on sr.id = bm.role_id
  where bm.business_id = p_business_id
    and bm.member_user_id = p_member_id
  limit 1;
$$;
