// eu-eurostat.js — Eurostat crime statistics (free, no key).
// Dataset: crim_off_cat — police-recorded offences by category, country & year.
// API: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/crim_off_cat
// Format: JSON-stat 2.0.
//
// Granularity is country (NUTS0) — not NUTS2 — for the pilot. NUTS2 is
// patchily available; expand when Barry signs off.
//
// Each row lands at the country centroid with incident_count = published total.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { categoriseICCS } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';
import { COUNTRIES } from '../lib/country-data.js';
import { iterJsonStat } from '../lib/jsonstat.js';

const SOURCE_API = 'eu-eurostat';
const BASE =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/crim_off_cat';

const DEFAULT_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
];

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function defaultYears() {
  const y = new Date().getUTCFullYear();
  return [y - 3, y - 2];
}

async function fetchEurostat({ countries, years }) {
  const params = new URLSearchParams({ format: 'JSON', lang: 'en' });
  countries.forEach((c) => params.append('geo', c));
  years.forEach((y) => params.append('time', String(y)));
  params.append('unit', 'NR'); // absolute number

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`);
  return res.json();
}

export async function run({ countries, years } = {}) {
  const targetCountries =
    countries || parseListEnv('EU_COUNTRIES', DEFAULT_COUNTRIES);
  const targetYears =
    years ||
    parseListEnv('EU_YEARS', null)?.map(Number) ||
    defaultYears();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  console.log(
    `[eu-eurostat] countries=${targetCountries.length} years=${targetYears.join(',')}`,
  );

  let payload;
  try {
    payload = await fetchEurostat({
      countries: targetCountries,
      years: targetYears,
    });
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
  for (const r of iterJsonStat(payload)) {
    fetched++;
    if (!r.value || r.value <= 0) continue;
    const geo = r.geo;
    const iso = geo === 'EL' ? 'GR' : geo === 'UK' ? 'GB' : geo;
    const centroid = COUNTRIES[iso];
    if (!centroid) continue;

    const year = Number(r.time);
    if (!Number.isFinite(year)) continue;

    rows.push({
      source_country: iso,
      source_api: SOURCE_API,
      source_record_id: `${iso}|${r.iccs}|${year}`,
      crime_type: r.iccs,
      severity_category: categoriseICCS(r.iccs),
      incident_count: Math.max(1, Math.round(r.value)),
      lat: centroid.lat,
      lng: centroid.lng,
      incident_date: `${year}-01-01`,
      ...indexLatLng(centroid.lat, centroid.lng),
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

  console.log(`[eu-eurostat] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[eu-eurostat] fatal', err);
      process.exit(1);
    });
}
