// One-off: seed synthetic crimes around London, run the scorer,
// verify the safety-tiles endpoint. Useful when the data.police.uk
// API is unreachable from the current network (cloud-IP blocks).
//
// All rows use source_api='synthetic-seed' so they're trivially deletable:
//   delete from crime_incidents where source_api = 'synthetic-seed';

import 'dotenv/config';

import { upsertIncidents } from '../lib/upsert.js';
import { indexLatLng } from '../lib/h3.js';
import { scoreCountry } from '../scoring/scoring-engine.js';
import { handler as safetyTiles } from '../netlify/functions/safety-tiles.js';

const CATEGORIES = [
  { type: 'violent-crime',          sev: 'violent',  weight: 3 },
  { type: 'robbery',                sev: 'violent',  weight: 2 },
  { type: 'sexual-offences',        sev: 'sexual',   weight: 1 },
  { type: 'burglary',               sev: 'property', weight: 4 },
  { type: 'vehicle-crime',          sev: 'property', weight: 3 },
  { type: 'anti-social-behaviour',  sev: 'asb',      weight: 5 },
];

// 10 distinct points across London — gives the scorer enough variety to
// distribute bands across the percentile thresholds.
const POINTS = [
  { name: 'Westminster',       lat: 51.4994, lng: -0.1245 },
  { name: 'Camden',            lat: 51.5390, lng: -0.1426 },
  { name: 'Tower Hamlets',     lat: 51.5099, lng: -0.0059 },
  { name: 'Hackney',           lat: 51.5450, lng: -0.0553 },
  { name: 'Southwark',         lat: 51.5035, lng: -0.0804 },
  { name: 'Kensington',        lat: 51.4988, lng: -0.1749 },
  { name: 'Lambeth',           lat: 51.4961, lng: -0.1090 },
  { name: 'Greenwich',         lat: 51.4825, lng:  0.0076 },
  { name: 'Hammersmith',       lat: 51.4927, lng: -0.2235 },
  { name: 'Islington',         lat: 51.5410, lng: -0.1027 },
];

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function buildRows() {
  const rows = [];
  let seq = 0;
  for (let p = 0; p < POINTS.length; p++) {
    const point = POINTS[p];
    // Vary number of incidents per point — the first point gets the most,
    // last point gets the fewest. Gives the percentile thresholds something
    // to work with.
    const count = 12 - p;
    for (let i = 0; i < count; i++) {
      const cat = CATEGORIES[i % CATEGORIES.length];
      // Mix recency: half within 3 months, a quarter within 3-12 months,
      // a quarter within 1-3 years.
      const mod = i % 4;
      const ageDays = mod < 2 ? 30 + i * 2 : mod === 2 ? 180 + i * 5 : 500 + i * 10;
      const lat = point.lat + (i % 3 - 1) * 0.0008; // tiny jitter for distinct H3 r11 cells
      const lng = point.lng + (i % 3 - 1) * 0.0008;
      rows.push({
        source_country: 'GB',
        source_api: 'synthetic-seed',
        source_record_id: `seed-${p}-${i}`,
        crime_type: cat.type,
        severity_category: cat.sev,
        incident_count: cat.weight,
        lat,
        lng,
        incident_date: daysAgo(ageDays),
        ...indexLatLng(lat, lng),
      });
      seq++;
    }
  }
  return rows;
}

async function main() {
  const rows = buildRows();
  console.log(`Seeding ${rows.length} synthetic incidents across ${POINTS.length} London points`);

  const inserted = await upsertIncidents(rows);
  console.log(`→ upserted ${inserted} rows`);

  console.log('\nScoring GB…');
  const score = await scoreCountry({ country: 'GB' });
  console.log(`→ ${score.cells} cells scored across r7/r9/r11`);

  console.log('\nGET /api/safety-tiles for London bbox…');
  const res = await safetyTiles({
    queryStringParameters: {
      bbox: '-0.51,51.28,0.34,51.69',
      resolution: '9',
    },
  });
  if (res.statusCode !== 200) {
    console.error(`endpoint ${res.statusCode}: ${res.body}`);
    process.exit(1);
  }
  const body = JSON.parse(res.body);
  console.log(`→ ${body.features.length} features returned`);

  // Band distribution snapshot.
  const dist = {};
  for (const f of body.features) {
    dist[f.properties.band] = (dist[f.properties.band] || 0) + 1;
  }
  console.log('→ band distribution:', dist);
  if (body.features[0]) {
    const f = body.features[0];
    console.log('→ sample:', {
      h3: f.properties.h3,
      band: f.properties.band,
      score: f.properties.score,
      color: f.properties.color,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
