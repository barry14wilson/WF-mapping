# Wiley Fox Pipeline — Deployment Guide

Goal: get the pipeline live so you can hit `https://<your-site>.netlify.app/api/safety-tiles` from a browser.

You don't need to deploy to Netlify to verify the pipeline works end-to-end. Steps 1–4 stand it up locally against a real Supabase project; steps 5–6 are only needed for a public URL.

---

## 1. Supabase project (~5 min)

1. Go to <https://supabase.com/dashboard>, **New project** (free tier is fine for the pilot).
2. Once provisioned, open the **SQL editor** and paste the entire contents of:

   ```
   supabase/migrations/20260513000000_initial_schema.sql
   ```

   Run it. You should see `crime_incidents`, `h3_safety_scores`, `pipeline_logs` in the Tables view.

3. From **Settings → API**, copy:
   - Project URL → goes to `SUPABASE_URL`
   - `service_role` key (NOT the `anon` key) → goes to `SUPABASE_SERVICE_ROLE_KEY`

   The service role bypasses RLS, which is what the connectors need. Keep it server-side only; never expose it to the browser.

---

## 2. Local env (~2 min)

```bash
cp .env.example .env
# Open .env and fill in:
#   SUPABASE_URL=https://xxxxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   FBI_API_KEY=...           (optional for pilot — UK doesn't need it)
```

Get the FBI key at <https://api.data.gov/signup/> if you want to ingest US data too.

---

## 3. Install + smoke test (~1 min)

```bash
npm install
npm run smoke
```

What `npm run smoke` does:

1. Ingests UK Police data for London (~1000 incidents from the most recent month).
2. Scores GB across r7/r9/r11.
3. Calls the `/api/safety-tiles` handler in-process for a London bbox and prints a sample feature.

Expected output ends with:

```
OK — pipeline is alive end-to-end.
```

If it fails, the error tells you which step. The most common issues:

- `Missing env vars` → step 2 not done.
- `crime-last-updated HTTP …` → transient data.police.uk blip; retry.
- `relation "crime_incidents" does not exist` → migration not applied in step 1.

---

## 4. Optional: hit the endpoints from a browser (local)

```bash
npx netlify dev
```

Then:

- <http://localhost:8888/api/safety-tiles?bbox=-0.51,51.28,0.34,51.69&resolution=9>
- POST a Mapbox Directions LineString to <http://localhost:8888/api/route-safety-check>

`netlify dev` reads `.env` automatically and applies the `netlify.toml` redirects (so `/api/...` works the same as it will in production).

---

## 5. Deploy to Netlify (~5 min — only if you want a public URL)

```bash
# One-time
npm install -g netlify-cli
netlify login
netlify init     # pick: Create & configure a new site; link to this repo
```

Then set the env vars on the Netlify side. Either via dashboard (Site settings → Environment variables) or CLI:

```bash
netlify env:set SUPABASE_URL              https://xxxxx.supabase.co
netlify env:set SUPABASE_SERVICE_ROLE_KEY eyJ...
netlify env:set FBI_API_KEY               ...
netlify env:set ACLED_API_KEY             ...
netlify env:set ACLED_EMAIL               you@example.com
```

Deploy:

```bash
netlify deploy --prod
```

---

## 6. Verify the live deploy

```bash
SITE=https://your-site.netlify.app

curl "$SITE/api/safety-tiles?bbox=-0.51,51.28,0.34,51.69&resolution=9" | jq '.features | length'
# → some positive number (depending on how much data has been ingested)
```

The scheduled functions will start running on the cadence in `netlify.toml` (UK + MX daily, US/EU/AU/CA weekly, others monthly) so the dataset will grow on its own from here.

To trigger one manually instead of waiting:

```bash
curl -X POST "$SITE/.netlify/functions/scheduled-uk"
```

---

## What to test live

Once the smoke test passes and the endpoints respond, useful manual checks:

1. **UK coverage.** `bbox=-0.51,51.28,0.34,51.69&resolution=9` (London). Should return a few hundred green/amber features after the first UK run.
2. **Band distribution.** Add `&bands=red,purple` to the same query. Should return a small subset (the 85th+ percentile cells).
3. **Resolution rollup.** Same bbox at `resolution=7` should return far fewer, larger hexes covering wider areas.
4. **Idempotency.** `npm run connector:uk` again and check `pipeline_logs`:
   ```sql
   select source, records_fetched, records_inserted, errors, run_at
   from pipeline_logs order by run_at desc limit 5;
   ```
   The second run's `records_inserted` should roughly match the first (upserts overwrite, not duplicate). Row count in `crime_incidents` should not grow on the second run.
5. **Route safety check.** POST a small LineString through central London and confirm any red/purple cells along it come back with suggested waypoints.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY` | `.env` not loaded; check you're running from repo root |
| `relation "crime_incidents" does not exist` | Migration not applied in step 1 |
| `permission denied for table crime_incidents` | Using `anon` key instead of `service_role` |
| All features come back `band: "green"` | Distribution is too narrow — run more connectors before scoring |
| Endpoint returns `400 bad bbox` | Order is `minLng,minLat,maxLng,maxLat` (any corner order accepted, but lat/lng must not be swapped) |
| Connector hangs on first request | data.police.uk's `crime-last-updated` is slow occasionally; give it 30s |

If something else breaks, the connector + scorer both write to `pipeline_logs` — that's the first place to look.
