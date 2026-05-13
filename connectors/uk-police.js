// uk-police.js — data.police.uk connector.
// Free API, no key required. Returns street-level lat/lng, monthly cadence.
// Covers England, Wales & Northern Ireland. Scotland is NOT covered by
// data.police.uk and is deferred per the project briefing.
//
// Idempotent: upserts on (source_api, source_record_id). Re-running the
// same month is safe.

import 'dotenv/config';
import crypto from 'node:crypto';

import { getSupabase, isDryRun } from '../lib/supabase.js';
import { indexLatLng } from '../lib/h3.js';
import { categoriseUK } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';

const SOURCE_API = 'uk-police';
const SOURCE_COUNTRY = 'GB';
const BASE = 'https://data.police.uk/api';
const BATCH_SIZE = 500;

// 10 priority cities from the briefing. The API returns crimes within a
// ~1-mile radius of each point — together these cover the population
// centres we care about for the pilot.
const DEFAULT_AREAS = [
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
  { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
  { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
  { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
  { name: 'Newcastle', lat: 54.9783, lng: -1.6178 },
  { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
  { name: 'Belfast', lat: 54.5973, lng: -5.9301 },
  { name: 'Brighton', lat: 50.8225, lng: -0.1372 },
];

function parseAreasFromEnv() {
  // UK_AREAS="lat,lng;lat,lng;..."
  const raw = process.env.UK_AREAS;
  if (!raw) return DEFAULT_AREAS;
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair, i) => {
      const [lat, lng] = pair.split(',').map(Number);
      return { name: `custom-${i}`, lat, lng };
    });
}

async function fetchLatestAvailableMonth() {
  const res = await fetch(`${BASE}/crime-last-updated`);
  if (!res.ok) throw new Error(`crime-last-updated failed: ${res.status}`);
  const json = await res.json();
  // Returns e.g. { "date": "2026-02-01" } → use YYYY-MM.
  return String(json.date).slice(0, 7);
}

async function fetchCrimesForArea({ lat, lng, date }) {
  const url =
    `${BASE}/crimes-street/all-crime` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lng=${encodeURIComponent(lng)}` +
    `&date=${encodeURIComponent(date)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`area ${lat},${lng} ${date} → HTTP ${res.status}`);
  return res.json();
}

function syntheticId(record) {
  // Fallback when persistent_id is missing. Hash of the natural key.
  const key = [
    record.category,
    record.location?.latitude,
    record.location?.longitude,
    record.month,
    record.location?.street?.id ?? '',
  ].join('|');
  return 'syn_' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 24);
}

function normaliseRecord(raw) {
  const lat = Number(raw.location?.latitude);
  const lng = Number(raw.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // raw.month is "YYYY-MM" → use first of the month as the incident date.
  const incidentDate = raw.month ? `${raw.month}-01` : null;
  const id = raw.persistent_id && raw.persistent_id.length > 0
    ? raw.persistent_id
    : syntheticId(raw);

  return {
    source_country: SOURCE_COUNTRY,
    source_api: SOURCE_API,
    source_record_id: id,
    crime_type: raw.category,
    severity_category: categoriseUK(raw.category),
    incident_count: 1,
    lat,
    lng,
    incident_date: incidentDate,
    ...indexLatLng(lat, lng),
  };
}

async function upsertBatch(rows) {
  if (rows.length === 0) return 0;
  if (isDryRun()) {
    console.log(`[dry-run] would upsert ${rows.length} rows; sample:`, rows[0]);
    return rows.length;
  }
  const { error, count } = await getSupabase()
    .from('crime_incidents')
    .upsert(rows, {
      onConflict: 'source_api,source_record_id',
      count: 'exact',
      ignoreDuplicates: false,
    });
  if (error) throw error;
  return count ?? rows.length;
}

export async function run({ date, areas } = {}) {
  const targetDate = date || (await fetchLatestAvailableMonth());
  const targetAreas = areas || parseAreasFromEnv();

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  console.log(
    `[uk-police] date=${targetDate} areas=${targetAreas.length} dryRun=${isDryRun()}`,
  );

  for (const area of targetAreas) {
    try {
      const raw = await fetchCrimesForArea({ ...area, date: targetDate });
      fetched += raw.length;

      const rows = raw
        .map(normaliseRecord)
        .filter((r) => r !== null);

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        inserted += await upsertBatch(batch);
      }

      console.log(
        `[uk-police] ${area.name ?? `${area.lat},${area.lng}`} ` +
          `fetched=${raw.length} upserted=${rows.length}`,
      );
    } catch (err) {
      const msg = `${area.name ?? area.lat + ',' + area.lng}: ${err.message}`;
      console.error(`[uk-police] ${msg}`);
      errors.push(msg);
    }
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
      console.log('[uk-police] done', r);
      process.exit(r.errors.length ? 1 : 0);
    })
    .catch((err) => {
      console.error('[uk-police] fatal', err);
      process.exit(1);
    });
}
