// mexico-hoyodecrimen.js — hoyodecrimen.com Mexico City crime data.
// API: https://hoyodecrimen.com/api/v1 (free, no key, monthly cadence).
// Returns crime totals per cuadrante (police district) per month.
// Each cuadrante has its own centroid lat/lng.

import 'dotenv/config';

import { indexLatLng } from '../lib/h3.js';
import { categoriseMX } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';

const SOURCE_API = 'mexico-hoyodecrimen';
const SOURCE_COUNTRY = 'MX';
const BASE = 'https://hoyodecrimen.com/api/v1';

const DEFAULT_CRIMES = [
  'HOMICIDIO%20DOLOSO',
  'ROBO%20DE%20VEHICULO%20CON%20VIOLENCIA',
  'ROBO%20A%20TRANSEUNTE%20EN%20VIA%20PUBLICA%20CON%20Y%20SIN%20VIOLENCIA',
  'ROBO%20A%20CASA%20HABITACION%20CON%20VIOLENCIA',
  'VIOLACION',
  'SECUESTRO',
];

function parseListEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function fetchCuadrantes() {
  const res = await fetch(`${BASE}/cuadrantes`);
  if (!res.ok) throw new Error(`hoyodecrimen cuadrantes HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json.rows || [];
}

async function fetchCuadranteCrimes({ cuadrante, crime }) {
  // /cuadrantes/{cuadrante}/crimes/{crime}/period returns monthly counts.
  const url = `${BASE}/cuadrantes/${encodeURIComponent(cuadrante)}/crimes/${crime}/period`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hoyodecrimen ${cuadrante} ${crime} HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json.rows || [];
}

function cuadranteCentroid(c) {
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    return { lat: c.lat, lng: c.lng };
  }
  if (c.geometry?.coordinates && c.geometry.type === 'Polygon') {
    const ring = c.geometry.coordinates[0] || [];
    let sumLat = 0, sumLng = 0;
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
  }
  return null;
}

export async function run({ crimes } = {}) {
  const targetCrimes = crimes || parseListEnv('MX_CRIMES', DEFAULT_CRIMES);

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  let cuadrantes;
  try {
    cuadrantes = await fetchCuadrantes();
  } catch (err) {
    errors.push(`cuadrantes: ${err.message}`);
    await logPipelineRun({
      source: SOURCE_API,
      recordsFetched: 0,
      recordsInserted: 0,
      errors: errors.join('; '),
    });
    return { fetched: 0, inserted: 0, errors };
  }

  console.log(
    `[mexico-hoyodecrimen] cuadrantes=${cuadrantes.length} crimes=${targetCrimes.length}`,
  );

  // The API enumerates per-cuadrante per-crime — be conservative for the
  // pilot. Cap to a sample and let the env override it.
  const cap = Number(process.env.MX_MAX_CUADRANTES) || 200;
  const sampleCuadrantes = cuadrantes.slice(0, cap);

  const rows = [];
  for (const c of sampleCuadrantes) {
    const centroid = cuadranteCentroid(c);
    if (!centroid) continue;
    const cuadranteId = c.cuadrante || c.id;
    if (!cuadranteId) continue;

    for (const crime of targetCrimes) {
      try {
        const periods = await fetchCuadranteCrimes({ cuadrante: cuadranteId, crime });
        for (const p of periods) {
          fetched++;
          const count = Number(p.count ?? p.value ?? 0);
          if (!count || count <= 0) continue;
          const month = String(p.date || p.month || '').slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(month)) continue;

          rows.push({
            source_country: SOURCE_COUNTRY,
            source_api: SOURCE_API,
            source_record_id: `${cuadranteId}|${crime}|${month}`,
            crime_type: decodeURIComponent(crime),
            severity_category: categoriseMX(decodeURIComponent(crime)),
            incident_count: Math.max(1, Math.round(count)),
            lat: centroid.lat,
            lng: centroid.lng,
            incident_date: `${month}-01`,
            ...indexLatLng(centroid.lat, centroid.lng),
          });
        }
      } catch (err) {
        errors.push(`${cuadranteId}/${crime}: ${err.message}`);
      }
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

  console.log(`[mexico-hoyodecrimen] fetched=${fetched} upserted=${inserted}`);
  return { fetched, inserted, errors };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run()
    .then((r) => process.exit(r.errors.length ? 1 : 0))
    .catch((err) => {
      console.error('[mexico-hoyodecrimen] fatal', err);
      process.exit(1);
    });
}
