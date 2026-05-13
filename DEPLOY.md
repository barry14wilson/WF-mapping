# Wiley Fox Pipeline — Deployment Guide

Goal: get `https://wiley-fox.netlify.app/api/safety-tiles` live, backed by Neon Postgres.

You don't need to deploy to Netlify to verify the pipeline. Steps 1–4 stand it up locally against your Neon database; steps 5–6 push it to production.

---

## 1. Neon Postgres (already done)

You already have a Neon project. The connection string lives in `DATABASE_URL` (Neon dashboard → Connect → Pooled connection). Keep it server-side only.

Verify the schema is applied — paste this into the **Neon SQL editor**:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('crime_incidents','h3_safety_scores','pipeline_logs');
```

You should see all three rows. If not, paste `supabase/migrations/20260513000000_initial_schema.sql` into the SQL editor and run it.

---

## 2. Local env (~30s)

```bash
cp .env.example .env
# Fill in:
#   DATABASE_URL=postgresql://neondb_owner:...@ep-..-pooler.../neondb?sslmode=require
#   FBI_API_KEY=...        (optional for pilot — UK doesn't need it)
```

---

## 3. Install + smoke test (~1 min)

```bash
npm install
npm run smoke
```

What `npm run smoke` does:

1. Ingests UK Police data for London (~1000 incidents from the most recent month).
2. Scores GB across r7/r9/r11 (single SQL CTE — fast).
3. Calls the `/api/safety-tiles` handler in-process for a London bbox and prints a sample feature.

Expected ending:

```
OK — pipeline is alive end-to-end.
```

If it fails the error tells you which step. Common issues:

- `Missing DATABASE_URL` → step 2 not done.
- `relation "crime_incidents" does not exist` → schema not applied in step 1.
- `crime-last-updated HTTP 503` → transient data.police.uk blip; retry.

---

## 4. Optional: hit the endpoints from a browser (local)

```bash
npx netlify dev
```

Then:

- <http://localhost:8888/api/safety-tiles?bbox=-0.51,51.28,0.34,51.69&resolution=9>
- POST a Mapbox Directions LineString to <http://localhost:8888/api/route-safety-check>

`netlify dev` reads `.env` automatically and applies the `netlify.toml` redirects.

---

## 5. Deploy to Netlify

The `wiley-fox.netlify.app` site already exists. To push the code:

```bash
npm install -g netlify-cli
netlify login
netlify link --id da04da9b-ff4d-49bd-8ba8-e0d997577f88
netlify deploy --build --prod
```

The env var `DATABASE_URL` is already set on the Netlify side — your local `.env` doesn't ship with the build, Netlify reads its own copy at function runtime.

If you need to set or update env vars from CLI:

```bash
netlify env:set DATABASE_URL    'postgresql://...'
netlify env:set FBI_API_KEY     '...'
netlify env:set ACLED_API_KEY   '...'
netlify env:set ACLED_EMAIL     'barry14wilson@gmail.com'
netlify deploy --prod
```

---

## 6. Verify the live deploy

```bash
SITE=https://wiley-fox.netlify.app

# 1. /api/safety-tiles should return scored cells in the bbox
curl "$SITE/api/safety-tiles?bbox=-0.51,51.28,0.34,51.69&resolution=9" | jq '.features | length'

# 2. trigger the UK ingest manually (don't wait for the daily cron)
curl -X POST "$SITE/.netlify/functions/scheduled-uk"

# 3. confirm pipeline_logs in Neon (SQL editor):
#    select source, records_fetched, records_inserted, errors, run_at
#    from pipeline_logs order by run_at desc limit 5;
```

The scheduled functions will start running on the cadence in `netlify.toml` (UK + MX daily, US/EU/AU/CA weekly, others monthly).

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Missing DATABASE_URL` | `.env` not loaded; check you're running from repo root. |
| `relation "crime_incidents" does not exist` | Schema not applied in Neon. Run the migration SQL. |
| `password authentication failed` | Connection string copied incorrectly — paste exactly from Neon's "Connect" panel. |
| All features come back `band: "green"` | Distribution too narrow — run more connectors before scoring. |
| Endpoint returns `400 bad bbox` | Order is `minLng,minLat,maxLng,maxLat` (any corner order accepted, but lat/lng must not be swapped). |
| Functions log `connect ETIMEDOUT` | Likely Netlify outbound networking blip; retry. Long-lived issues mean the Neon pooled URL needs refreshing. |

The connector + scorer both write to `pipeline_logs` — that's the first place to look when something's off.
