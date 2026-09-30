-- Close-stock marks units missing; the live enum never allowed that value.
alter type public.serialized_item_status add value if not exists 'missing';

-- Sale warranty lives in Dexie today; a pull overwrites it with shop defaults.
alter table public.sales_records
  add column if not exists warranty_cover jsonb,
  add column if not exists item_stock_condition text,
  add column if not exists warranty_months integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_records_item_stock_condition_check'
  ) then
    alter table public.sales_records
      add constraint sales_records_item_stock_condition_check
      check (
        item_stock_condition is null
        or item_stock_condition in ('new', 'used', 'uk_used', 'refurb')
      );
  end if;
end
$$;
