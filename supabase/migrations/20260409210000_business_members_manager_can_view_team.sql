-- Managers (and owners) need to read all rows for the same shop to manage the team in-app.

drop policy if exists "business_members_select" on public.business_members;
create policy "business_members_select" on public.business_members for select using (
  member_user_id = (select auth.uid ())
  or business_id = (select auth.uid ())
  or exists (
    select 1
    from public.business_members m
    where m.business_id = business_members.business_id
      and m.member_user_id = (select auth.uid ())
      and m.role in ('owner', 'manager')
  )
  or public.is_admin_user ()
);
