// unodc-global.js — UNODC global crime fallback.
// dataunodc.un.org publishes country-level annual crime statistics as
// downloadable CSV. The exact URL changes year to year, so it's
// configurable via UNODC_HOMICIDE_URL.
//
// The connector parses a CSV with the columns:
//   Country, Region, Subregion, Indicator, Dimension, Category,
//   Sex, Age, Year, Unit, Value, Source
//
// And focuses on intentional homicide counts as the global baseline. It
// fills gaps for countries that aren't covered by the higher-fidelity
// connectors. Each row lands at the country centroid.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';
import { COUNTRIES } from '../lib/country-data.js';

const SOURCE_API = 'unodc-global';
const DEFAULT_URL =
  'https://dataunodc.un.org/sites/dataunodc.un.org/files/data_cts_intentional_homicide.csv';

// Country name → ISO-2 mapping for the common cases we serve. UNODC uses
// English country names rather than ISO codes.
const NAME_TO_ISO = Object.fromEntries(
  Object.entries(COUNTRIES).map(([iso, c]) => [c.name.toLowerCase(), iso]),
);
const NAME_ALIASES = {
  'united states of america': 'US',
  'russian federation': 'RU',
  'republic of korea': 'KR',
  'czech republic': 'CZ',
  'iran (islamic republic of)': 'IR',
  'viet nam': 'VN',
  'syrian arab republic': 'SY',
  'united republic of tanzania': 'TZ',
};

function lookupIso(name) {
  if (!name) return null;
  const lower = String(name).trim().toLowerCase();
  return NAME_ALIASES[lower] || NAME_TO_ISO[lower] || null;
}

// Very small CSV parser sufficient for UNODC's well-behaved CSVs.
// Handles double-quoted fields with embedded commas.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body
    .filter((r) => r.length === keys.length)
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}

export async function run({ url } = {}) {
  const target = url || process.env.UNODC_HOMICIDE_URL || DEFAULT_URL;
  let fetched = 0;
  let inserted = 0;
  const errors = [];

  let csvText;
  try {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`UNODC HTTP ${res.status}`);
    csvText = await res.text();
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

  const records = rowsToObjects(parseCsv(csvText));
  const rows = [];

  for (const rec of records) {
    fetched++;
    const indicator = (rec.Indicator || rec.indicator || '').toLowerCase();
    if (!indicator.includes('homicide')) continue;

    const unit = (rec.Unit || rec.unit || '').toLowerCase();
    if (!unit.includes('count') && !unit.includes('number')) continue;

    const iso = lookupIso(rec.Country || rec.country);
    if (!iso) continue;
    const centroid = COUNTRIES[iso];
    if (!centroid) continue;

    const year = Number(rec.Year || rec.year);
    if (!Number.isFinite(year)) continue;

    const value = Number(rec.Value || rec.value);
    if (!Number.isFinite(value) || value <= 0) continue;

    rows.push({
      source_country: iso,
      source_api: SOURCE_API,
      source_record_id: `${iso}|homicide|${year}`,
      crime_type: 'intentional-homicide',
      severity_category: 'violent',
      incident_count: Math.max(1, Math.round(value)),
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

  console.log(`[unodc-global] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[unodc-global] fatal', err);
      process.exit(1);
    });
}
