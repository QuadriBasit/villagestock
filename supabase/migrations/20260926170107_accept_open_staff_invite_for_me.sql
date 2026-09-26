-- If someone signs in with an invited email (Google or password) without the
-- invite query string, still attach them to that shop.
create or replace function public.accept_open_staff_invite_for_me ()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_token uuid;
begin
  if auth.uid () is null then
    return false;
  end if;

  select email into v_email from auth.users where id = auth.uid ();
  if v_email is null or length(trim(v_email)) = 0 then
    return false;
  end if;

  select token into v_token
  from public.staff_invites
  where lower(trim(email)) = lower(trim(v_email))
    and accepted_at is null
    and expires_at > now ()
  order by created_at desc
  limit 1;

  if v_token is null then
    return false;
  end if;

  perform public.accept_staff_invite (v_token);
  return true;
end;
$$;

revoke all on function public.accept_open_staff_invite_for_me () from public;
grant execute on function public.accept_open_staff_invite_for_me () to authenticated;
