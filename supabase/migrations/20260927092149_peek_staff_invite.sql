-- Public preview of an invite link: shop name + invited email only.
create or replace function public.peek_staff_invite (p_token uuid)
returns table (
  shop_name text,
  invited_email text,
  display_name text,
  is_open boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    coalesce(nullif(trim(p.shop_name), ''), 'a VillageStock shop')::text,
    i.email::text,
    coalesce(nullif(trim(i.display_name), ''), i.email)::text,
    (i.accepted_at is null and i.expires_at > now ())
  from public.staff_invites i
  left join public.business_profiles p on p.id = i.business_id
  where i.token = p_token
  limit 1;
end;
$$;

revoke all on function public.peek_staff_invite (uuid) from public;
grant execute on function public.peek_staff_invite (uuid) to anon, authenticated;
