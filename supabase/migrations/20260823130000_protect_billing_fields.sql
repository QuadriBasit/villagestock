-- Security fix: business_profiles billing/admin fields were self-modifiable by
-- the row owner. The previous guard trigger only reverted `account_disabled` and
-- `created_at`, and only on UPDATE — an owner could set plan='pro',
-- plan_status='active', or extend trial_end_date directly via PostgREST, and
-- could INSERT a profile already on a paid plan.
--
-- This migration widens the protected column set and makes the trigger fire on
-- INSERT as well. Non-admins get schema defaults on INSERT and their previous
-- values back on UPDATE. Admins (public.is_admin_user()) are unaffected.

create or replace function public.business_profiles_protect_admin_fields ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_user() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.plan := old.plan;
    new.plan_status := old.plan_status;
    new.trial_start_date := old.trial_start_date;
    new.trial_end_date := old.trial_end_date;
    new.subscription_id := old.subscription_id;
    new.account_disabled := old.account_disabled;
    new.created_at := old.created_at;
  else  -- INSERT by a non-admin: force schema defaults
    new.plan := 'trial';
    new.plan_status := 'active';
    new.trial_start_date := '1970-01-01T00:00:00Z'::timestamptz;
    new.trial_end_date := '1970-01-01T00:00:00Z'::timestamptz;
    new.subscription_id := null;
    new.account_disabled := false;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_business_profiles_admin_fields on public.business_profiles;
create trigger tr_business_profiles_admin_fields
  before insert or update on public.business_profiles
  for each row execute function public.business_profiles_protect_admin_fields();
