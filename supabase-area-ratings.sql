-- =====================================================================
-- Wiley Fox — Community Area Ratings backend
-- Dev Handoff §13. Run this in the Supabase SQL Editor of the Wiley Fox
-- project (admin@thewileyfox.com account):
--   Dashboard → your project → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent).
-- =====================================================================

-- Ratings table: one row per submitted rating.
-- area_name holds either the city ("London") or a city+area key
-- ("London — Soho"), so per-area ratings aggregate naturally.
create table if not exists public.area_ratings (
  id          uuid primary key default gen_random_uuid(),
  area_name   text     not null,
  rating      smallint not null check (rating between 1 and 5),
  created_at  timestamptz default now()
);

create index if not exists area_ratings_area_idx on public.area_ratings (area_name);

-- Row Level Security: anonymous visitors may submit and read ratings,
-- but nothing else. No updates or deletes from the client.
alter table public.area_ratings enable row level security;

drop policy if exists "anon insert" on public.area_ratings;
create policy "anon insert" on public.area_ratings
  for insert to anon
  with check (rating between 1 and 5 and char_length(area_name) <= 80);

drop policy if exists "anon read" on public.area_ratings;
create policy "anon read" on public.area_ratings
  for select to anon
  using (true);
