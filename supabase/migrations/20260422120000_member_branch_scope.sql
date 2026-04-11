-- Branch scope for managers/staff: allowed_location_ids NULL or empty = all branches.
-- RLS uses shop_member_can_access_location; shop locations CRUD restricted to owner / full managers.

alter table public.business_members
add column if not exists allowed_location_ids uuid[];

alter table public.staff_invites
add column if not exists allowed_location_ids uuid[];

-- Validate member scope references only this shop's branches
create or replace function public.business_members_validate_locations ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.allowed_location_ids is not null
    and cardinality(new.allowed_location_ids) > 0 then
    if exists (
      select 1
      from unnest(new.allowed_location_ids) as loc (id)
      where not exists (
        select 1
        from public.shop_locations sl
        where sl.id = loc.id
          and sl.business_id = new.business_id
      )
    ) then
      raise exception 'allowed_location_ids must be branch IDs for this shop';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_business_members_validate_locations on public.business_members;
create trigger tr_business_members_validate_locations before insert or update on public.business_members
  for each row execute function public.business_members_validate_locations ();

-- True when actor may access rows for this shop at this branch (inventory, sales, etc.)
create or replace function public.shop_member_can_access_location (p_shop_user_id uuid, p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_shop_user_id is not null
    and p_location_id is not null
    and (
      p_shop_user_id = (select auth.uid ())
      or public.is_admin_user ()
      or exists (
        select 1
        from public.business_members bm
        where bm.business_id = p_shop_user_id
          and bm.member_user_id = (select auth.uid ())
          and (
            coalesce(cardinality(bm.allowed_location_ids), 0) = 0
            or p_location_id = any (bm.allowed_location_ids)
          )
      )
    );
$$;

revoke all on function public.shop_member_can_access_location (uuid, uuid) from public;
grant execute on function public.shop_member_can_access_location (uuid, uuid) to authenticated;

-- Owner always; manager with no branch restriction (null/empty allowed_location_ids)
create or replace function public.shop_member_has_full_location_access (p_shop_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_shop_user_id is not null
    and (
      p_shop_user_id = (select auth.uid ())
      or public.is_admin_user ()
      or exists (
        select 1
        from public.business_members bm
        where bm.business_id = p_shop_user_id
          and bm.member_user_id = (select auth.uid ())
          and bm.role = 'manager'
          and coalesce(cardinality(bm.allowed_location_ids), 0) = 0
      )
    );
$$;

revoke all on function public.shop_member_has_full_location_access (uuid) from public;
grant execute on function public.shop_member_has_full_location_access (uuid) to authenticated;

-- Insert member: branch-only managers may only assign a subset of their own branches
create or replace function public.business_members_invite_scope_ok (
  p_business_id uuid,
  p_new_allowed uuid[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid ();
  m_rec public.business_members%rowtype;
begin
  if v_uid is null or p_business_id is null then
    return false;
  end if;
  if p_business_id = v_uid then
    return true;
  end if;
  if public.is_admin_user () then
    return true;
  end if;

  select * into m_rec
  from public.business_members
  where business_id = p_business_id
    and member_user_id = v_uid
    and role in ('owner', 'manager')
  limit 1;

  if not found then
    return false;
  end if;

  if m_rec.role = 'owner' then
    return true;
  end if;

  if coalesce(cardinality(m_rec.allowed_location_ids), 0) = 0 then
    return true;
  end if;

  if p_new_allowed is null or coalesce(cardinality(p_new_allowed), 0) = 0 then
    return false;
  end if;

  return m_rec.allowed_location_ids @> p_new_allowed;
end;
$$;

revoke all on function public.business_members_invite_scope_ok (uuid, uuid[]) from public;
grant execute on function public.business_members_invite_scope_ok (uuid, uuid[]) to authenticated;

drop policy if exists "business_members_owner_insert" on public.business_members;
create policy "business_members_owner_insert" on public.business_members for insert with check (
  (
    public.is_admin_user ()
    or exists (
      select 1
      from public.business_members m
      where m.business_id = business_members.business_id
        and m.member_user_id = (select auth.uid ())
        and m.role in ('owner', 'manager')
    )
  )
  and public.business_members_invite_scope_ok(business_id, allowed_location_ids)
);

-- Inventory & retail: member must be allowed for row's location_id
drop policy if exists "Shop access inventory" on public.inventory_items;
create policy "Shop access inventory" on public.inventory_items for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

drop policy if exists "Shop access stock_movements" on public.stock_movements;
create policy "Shop access stock_movements" on public.stock_movements for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and exists (
      select 1
      from public.inventory_items i
      where i.id = stock_movements.item_id
        and public.shop_member_can_access_location (user_id, i.location_id)
    )
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and exists (
      select 1
      from public.inventory_items i
      where i.id = stock_movements.item_id
        and public.shop_member_can_access_location (user_id, i.location_id)
    )
  )
);

drop policy if exists "Shop access sales" on public.sales_records;
create policy "Shop access sales" on public.sales_records for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

drop policy if exists "Shop access swaps" on public.swap_records;
create policy "Shop access swaps" on public.swap_records for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

drop policy if exists "Shop access credits" on public.credit_records;
create policy "Shop access credits" on public.credit_records for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

drop policy if exists "Shop access repairs" on public.repair_records;
create policy "Shop access repairs" on public.repair_records for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

drop policy if exists "Shop access returns" on public.return_records;
create policy "Shop access returns" on public.return_records for all using (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
)
with check (
  (select auth.uid ()) = user_id
  or (
    public.shop_has_member (user_id, (select auth.uid ()))
    and public.shop_member_can_access_location (user_id, location_id)
  )
);

-- Shop profile: branch-only managers cannot change business-wide settings
drop policy if exists "Shop owners and managers update profile" on public.business_profiles;
create policy "Shop owners and managers update profile" on public.business_profiles for update using (
  (select auth.uid ()) = id
  or (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = business_profiles.id
        and bm.member_user_id = (select auth.uid ())
        and bm.role in ('owner', 'manager')
    )
    and public.shop_member_has_full_location_access (business_profiles.id)
  )
  or public.is_admin_user ()
)
with check (
  (select auth.uid ()) = id
  or (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = business_profiles.id
        and bm.member_user_id = (select auth.uid ())
        and bm.role in ('owner', 'manager')
    )
    and public.shop_member_has_full_location_access (business_profiles.id)
  )
  or public.is_admin_user ()
);

