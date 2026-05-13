// acled-conflict.js — ACLED (Armed Conflict Location & Event Data).
// API: https://api.acleddata.com/acled/read (free research access).
// Requires ACLED_API_KEY and ACLED_EMAIL — sign up at
// https://developer.acleddata.com/.
//
// Each event already has a lat/lng so this is the highest-fidelity of the
// global-scope connectors.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { categoriseACLED } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';

const SOURCE_API = 'acled-conflict';
const BASE = 'https://api.acleddata.com/acled/read';

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function fetchAcled({ country, startDate, key, email, page }) {
  const params = new URLSearchParams({
    key,
    email,
    limit: '5000',
    page: String(page),
    event_date: `${startDate}|${todayIso()}`,
    event_date_where: 'BETWEEN',
    country,
  });
  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`ACLED HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`ACLED error: ${json.error?.message || 'unknown'}`);
  return json.data || [];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoForCountry(country) {
  // ACLED uses English country names; we don't currently maintain a
  // full name → ISO lookup here. The connector stores the country name
  // as source_country for ACLED rows so it round-trips. Phase 2.5
  // upgrade: map to ISO-2 against lib/country-data.js.
  return country?.slice(0, 12) || 'unknown';
}

export async function run({ countries, sinceDays = 180 } = {}) {
  const key = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;
  if (!key || !email) throw new Error('ACLED_API_KEY and ACLED_EMAIL must be set');

  const targetCountries =
    countries || parseListEnv('ACLED_COUNTRIES', ['Mexico', 'Nigeria', 'Ukraine']);
  const startDate = new Date(Date.now() - sinceDays * 86400000)
    .toISOString()
    .slice(0, 10);

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  console.log(
    `[acled-conflict] countries=${targetCountries.join(',')} since=${startDate}`,
  );

  const rows = [];
  for (const country of targetCountries) {
    let page = 1;
    while (true) {
      let batch;
      try {
        batch = await fetchAcled({ country, startDate, key, email, page });
      } catch (err) {
        errors.push(`${country} p${page}: ${err.message}`);
        break;
      }
      if (!batch.length) break;

      for (const ev of batch) {
        fetched++;
        const lat = Number(ev.latitude);
        const lng = Number(ev.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        rows.push({
          source_country: isoForCountry(country),
          source_api: SOURCE_API,
          source_record_id: `acled|${ev.data_id || ev.event_id_cnty}`,
          crime_type: ev.event_type,
          severity_category: categoriseACLED(ev.event_type),
          incident_count: Math.max(1, Number(ev.fatalities) || 1),
          lat,
          lng,
          incident_date: ev.event_date,
          ...indexLatLng(lat, lng),
        });
      }
      if (batch.length < 5000) break;
      page++;
    }
  }

  try {
    inserted = await upsertIncidents(rows);
  } catch (err) {
    errors.push(`upsert: ${err.message}`);
  }

  await logPipelineRun({
    source: SOURCE_API,
    recordsFetched: fetched,
    recordsInserted: inserted,
    errors: errors.length ? errors.join('; ') : null,
  });

  console.log(`[acled-conflict] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[acled-conflict] fatal', err);
      process.exit(1);
    });
}
