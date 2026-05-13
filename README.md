# Wiley Fox — Global Safety Map Data Pipeline

Backend pipeline that ingests free/open crime data, scores it into Uber H3 cells, and exposes a GeoJSON endpoint for the Wiley Fox map.

This repo also contains the standalone single-file prototype (`wiley-fox-uk-prototype.html`). See `CLAUDE.md` for the project briefing and how the two pieces relate.

---

## Status

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 — Schema & DB setup (Supabase) | done | See `supabase/migrations/`. |
| 2 — Normalisation schema | done | Severity buckets in `lib/normalise.js`. |
| 3 — Connectors | partial | UK Police + US FBI shipped as pilot. Remaining sources pending Barry's sign-off on the pilot. |
| 4 — Scoring engine | not started | |
| 5 — Netlify scheduled functions | not started | |
| 6 — Mapbox / MapLibre GeoJSON endpoint | not started | |
| 7 — Route safety check | not started | |

---

## Quick start

```bash
# 1. Install deps (Node 18+).
npm install

# 2. Copy and fill in env.
cp .env.example .env
# edit SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FBI_API_KEY

# 3. Apply the schema to your Supabase project.
#    Either via the Supabase CLI (`supabase db push`) or by pasting
#    supabase/migrations/20260513000000_initial_schema.sql into the SQL editor.

# 4. Dry-run a connector (prints sample, writes nothing).
DRY_RUN=1 npm run connector:uk

# 5. Real run.
npm run connector:uk
npm run connector:us
```

---

## Layout

```
/
├── CLAUDE.md                          briefing for AI assistants & humans
├── README.md                          you are here
├── wiley-fox-uk-prototype.html        single-file UK map (separate piece)
├── package.json
├── .env.example
├── supabase/
│   └── migrations/
│       └── 20260513000000_initial_schema.sql
├── lib/
│   ├── supabase.js                    client + DRY_RUN helper
│   ├── h3.js                          lat/lng → H3 r7/r9/r11
│   ├── normalise.js                   severity buckets per source
│   └── pipeline-log.js                writes to pipeline_logs
└── connectors/
    ├── uk-police.js                   data.police.uk — monthly, street-level
    └── us-fbi.js                      api.usa.gov/crime — annual, agency-level
```

---

## Schema notes

The migration follows the spec with two pragmatic additions, both documented in the SQL file:

1. **`source_record_id`** + `UNIQUE(source_api, source_record_id)` on `crime_incidents`. Required for idempotent `upsert` — without it, re-running a connector would duplicate data.
2. **`incident_count INTEGER DEFAULT 1`** on `crime_incidents`. Sources fall into two shapes:
   - **Street-level** (UK Police): one API record = one incident → `incident_count = 1`.
   - **Aggregate** (FBI city totals, Eurostat NUTS2, ABS state-level): one API record = N incidents → `incident_count = N`.

   Without this column a Phoenix-with-5000-robberies row would weigh the same as a single London street incident. The scoring engine will use `SUM(incident_count)` for volume rather than `COUNT(*)`.

If Barry would rather keep the schema strictly as originally specified, easiest is to drop `incident_count` and have aggregate connectors expand to N rows — but that explodes the row count (US FBI alone would be tens of millions of rows per year). Recommend keeping the column.

---

## Connectors

### UK Police — `connectors/uk-police.js`

- **Source:** `https://data.police.uk/api` (no key, monthly cadence).
- **Coverage:** England, Wales, Northern Ireland (Scotland not covered — deferred per brief).
- **Strategy:** for the latest available month, fetch crimes within a 1-mile radius of each of the 10 priority cities. Override via `UK_AREAS="lat,lng;lat,lng"`.
- **Idempotency:** uses the API's `persistent_id` where present; falls back to a SHA-1 of `(category, lat, lng, month, street_id)`.

### US FBI — `connectors/us-fbi.js`

- **Source:** `https://api.usa.gov/crime/fbi/cde` (free key required, signup at <https://api.data.gov/signup/>).
- **Coverage:** city-level annual aggregates, top 25 agencies by population per state.
- **Default states:** `NY, CA, TX, IL, AZ, FL, PA, OH`. Override via `US_STATES`.
- **Default years:** the two most recently completed calendar years. Override via `US_YEARS`.
- **Idempotency:** `source_record_id = ${ori}|${offense}|${year}`.
- **Caveat:** The FBI publishes aggregates, so each row carries an `incident_count` rather than being one-per-incident. See "Schema notes" above.

---

## Conventions

- **All API keys via env vars** — never hardcoded.
- **All upserts** — `.upsert(rows, { onConflict: 'source_api,source_record_id' })`.
- **Each connector logs its run** — fetched / inserted / errors written to `pipeline_logs`.
- **Graceful errors** — a failed area or agency logs and continues; the run does not crash.
- **DRY_RUN=1** — print samples to stdout, skip all DB writes. Useful for first-time verification.

---

## What's intentionally not yet built

- Phases 4–7. Confirming pilot ingest with Barry before continuing.
- Connectors 3–9 (Eurostat, ABS, StatCan, hoyodecrimen, UNODC, World Bank, ACLED). Each gets its own file in `/connectors` once the pilot is signed off.
- Tests. The connectors are written defensively (graceful errors, idempotent upserts, DRY_RUN) but no automated test suite yet. A first cut would mock the data.police.uk and FBI fetches and assert the normaliser output.