-- Branches: see only allowed; add/edit/delete only owner or unrestricted manager
drop policy if exists "shop_locations_select" on public.shop_locations;
create policy "shop_locations_select" on public.shop_locations for select using (
  (select auth.uid ()) = business_id
  or public.is_admin_user ()
  or (
    public.shop_has_member (business_id, (select auth.uid ()))
    and public.shop_member_can_access_location (business_id, shop_locations.id)
  )
);

drop policy if exists "shop_locations_insert" on public.shop_locations;
create policy "shop_locations_insert" on public.shop_locations for insert with check (
  (select auth.uid ()) = business_id
  or public.shop_member_has_full_location_access (business_id)
);

drop policy if exists "shop_locations_update" on public.shop_locations;
create policy "shop_locations_update" on public.shop_locations for update using (
  (select auth.uid ()) = business_id
  or public.shop_member_has_full_location_access (business_id)
)
with check (
  (select auth.uid ()) = business_id
  or public.shop_member_has_full_location_access (business_id)
);

drop policy if exists "shop_locations_delete" on public.shop_locations;
create policy "shop_locations_delete" on public.shop_locations for delete using (
  (select auth.uid ()) = business_id
  or public.shop_member_has_full_location_access (business_id)
);

-- Invites: only owner or full managers can view pending invites
drop policy if exists "staff_invites_select_shop_managers" on public.staff_invites;
create policy "staff_invites_select_shop_managers" on public.staff_invites for select using (
  public.is_admin_user ()
  or exists (
    select 1
    from public.business_members m
    where m.business_id = staff_invites.business_id
      and m.member_user_id = (select auth.uid ())
      and (
        m.role = 'owner'
        or (
          m.role = 'manager'
          and coalesce(cardinality(m.allowed_location_ids), 0) = 0
        )
      )
  )
);

-- Accept invite copies branch scope onto membership
create or replace function public.accept_staff_invite (p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invites%rowtype;
  v_email text;
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

  insert into public.business_members(
    business_id,
    member_user_id,
    role,
    display_name,
    allowed_location_ids
  )
  values (
    inv.business_id,
    auth.uid (),
    inv.role,
    inv.display_name,
    inv.allowed_location_ids
  )
  on conflict (business_id, member_user_id) do update set
    role = excluded.role,
    display_name = excluded.display_name,
    allowed_location_ids = excluded.allowed_location_ids;

  update public.staff_invites
  set accepted_at = now ()
  where id = inv.id;
end;
$$;
