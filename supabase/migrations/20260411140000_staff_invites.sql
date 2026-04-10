-- Owner/manager email invites: pending row + accept_staff_invite after user sets password via Supabase invite email.

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid (),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'staff')),
  display_name text,
  invited_by uuid not null references auth.users (id) on delete cascade,
  token uuid not null default gen_random_uuid (),
  created_at timestamptz not null default now (),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  constraint staff_invites_token_unique unique (token)
);

create index if not exists staff_invites_business_idx on public.staff_invites (business_id);
create index if not exists staff_invites_email_lookup_idx on public.staff_invites (lower(trim(email)));

create unique index if not exists staff_invites_one_pending_per_shop_email on public.staff_invites (
  business_id,
  lower(trim(email))
) where accepted_at is null;

alter table public.staff_invites enable row level security;

drop policy if exists "staff_invites_select_shop_managers" on public.staff_invites;
create policy "staff_invites_select_shop_managers" on public.staff_invites for select using (
  public.is_admin_user ()
  or exists (
    select 1
    from public.business_members m
    where m.business_id = staff_invites.business_id
      and m.member_user_id = (select auth.uid ())
      and m.role in ('owner', 'manager')
  )
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

  insert into public.business_members (business_id, member_user_id, role, display_name)
  values (inv.business_id, auth.uid (), inv.role, inv.display_name)
  on conflict (business_id, member_user_id) do update set role = excluded.role,
      display_name = excluded.display_name;

  update public.staff_invites
  set accepted_at = now ()
  where id = inv.id;
end;
$$;

revoke all on function public.accept_staff_invite (uuid) from public;
grant execute on function public.accept_staff_invite (uuid) to authenticated;
