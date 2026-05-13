// worldbank-global.js — World Bank homicide-rate fallback.
// Indicator VC.IHR.PSRC.P5 — intentional homicides per 100,000 people.
// API: https://api.worldbank.org/v2/country/all/indicator/VC.IHR.PSRC.P5
// Free, no key, annual cadence.
//
// Stores the *rate* converted to an absolute count using the country's
// population (from our static table), so it joins cleanly with other
// connectors that publish absolute counts.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';
import { COUNTRIES } from '../lib/country-data.js';

const SOURCE_API = 'worldbank-global';
const INDICATOR = 'VC.IHR.PSRC.P5'; // Intentional homicides (per 100k people)
const BASE = 'https://api.worldbank.org/v2';

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function defaultYears() {
  const y = new Date().getUTCFullYear();
  return [y - 3, y - 2, y - 1];
}

async function fetchPage({ years, page = 1 }) {
  const dateRange = `${Math.min(...years)}:${Math.max(...years)}`;
  const url =
    `${BASE}/country/all/indicator/${INDICATOR}` +
    `?date=${dateRange}&format=json&per_page=2000&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`);
  return res.json();
}

export async function run({ years } = {}) {
  const targetYears =
    years ||
    parseListEnv('WORLDBANK_YEARS', null)?.map(Number) ||
    defaultYears();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  let allObs = [];
  try {
    let page = 1;
    while (true) {
      const res = await fetchPage({ years: targetYears, page });
      const meta = Array.isArray(res) ? res[0] : null;
      const data = Array.isArray(res) ? res[1] : [];
      allObs = allObs.concat(data || []);
      if (!meta || page >= (meta.pages || 1)) break;
      page++;
    }
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
  for (const obs of allObs) {
    fetched++;
    const rate = Number(obs.value);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    const iso = obs.countryiso3code
      ? iso3ToIso2(obs.countryiso3code)
      : obs.country?.id;
    const centroid = iso && COUNTRIES[iso];
    if (!centroid) continue;

    const year = Number(obs.date);
    if (!Number.isFinite(year) || !targetYears.includes(year)) continue;

    // rate is per 100k → absolute = rate * (population / 100k)
    const absolute = Math.max(1, Math.round((rate * centroid.population) / 1e5));

    rows.push({
      source_country: iso,
      source_api: SOURCE_API,
      source_record_id: `${iso}|homicide|${year}`,
      crime_type: 'intentional-homicide',
      severity_category: 'violent',
      incident_count: absolute,
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

  console.log(`[worldbank-global] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

// Minimal ISO-3 → ISO-2 for the countries in our static table. Anything
// outside the table is skipped (the connector is a fallback so missing
// rows are expected).
const ISO3_TO_ISO2 = {
  AUT: 'AT', BEL: 'BE', BGR: 'BG', HRV: 'HR', CYP: 'CY', CZE: 'CZ', DNK: 'DK',
  EST: 'EE', FIN: 'FI', FRA: 'FR', DEU: 'DE', GRC: 'GR', HUN: 'HU', IRL: 'IE',
  ITA: 'IT', LVA: 'LV', LTU: 'LT', LUX: 'LU', MLT: 'MT', NLD: 'NL', POL: 'PL',
  PRT: 'PT', ROU: 'RO', SVK: 'SK', SVN: 'SI', ESP: 'ES', SWE: 'SE', ISL: 'IS',
  NOR: 'NO', CHE: 'CH', GBR: 'GB', USA: 'US', CAN: 'CA', MEX: 'MX', BRA: 'BR',
  ARG: 'AR', COL: 'CO', CHL: 'CL', PER: 'PE', AUS: 'AU', NZL: 'NZ', JPN: 'JP',
  KOR: 'KR', CHN: 'CN', IND: 'IN', IDN: 'ID', THA: 'TH', VNM: 'VN', PHL: 'PH',
  SGP: 'SG', ZAF: 'ZA', NGA: 'NG', KEN: 'KE', EGY: 'EG', MAR: 'MA', ARE: 'AE',
  SAU: 'SA', TUR: 'TR', ISR: 'IL', RUS: 'RU', UKR: 'UA',
};
function iso3ToIso2(iso3) {
  return ISO3_TO_ISO2[iso3] ?? null;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[worldbank-global] fatal', err);
      process.exit(1);
    });
}
