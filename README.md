# Wiley Fox — Global Safety Map Data Pipeline

Backend pipeline that ingests free/open crime data, scores it into Uber H3 cells, and exposes a GeoJSON endpoint for the Wiley Fox map.

This repo also contains the standalone single-file prototype (`wiley-fox-uk-prototype.html`). See `CLAUDE.md` for the project briefing and how the two pieces relate.

---

## Status

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 — Schema & DB setup (Supabase) | done | `supabase/migrations/`. |
| 2 — Normalisation schema | done | Severity maps per source in `lib/normalise.js`. |
| 3 — Connectors (9) | done | UK + US verified against live APIs; international connectors written against published API shapes, may need parser tweaks once you run them. |
| 4 — Scoring engine | done | `scoring/scoring-engine.js`. |
| 5 — Netlify scheduled functions | done | `netlify/functions/scheduled-*.js` + `netlify.toml`. |
| 6 — Safety-tiles GeoJSON endpoint | done | `GET /api/safety-tiles?bbox=…` or `?h3=…`. |
| 7 — Route safety check | done | `lib/route-safety-check.js` + `POST /api/route-safety-check`. |

---

> For getting this live (Supabase + Netlify + verification curl) see **[DEPLOY.md](./DEPLOY.md)**. The fastest path: `cp .env.example .env`, fill in Supabase keys, then `npm install && npm run smoke`.

## Quick start

```bash
# 1. Install (Node 18+).
npm install

# 2. Configure env.
cp .env.example .env
# fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FBI_API_KEY,
# ACLED_API_KEY, ACLED_EMAIL.

# 3. Apply schema.
#    supabase db push   (or paste supabase/migrations/*.sql into the SQL editor)

# 4. Dry-run.
DRY_RUN=1 npm run connector:uk

# 5. Pilot ingest + score.
npm run connector:uk
npm run connector:us
npm run score

# 6. Local Netlify dev (functions + redirects).
npx netlify dev
# then: curl 'http://localhost:8888/api/safety-tiles?bbox=-0.5,51.3,0.3,51.7&resolution=9'
```

---

## Layout

```
/
├── CLAUDE.md                          briefing for AI assistants & humans
├── README.md                          you are here
├── wiley-fox-uk-prototype.html        single-file UK map (separate piece)
├── package.json
├── netlify.toml                       function schedules + /api redirects
├── .env.example
├── supabase/migrations/
│   └── 20260513000000_initial_schema.sql
├── lib/
│   ├── supabase.js                    client + DRY_RUN helper
│   ├── h3.js                          lat/lng → H3 r7/r9/r11
│   ├── normalise.js                   severity buckets per source
│   ├── upsert.js                      batched idempotent upsert helper
│   ├── pipeline-log.js                writes to pipeline_logs
│   ├── country-data.js                centroids + populations
│   ├── bands.js                       band → colour palette
│   └── route-safety-check.js          Phase 7 module
├── connectors/                        Phase 3
│   ├── uk-police.js                   data.police.uk          (daily)
│   ├── us-fbi.js                      api.usa.gov/crime       (weekly)
│   ├── eu-eurostat.js                 ec.europa.eu/eurostat   (weekly)
│   ├── australia-abs.js               api.data.abs.gov.au     (weekly)
│   ├── canada-statcan.js              statcan.gc.ca           (weekly)
│   ├── mexico-hoyodecrimen.js         hoyodecrimen.com/api    (daily)
│   ├── unodc-global.js                dataunodc.un.org        (monthly)
│   ├── worldbank-global.js            api.worldbank.org/v2    (monthly)
│   └── acled-conflict.js              api.acleddata.com       (monthly)
├── scoring/
│   └── scoring-engine.js              Phase 4
└── netlify/functions/
    ├── _run-pipeline.js               shared: connector → scorer
    ├── scheduled-*.js                 one per connector, cron per spec
    ├── safety-tiles.js                Phase 6 — GET /api/safety-tiles
    └── route-safety-check.js          Phase 7 HTTP wrapper
```

---

## Schema notes

The migration follows the spec with two pragmatic additions, both documented in the SQL:

1. **`source_record_id`** + `UNIQUE(source_api, source_record_id)` on `crime_incidents`. Required for idempotent `upsert`.
2. **`incident_count INTEGER DEFAULT 1`** on `crime_incidents`. Sources are either street-level (UK Police, ACLED, hoyodecrimen) where each API record = one incident, or aggregate (FBI, Eurostat, ABS, StatCan, UNODC, World Bank) where one API record = N incidents. The scoring engine uses `SUM(incident_count)` for volume instead of `COUNT(*)`.

---

## Connectors at a glance

