// australia-abs.js — Australian Bureau of Statistics, recorded crime by state.
// API: https://api.data.abs.gov.au/data/RECORDED_CRIME_VICTIMS (SDMX-JSON).
// Free, no key. Annual cadence.
//
// State-level for the pilot. SA2 (~1000 areas) would be a richer upgrade —
// the schema already supports it; only the dataflow query string would change.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { categoriseABS } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';
import { AUSTRALIAN_STATES } from '../lib/country-data.js';

const SOURCE_API = 'australia-abs';
const SOURCE_COUNTRY = 'AU';
const BASE = 'https://api.data.abs.gov.au/data';
const DATAFLOW = 'RECORDED_CRIME_VICTIMS';

function defaultYears() {
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// SDMX-JSON 1.0: each observation is keyed by colon-separated dimension
// positions, and dimension definitions live under `structure.dimensions.observation`.
function* iterSdmxObservations(payload) {
  const data = payload?.data ?? payload;
  const dataset = data?.dataSets?.[0];
  if (!dataset) return;

  const dimDefs =
    data?.structure?.dimensions?.observation ??
    data?.structures?.[0]?.dimensions?.observation ??
    [];
  const dimNames = dimDefs.map((d) => d.id);
  const dimValues = dimDefs.map((d) => d.values.map((v) => ({ id: v.id, name: v.name })));

  const series = dataset.observations || dataset.series || {};
  for (const [key, obs] of Object.entries(series)) {
    const parts = key.split(':').map(Number);
    const value = Array.isArray(obs) ? obs[0] : obs;
    const row = { value: Number(value) };
    parts.forEach((pos, idx) => {
      const dim = dimValues[idx]?.[pos];
      if (dim) row[dimNames[idx]] = dim;
    });
    yield row;
  }
}

async function fetchABS({ years }) {
  // Key=. is a "wildcard for all dimensions". `dimensionAtObservation=AllDimensions`
  // flattens the response so each observation is uniquely keyed.
  const startPeriod = Math.min(...years);
  const endPeriod = Math.max(...years);
  const url =
    `${BASE}/${DATAFLOW}/all` +
    `?startPeriod=${startPeriod}&endPeriod=${endPeriod}` +
    `&dimensionAtObservation=AllDimensions&format=jsondata`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.sdmx.data+json' } });
  if (!res.ok) throw new Error(`ABS HTTP ${res.status}`);
  return res.json();
}

function stateFromAbbr(code) {
  // ABS sometimes uses '1'..'8' and sometimes 'NSW','VIC' etc.
  const byCode = AUSTRALIAN_STATES.find((s) => s.code === String(code));
  if (byCode) return byCode;
  const name = String(code).toUpperCase();
  const lookup = {
    NSW: '1', VIC: '2', QLD: '3', SA: '4', WA: '5', TAS: '6', NT: '7', ACT: '8',
  };
  return AUSTRALIAN_STATES.find((s) => s.code === lookup[name]) || null;
}

export async function run({ years } = {}) {
  const targetYears =
    years ||
    parseListEnv('AU_YEARS', null)?.map(Number) ||
    defaultYears();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  let payload;
  try {
    payload = await fetchABS({ years: targetYears });
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

  const rows = [];
  for (const obs of iterSdmxObservations(payload)) {
    fetched++;
    if (!obs.value || obs.value <= 0) continue;

    const regionRef = obs.REGION ?? obs.STATE ?? obs.GEO;
    const offenceRef = obs.OFFENCE ?? obs.MEASURE ?? obs.OFFENCE_GROUP;
    const period = obs.TIME_PERIOD ?? obs.TIME;
    if (!regionRef || !offenceRef || !period) continue;

    const state = stateFromAbbr(regionRef.id);
    if (!state) continue;

    const year = Number(String(period.id).slice(0, 4));
    if (!Number.isFinite(year)) continue;

    const offenceLabel = offenceRef.name || offenceRef.id;
    rows.push({
      source_country: SOURCE_COUNTRY,
      source_api: SOURCE_API,
      source_record_id: `${state.code}|${offenceRef.id}|${year}`,
      crime_type: offenceLabel,
      severity_category: categoriseABS(offenceLabel),
      incident_count: Math.max(1, Math.round(obs.value)),
      lat: state.lat,
      lng: state.lng,
      incident_date: `${year}-01-01`,
      ...indexLatLng(state.lat, state.lng),
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

  console.log(`[australia-abs] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[australia-abs] fatal', err);
      process.exit(1);
    });
}
