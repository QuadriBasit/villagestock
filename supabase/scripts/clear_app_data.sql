-- Clear all VillageStock retail + shop data (Supabase Postgres).
-- Keeps: auth.users, public.profiles, public.admin_users.
--
-- Run in Supabase Dashboard → SQL Editor (postgres or service role).
-- Then clear the browser IndexedDB database "VillageStockDB" (DevTools → Application).
--
-- After this, sign in again and complete onboarding to recreate business_profiles / locations.

begin;

truncate table
  public.audit_events,
  public.stock_movements,
  public.sales_records,
  public.swap_records,
  public.return_records,
  public.credit_records,
  public.repair_records,
  public.inventory_items,
  public.staff_invites,
  public.business_members,
  public.shop_locations,
  public.business_profiles,
  public.subscription_payments
restart identity cascade;

commit;

-- Optional: wipe mirrored profile rows (same auth users remain; they re-fill on next login)
-- truncate table public.profiles restart identity cascade;
