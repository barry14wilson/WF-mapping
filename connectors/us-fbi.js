// us-fbi.js — FBI Crime Data Explorer connector.
// API: https://api.usa.gov/crime/fbi/cde (free key required, signup at
// https://api.data.gov/signup/).
//
// The FBI API publishes annual aggregates per reporting agency, not
// individual incidents. We store one row per (agency, offense, year) and
// use `incident_count` to carry the published total — so the scoring
// engine can SUM(incident_count) and treat aggregate sources fairly
// against street-level sources like UK Police.
//
// Idempotent: source_record_id = `${ori}|${offense}|${year}`.

import 'dotenv/config';

import { isDryRun } from '../lib/db.js';
import { upsertIncidents } from '../lib/upsert.js';
import { indexLatLng } from '../lib/h3.js';
import { categoriseFBI } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';

const SOURCE_API = 'us-fbi';
const SOURCE_COUNTRY = 'US';
const BASE = 'https://api.usa.gov/crime/fbi/cde';
const BATCH_SIZE = 500;

const DEFAULT_STATES = ['NY', 'CA', 'TX', 'IL', 'AZ', 'FL', 'PA', 'OH'];
const AGENCIES_PER_STATE = 25; // top N by population — keeps the run bounded.

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function currentYearWindow() {
  // FBI data lags ~1 year. Default to the two most recently completed years.
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

async function fbiFetch(path) {
  const key = process.env.FBI_API_KEY;
  if (!key) throw new Error('FBI_API_KEY is not set');
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}API_KEY=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FBI ${path} → HTTP ${res.status}`);
  return res.json();
}

async function listAgencies(state) {
  // Returns agencies for the state. Shape:
  // { results: [{ ori, agency_name, latitude, longitude, population, ... }] }
  const json = await fbiFetch(`/agencies/byStateAbbr/${state}`);
  const list = Array.isArray(json) ? json : json.results || [];
  return list
    .filter((a) => a.latitude && a.longitude)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, AGENCIES_PER_STATE);
}

async function agencyOffenses({ ori, year }) {
  // Returns { offenses: [{ key: 'robbery', value: 1234 }, ...] } or similar.
  // The exact shape varies; we normalise both array-of-objects and
  // dictionary forms below.
  const json = await fbiFetch(
    `/summarized/agencies/${ori}/offenses/${year}/${year}`,
  );
  return json;
}

function extractOffenseTotals(payload) {
  // The CDE summarized endpoint can return either:
  //   { offenses: { robbery: 123, burglary: 456, ... } }
  //   { results: [{ offense: 'robbery', actual: 123 }, ...] }
  // Normalise both into [{ offense, count }].
  const out = [];

  if (payload && typeof payload.offenses === 'object' && !Array.isArray(payload.offenses)) {
    for (const [offense, count] of Object.entries(payload.offenses)) {
      const n = Number(count);
      if (Number.isFinite(n) && n > 0) out.push({ offense, count: n });
    }
    return out;
  }

  const rows = Array.isArray(payload) ? payload : payload?.results || [];
  for (const r of rows) {
    const offense = r.offense || r.key || r.crime_type;
    const count = Number(r.actual ?? r.value ?? r.count ?? 0);
    if (offense && Number.isFinite(count) && count > 0) {
      out.push({ offense, count });
    }
  }
  return out;
}

function buildRow({ agency, offense, count, year }) {
  const lat = Number(agency.latitude);
  const lng = Number(agency.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    source_country: SOURCE_COUNTRY,
    source_api: SOURCE_API,
    source_record_id: `${agency.ori}|${offense}|${year}`,
    crime_type: offense,
    severity_category: categoriseFBI(offense),
    incident_count: Math.max(1, Math.round(count)),
    lat,
    lng,
    incident_date: `${year}-01-01`,
    ...indexLatLng(lat, lng),
  };
}

export async function run({ states, years } = {}) {
  const targetStates = states || parseListEnv('US_STATES', DEFAULT_STATES);
  const targetYears =
    years ||
    parseListEnv('US_YEARS', null)?.map(Number) ||
    currentYearWindow();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  console.log(
    `[us-fbi] states=${targetStates.join(',')} years=${targetYears.join(',')} dryRun=${isDryRun()}`,
  );

  for (const state of targetStates) {
    let agencies;
    try {
      agencies = await listAgencies(state);
    } catch (err) {
      const msg = `agencies ${state}: ${err.message}`;
      console.error(`[us-fbi] ${msg}`);
      errors.push(msg);
      continue;
    }

    for (const agency of agencies) {
      for (const year of targetYears) {
        try {
          const payload = await agencyOffenses({ ori: agency.ori, year });
          const totals = extractOffenseTotals(payload);
          fetched += totals.length;

          const rows = totals
            .map((t) => buildRow({ agency, offense: t.offense, count: t.count, year }))
            .filter((r) => r !== null);

          inserted += await upsertIncidents(rows, { batchSize: BATCH_SIZE });
        } catch (err) {
          const msg = `${agency.ori} ${year}: ${err.message}`;
          console.error(`[us-fbi] ${msg}`);
          errors.push(msg);
        }
      }
    }

    console.log(`[us-fbi] ${state} done — ${agencies.length} agencies`);
  }

  await logPipelineRun({
    source: SOURCE_API,
    recordsFetched: fetched,
    recordsInserted: inserted,
    errors: errors.length ? errors.join('; ') : null,
  });

  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => {
      console.log('[us-fbi] done', r);
      process.exit(r.errors.length ? 1 : 0);
    })
    .catch((err) => {
      console.error('[us-fbi] fatal', err);
      process.exit(1);
    });
}
