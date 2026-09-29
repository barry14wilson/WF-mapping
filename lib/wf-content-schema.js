// Wiley Fox city content database - append-only schema (Neon Postgres).
// Rule: rows are never deleted. Sources are inserted once (ON CONFLICT DO NOTHING);
// only status/timestamp columns are updated. Facts/tips/photos are superseded, not removed.

export const CONTENT_SCHEMA = [
`create table if not exists wf_cities (
  slug text primary key,
  name text not null,
  country text,
  region text,
  tier int,
  last_search_at timestamptz,
  created_at timestamptz not null default now()
)`,
`create table if not exists wf_creators (
  id bigserial primary key,
  platform text not null,                 -- youtube | instagram | tiktok | x | blog
  handle text,
  channel_id text,
  name text,
  url text,
  instagram_url text,
  trust_tier text,                        -- A | B | C | X
  partner_status text,
  source text,                            -- sheet | pipeline | claude
  notes text,
  uploads_playlist text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,
`create unique index if not exists wf_creators_key on wf_creators (platform, coalesce(channel_id, lower(handle), lower(url)))`,
`create table if not exists wf_sources (
  id text primary key,                    -- yt:<videoId> | ig:<shortcode> | web:<hash>
  platform text not null,
  url text not null,
  title text,
  channel text,
  channel_id text,
  city_slug text,
  published_at timestamptz,
  views bigint,
  likes bigint,
  duration text,
  description text,
  discovered_via text,                    -- backfill | creator_uploads | city_search | sheet | instagram
  transcript_status text not null default 'pending',   -- pending | ok | none | failed | not_applicable
  transcript_attempts int not null default 0,
  extracted_at timestamptz,
  excluded boolean not null default false,
  excluded_reason text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`,
`create index if not exists wf_sources_city on wf_sources (city_slug)`,
`create index if not exists wf_sources_status on wf_sources (transcript_status, extracted_at)`,
`create table if not exists wf_transcripts (
  source_id text primary key references wf_sources(id),
  text text not null,
  length int,
  lang text,
  fetched_at timestamptz not null default now()
)`,
`create table if not exists wf_facts (
  id bigserial primary key,
  city_slug text not null,
  kind text not null,                     -- stay | hotel | visit | caution | transport | cost | safety_feeling | food | tip | scam
  area text,
  name text,
  data jsonb not null default '{}',
  source_id text references wf_sources(id),
  creator text,
  observed_at date,                       -- date of the video/post the fact came from
  status text not null default 'active',  -- active | superseded | rejected
  created_by text default 'claude',
  created_at timestamptz not null default now()
)`,
`create index if not exists wf_facts_city on wf_facts (city_slug, kind, status)`,
`create table if not exists wf_tips (
  id bigserial primary key,
  scope text not null,                    -- city slug, or 'uk' for UK-wide
  category text not null,                 -- water_snacks | toilets | parks_play | transport_payment | money_tipping | phone_data | safety_habits | local_ways
  worry text,
  tip text not null,
  verified_url text,
  verified_at date,
  source_id text references wf_sources(id),
  creator text,
  status text not null default 'active',
  created_at timestamptz not null default now()
)`,
`create index if not exists wf_tips_scope on wf_tips (scope, category, status)`,
`create table if not exists wf_photos (
  id bigserial primary key,
  city_slug text,
  subject_type text not null,             -- cover | area | hotel | restaurant | attraction
  subject_name text not null,
  url text not null,
  page_url text,
  provider text,                          -- wikimedia | getyourguide | booking | google_places | owner
  license text,
  credit text,
  status text not null default 'active',
  created_at timestamptz not null default now()
)`,
`create table if not exists wf_runs (
  id bigserial primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb
)`,
`alter table wf_cities add column if not exists focus_rank int`,
`alter table wf_cities add column if not exists guide_status text`,            // queued | building | done
`create table if not exists wf_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
)`,
];
