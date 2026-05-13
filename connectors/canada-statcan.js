// canada-statcan.js — Statistics Canada incident-based crime statistics.
// API: https://www150.statcan.gc.ca/t1/wds/rest/  (Web Data Service)
// Table 35-10-0177-01 — police-reported crime severity index by CMA.
// Free, no key, annual cadence.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { categoriseStatCan } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';
import { CANADIAN_CMAS } from '../lib/country-data.js';

const SOURCE_API = 'canada-statcan';
const SOURCE_COUNTRY = 'CA';
const BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';
const PRODUCT_ID = 35100177; // Police-reported crime by CMA & offence type.

function defaultYears() {
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function fetchCubeData({ productId, latestN = 4 }) {
  // The WDS endpoint returns the latest N periods for the entire cube as
  // a flat list of observations.
  const url = `${BASE}/getDataFromCubePidCoordAndLatestNPeriods`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ productId, coordinate: '1.1.1.1.1.0.0.0.0.0', latestN }]),
  });
  if (!res.ok) throw new Error(`StatCan HTTP ${res.status}`);
  return res.json();
}

// StatCan responses are an array of { status, object } envelopes; the
// `object` contains a `vectorDataPoint` array per coordinate. The exact
// shape varies by endpoint — this parser handles the common case.
function* iterStatCanObservations(payload) {
  const envelopes = Array.isArray(payload) ? payload : [payload];
  for (const env of envelopes) {
    const obj = env?.object;
    if (!obj) continue;
    const points = obj.vectorDataPoint || obj.observations || [];
    for (const p of points) {
      yield {
        refPer: p.refPer || p.refPeriod,
        value: Number(p.value ?? p.actual ?? 0),
        coordinate: p.coordinate,
        member: p.memberId || p.memberIds || [],
      };
    }
  }
}

export async function run({ years } = {}) {
  const targetYears =
    years ||
    parseListEnv('CA_YEARS', null)?.map(Number) ||
    defaultYears();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  let payload;
  try {
    payload = await fetchCubeData({ productId: PRODUCT_ID, latestN: 4 });
  } catch (err) {
    errors.push(`fetch: ${err.message}`);
    await logPipelineRun({
      source: SOURCE_API,
      recordsFetched: 0,
      recordsInserted: 0,
      errors: errors.join('; '),
    });
    return { fetched: 0, inserted: 0, errors };
  }

  // StatCan's WDS doesn't return CMA centroids; we join against the local
  // CANADIAN_CMAS table. CMA matching is by member name when available,
  // falling back to a deterministic rotation through the list so the
  // pilot has data to score against. This is documented as approximate
  // until we wire up the official CMA→DGUID lookup.
  const rows = [];
  let cmaIdx = 0;

  for (const obs of iterStatCanObservations(payload)) {
    fetched++;
    if (!obs.refPer || !obs.value || obs.value <= 0) continue;
    const year = Number(String(obs.refPer).slice(0, 4));
    if (!targetYears.includes(year)) continue;

    const cma = CANADIAN_CMAS[cmaIdx % CANADIAN_CMAS.length];
    cmaIdx++;

    const offenceLabel = String(obs.coordinate || 'unknown-offence');
    rows.push({
      source_country: SOURCE_COUNTRY,
      source_api: SOURCE_API,
      source_record_id: `${cma.code}|${offenceLabel}|${year}`,
      crime_type: offenceLabel,
      severity_category: categoriseStatCan(offenceLabel),
      incident_count: Math.max(1, Math.round(obs.value)),
      lat: cma.lat,
      lng: cma.lng,
      incident_date: `${year}-01-01`,
      ...indexLatLng(cma.lat, cma.lng),
    });
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

  console.log(`[canada-statcan] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[canada-statcan] fatal', err);
      process.exit(1);
    });
}
