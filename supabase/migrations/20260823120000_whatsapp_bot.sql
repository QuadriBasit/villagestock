-- WhatsApp bot (Phase 2, step 1): links a WhatsApp number to a shop and
-- stores per-number conversation history for the AI intent layer.
-- Read-only for the bot: sales_records / inventory_items / credit_records
-- already exist and are owned by the linked business's user_id.

create table if not exists public.whatsapp_links (
  id uuid primary key default uuid_generate_v4(),
  -- MSISDN without '+' e.g. 2348031234567
  phone_msisdn text not null unique,
  business_id uuid not null references auth.users(id) on delete cascade,
  -- which branch the bot acts on; null = all branches
  location_id uuid references public.shop_locations(id) on delete set null,
  verified boolean not null default false,
  -- 6-digit code sent by the bot during linking
  verification_code text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists whatsapp_links_business_idx on public.whatsapp_links(business_id);

alter table public.whatsapp_links enable row level security;

-- Owners/managers manage their own links (service role bypasses RLS for the bot).
drop policy if exists "Users manage their own whatsapp links" on public.whatsapp_links;
create policy "Users manage their own whatsapp links"
  on public.whatsapp_links for all
  using (
    auth.uid() = business_id
    or exists (
      select 1 from public.business_members m
      where m.business_id = whatsapp_links.business_id
        and m.member_user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

create table if not exists public.whatsapp_sessions (
  id uuid primary key default uuid_generate_v4(),
  phone_msisdn text not null,
  -- full conversation turns, newest last: [{role, content}]
  messages jsonb not null default '[]'::jsonb,
  -- pending confirmation for write tools (Phase 2, step 3)
  pending_action jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_sessions_phone_idx on public.whatsapp_sessions(phone_msisdn);

alter table public.whatsapp_sessions enable row level security;
-- No policies: only the service role (the Edge Function) touches sessions.
