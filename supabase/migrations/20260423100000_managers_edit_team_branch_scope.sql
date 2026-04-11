-- Full-access managers (allowed_location_ids null/empty) may update teammates' branch scope.
-- Trigger: only the shop owner may change role / member_user_id / business_id; managers may still edit display_name + allowed_location_ids.

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

  if new.role is distinct from old.role or new.member_user_id is distinct from old.member_user_id
    or new.business_id is distinct from old.business_id then
    raise exception 'Only the shop owner can change role or membership';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_business_members_restrict_manager_updates on public.business_members;
create trigger tr_business_members_restrict_manager_updates
  before update on public.business_members
  for each row execute function public.business_members_restrict_manager_updates ();

drop policy if exists "business_members_owner_update" on public.business_members;
create policy "business_members_owner_update" on public.business_members for update using (
  public.is_admin_user ()
  or business_id = (select auth.uid ())
  or (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = business_members.business_id
        and bm.member_user_id = (select auth.uid ())
        and bm.role = 'manager'
        and coalesce(cardinality(bm.allowed_location_ids), 0) = 0
    )
    and business_members.role <> 'owner'
    and business_members.member_user_id <> business_members.business_id
  )
)
with check (
  public.is_admin_user ()
  or business_id = (select auth.uid ())
  or (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = business_members.business_id
        and bm.member_user_id = (select auth.uid ())
        and bm.role = 'manager'
        and coalesce(cardinality(bm.allowed_location_ids), 0) = 0
    )
    and business_members.role <> 'owner'
    and business_members.member_user_id <> business_members.business_id
  )
);
