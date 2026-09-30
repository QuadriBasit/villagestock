-- Accept RPCs return the shop that was joined so the client can open that
-- membership when the user already owns another shop.
drop function if exists public.accept_open_staff_invite_for_me ();
drop function if exists public.accept_staff_invite (uuid);

create or replace function public.accept_staff_invite (p_token uuid)
returns uuid
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

  return inv.business_id;
end;
$$;

create or replace function public.accept_open_staff_invite_for_me ()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_token uuid;
begin
  if auth.uid () is null then
    return null;
  end if;

  select email into v_email from auth.users where id = auth.uid ();
  if v_email is null or length(trim(v_email)) = 0 then
    return null;
  end if;

  select token into v_token
  from public.staff_invites
  where lower(trim(email)) = lower(trim(v_email))
    and accepted_at is null
    and expires_at > now ()
  order by created_at desc
  limit 1;

  if v_token is null then
    return null;
  end if;

  return public.accept_staff_invite (v_token);
end;
$$;

revoke all on function public.accept_staff_invite (uuid) from public;
grant execute on function public.accept_staff_invite (uuid) to authenticated;

revoke all on function public.accept_open_staff_invite_for_me () from public;
grant execute on function public.accept_open_staff_invite_for_me () to authenticated;
