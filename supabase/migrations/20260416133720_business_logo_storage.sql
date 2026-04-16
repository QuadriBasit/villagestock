alter table public.business_profiles
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Shop logos are public" on storage.objects;
create policy "Shop logos are public"
  on storage.objects for select
  using (bucket_id = 'shop-assets');

drop policy if exists "Shop managers upload logos" on storage.objects;
create policy "Shop managers upload logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-assets'
    and exists (
      select 1
      from public.business_members bm
      where bm.business_id::text = (storage.foldername(name))[1]
        and bm.member_user_id = auth.uid()
        and bm.role in ('owner', 'manager')
    )
  );

drop policy if exists "Shop managers update logos" on storage.objects;
create policy "Shop managers update logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and exists (
      select 1
      from public.business_members bm
      where bm.business_id::text = (storage.foldername(name))[1]
        and bm.member_user_id = auth.uid()
        and bm.role in ('owner', 'manager')
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and exists (
      select 1
      from public.business_members bm
      where bm.business_id::text = (storage.foldername(name))[1]
        and bm.member_user_id = auth.uid()
        and bm.role in ('owner', 'manager')
    )
  );

drop policy if exists "Shop managers delete logos" on storage.objects;
create policy "Shop managers delete logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and exists (
      select 1
      from public.business_members bm
      where bm.business_id::text = (storage.foldername(name))[1]
        and bm.member_user_id = auth.uid()
        and bm.role in ('owner', 'manager')
    )
  );