| File | Source | Granularity | Auth | Idempotency key |
| ---- | ------ | ----------- | ---- | --------------- |
| `uk-police.js` | data.police.uk | Street-level | None | `persistent_id` or hash |
| `us-fbi.js` | FBI CDE | Agency × offense × year | `FBI_API_KEY` | `ori\|offense\|year` |
| `eu-eurostat.js` | Eurostat `crim_off_cat` | Country × ICCS × year | None | `geo\|iccs\|year` |
| `australia-abs.js` | ABS `RECORDED_CRIME_VICTIMS` | State × offence × year | None | `state\|offence\|year` |
| `canada-statcan.js` | StatCan table 35-10-0177 | CMA × offence × year | None | `cma\|offence\|year` |
| `mexico-hoyodecrimen.js` | hoyodecrimen.com | Cuadrante × crime × month | None | `cuadrante\|crime\|YYYY-MM` |
| `unodc-global.js` | UNODC dataportal CSV | Country × year | None (URL configurable) | `iso\|homicide\|year` |
| `worldbank-global.js` | World Bank `VC.IHR.PSRC.P5` | Country × year | None | `iso\|homicide\|year` |
| `acled-conflict.js` | ACLED | Event-level (lat/lng) | `ACLED_API_KEY` + email | `acled\|data_id` |

### Verified vs. needs-live-check

- **Verified against documented API shapes:** `uk-police`, `us-fbi`, `worldbank-global`, `acled-conflict`. Should run cleanly.
- **Working but parser may need a tweak with live data:** `eu-eurostat` (JSON-stat 2.0), `australia-abs` (SDMX-JSON), `canada-statcan` (StatCan WDS), `unodc-global` (CSV URL changes year-to-year — set `UNODC_HOMICIDE_URL` if the default 404s), `mexico-hoyodecrimen` (cuadrante geometry/centroid extraction).

All connectors are idempotent and log to `pipeline_logs` either way, so it's safe to run them and inspect.

---

## Scoring (`scoring/scoring-engine.js`)

For each `(source_country, resolution)` cohort:

1. Group incidents by H3 cell.
2. Compute four raw metrics per cell:
   - **volume** = `SUM(incident_count)`
   - **severity_weighted** = `SUM(incident_count × severity_weight)` — weights `violent=3, sexual=4, property=1, asb=1`.
   - **recency_weighted** = `SUM(incident_count × recency_factor)` — `≤3mo→2×`, `3–12mo→1×`, `1–3yr→0.5×`, older→0×.
   - **population_normalised** = `volume / country_population × 100,000`.
3. Min-max normalise each metric to [0,100] within the cohort (so the weighted sum is meaningful across sources with different units).
4. `score = 0.30·v + 0.35·s + 0.20·r + 0.15·p`.
5. Assign band by percentile within the cohort: `<70 green, 70–85 amber, 85–95 red, >95 purple`.

Partial recalc is supported via the `cellFilter` arg — percentile context is still computed from the full country, but only the listed cells are written.

```bash
npm run score             # rescore everything
node scoring/scoring-engine.js GB   # one country
```

---

## HTTP endpoints

### `GET /api/safety-tiles`

Query params:
- `bbox=minLng,minLat,maxLng,maxLat` — bounding box, OR
- `h3=cell1,cell2,…` — explicit cell list
- `resolution=7|9|11` — default `9`
- `bands=red,purple` — optional band filter

Returns a GeoJSON `FeatureCollection`. Each feature is the H3 cell's hexagonal polygon with `{ h3, score, band, color, resolution }` properties. Colours: green `#2ECC71`, amber `#F39C12`, red `#E74C3C`, purple `#8E44AD`.

### `POST /api/route-safety-check`

Body: a GeoJSON `Feature<LineString>` from Mapbox Directions (or `{ lineString, resolution }`).

Returns:
```json
{
  "resolution": 9,
  "bbox": [...],
  "cellsChecked": 142,
  "flaggedSegments": [
    { "h3": "...", "band": "red", "score": 87.4, "from": [lng,lat], "to": [lng,lat] }
  ],
  "suggestedWaypoints": [
    { "avoidH3": "...", "h3": "...", "lat": ..., "lng": ..., "band": "amber" }
  ]
}
```

The suggested waypoint is the centroid of the nearest green/amber neighbour cell. It's a v1 hint — the caller can then re-plan via Mapbox Directions with `avoid` polygons or pass the waypoint into a new directions request.

---

## Tests

```bash
npm test
```

29 tests across normalisers, H3 indexing, the JSON-stat 2.0 parser, the scoring engine, the UK Police connector, and both HTTP endpoints. No external test deps — uses Node's built-in `node:test` and `node:assert`. Connector and endpoint tests stub Supabase via the `__setClientForTests` seam in `lib/supabase.js`; the UK connector test additionally mocks `fetch`. See `test/_utils.js`.

---

## Conventions

- **All API keys via env vars** — never hardcoded. See `.env.example`.
- **All upserts** — `.upsert(rows, { onConflict: 'source_api,source_record_id' })`.
- **Each connector logs its run** — fetched / inserted / errors → `pipeline_logs`.
- **Graceful errors** — a failed area / agency / year logs and continues.
- **`DRY_RUN=1`** — print samples to stdout, skip all DB writes.

---

## Map-side integration notes

For the prototype to start consuming the pipeline, swap its data.police.uk call for:

```js
const url = `/api/safety-tiles?bbox=${minLng},${minLat},${maxLng},${maxLat}&resolution=9`;
const { features } = await fetch(url).then(r => r.json());
map.getSource('safety').setData({ type: 'FeatureCollection', features });
```

The prototype's 1–5 rating maps to bands as: `green→5`, `green/amber→4`, `amber→3`, `red→2`, `purple→1`. Pick the final mapping with Barry before shipping.
