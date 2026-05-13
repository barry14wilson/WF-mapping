-- Wiley Fox — Phase 1 schema.
-- Tables: crime_incidents, h3_safety_scores, pipeline_logs.
-- H3 indexing happens in the application layer via h3-js, so no H3
-- Postgres extension is required. PostGIS is enabled for future spatial
-- queries (bbox lookups in the safety-tiles endpoint, etc.).

create extension if not exists postgis;

-- crime_incidents -----------------------------------------------------------
-- One row per source record. For sources that publish aggregates (FBI city
-- totals, Eurostat NUTS2, ABS state-level), incident_count > 1 so the
-- scoring engine can SUM(incident_count) rather than COUNT(*). This is a
-- small deviation from the original spec — flagged in README.
create table if not exists crime_incidents (
  id                bigserial primary key,
  source_country    text        not null,
  source_api        text        not null,
  source_record_id  text        not null,
  crime_type        text,
  severity_category text        not null
    check (severity_category in ('violent','sexual','property','asb')),
  incident_count    integer     not null default 1
    check (incident_count >= 1),
  lat               double precision not null,
  lng               double precision not null,
  h3_index_r7       text,
  h3_index_r9       text,
  h3_index_r11      text,
  incident_date     date,
  ingested_at       timestamptz not null default now(),
  -- Idempotency: re-running a connector upserts on this key.
  constraint crime_incidents_source_unique unique (source_api, source_record_id)
);

create index if not exists crime_incidents_h3_r7_idx
  on crime_incidents (h3_index_r7);
create index if not exists crime_incidents_h3_r9_idx
  on crime_incidents (h3_index_r9);
create index if not exists crime_incidents_h3_r11_idx
  on crime_incidents (h3_index_r11);
create index if not exists crime_incidents_date_idx
  on crime_incidents (incident_date);
create index if not exists crime_incidents_country_idx
  on crime_incidents (source_country);

-- h3_safety_scores ----------------------------------------------------------
create table if not exists h3_safety_scores (
  h3_index           text       not null,
  resolution         smallint   not null check (resolution in (7,9,11)),
  score              numeric(6,2),
  band               text       check (band in ('green','amber','red','purple')),
  source_country     text,
  last_calculated_at timestamptz not null default now(),
  primary key (h3_index, resolution)
);

create index if not exists h3_safety_scores_band_idx
  on h3_safety_scores (band);
create index if not exists h3_safety_scores_country_idx
  on h3_safety_scores (source_country);

-- pipeline_logs -------------------------------------------------------------
create table if not exists pipeline_logs (
  id                bigserial primary key,
  source            text        not null,
  records_fetched   integer     not null default 0,
  records_inserted  integer     not null default 0,
  errors            text,
  run_at            timestamptz not null default now()
);

create index if not exists pipeline_logs_source_idx
  on pipeline_logs (source, run_at desc);
