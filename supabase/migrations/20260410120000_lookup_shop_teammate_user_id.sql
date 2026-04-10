-- Resolve auth user id by email for shop invites (owners/managers only).
-- Avoids exposing auth.users to clients; caller must belong to the business with manager+ role.

create or replace function public.lookup_shop_teammate_user_id(
  p_business_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_uid uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select bm.role into v_role
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.member_user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('owner', 'manager') then
    return null;
  end if;

  select u.id into v_uid
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;

  return v_uid;
end;
$$;

revoke all on function public.lookup_shop_teammate_user_id(uuid, text) from public;
grant execute on function public.lookup_shop_teammate_user_id(uuid, text) to authenticated;
