create extension if not exists "pgcrypto";

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand_name text not null,
  product text not null,
  goal text not null,
  audience text not null,
  channels text[] not null default '{}',
  delivery_area text,
  content_capacity text,
  plan_text text not null,
  input_payload jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb
);

create index if not exists campaigns_created_at_idx
  on public.campaigns (created_at desc);

create index if not exists campaigns_brand_name_idx
  on public.campaigns (brand_name);

alter table public.campaigns enable row level security;

-- V1 uses Vercel serverless functions with SUPABASE_SERVICE_ROLE_KEY.
-- Keep public browser access disabled until user accounts are added.
drop policy if exists "No public campaign access in V1" on public.campaigns;

create policy "No public campaign access in V1"
  on public.campaigns
  for all
  using (false)
  with check (false);
