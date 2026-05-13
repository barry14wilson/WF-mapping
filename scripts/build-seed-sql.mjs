// Generates the SQL for the synthetic London seed. Used when we have
// management-plane (MCP / SQL editor) access but cannot reach the
// project's REST API from the current host.
//
// Output: SQL statement(s) ready to paste into the Supabase SQL editor.

import { indexLatLng } from '../lib/h3.js';

const CATEGORIES = [
  { type: 'violent-crime',         sev: 'violent',  weight: 3 },
  { type: 'robbery',               sev: 'violent',  weight: 2 },
  { type: 'sexual-offences',       sev: 'sexual',   weight: 1 },
  { type: 'burglary',              sev: 'property', weight: 4 },
  { type: 'vehicle-crime',         sev: 'property', weight: 3 },
  { type: 'anti-social-behaviour', sev: 'asb',      weight: 5 },
];

const POINTS = [
  { name: 'Westminster',   lat: 51.4994, lng: -0.1245 },
  { name: 'Camden',        lat: 51.5390, lng: -0.1426 },
  { name: 'Tower Hamlets', lat: 51.5099, lng: -0.0059 },
  { name: 'Hackney',       lat: 51.5450, lng: -0.0553 },
  { name: 'Southwark',     lat: 51.5035, lng: -0.0804 },
  { name: 'Kensington',    lat: 51.4988, lng: -0.1749 },
  { name: 'Lambeth',       lat: 51.4961, lng: -0.1090 },
  { name: 'Greenwich',     lat: 51.4825, lng:  0.0076 },
  { name: 'Hammersmith',   lat: 51.4927, lng: -0.2235 },
  { name: 'Islington',     lat: 51.5410, lng: -0.1027 },
];

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const rows = [];
for (let p = 0; p < POINTS.length; p++) {
  const point = POINTS[p];
  const count = 12 - p;
  for (let i = 0; i < count; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const mod = i % 4;
    const ageDays = mod < 2 ? 30 + i * 2 : mod === 2 ? 180 + i * 5 : 500 + i * 10;
    const lat = point.lat + (i % 3 - 1) * 0.0008;
    const lng = point.lng + (i % 3 - 1) * 0.0008;
    const h3 = indexLatLng(lat, lng);
    rows.push([
      q('GB'),                              // source_country
      q('synthetic-seed'),                  // source_api
      q(`seed-${p}-${i}`),                  // source_record_id
      q(cat.type),                          // crime_type
      q(cat.sev),                           // severity_category
      cat.weight,                           // incident_count
      lat.toFixed(6),
      lng.toFixed(6),
      q(h3.h3_index_r7),
      q(h3.h3_index_r9),
      q(h3.h3_index_r11),
      q(daysAgo(ageDays)),
    ]);
  }
}

const values = rows
  .map((r) => `  (${r.join(', ')})`)
  .join(',\n');

const sql =
  `insert into crime_incidents (
  source_country, source_api, source_record_id, crime_type,
  severity_category, incident_count, lat, lng,
  h3_index_r7, h3_index_r9, h3_index_r11, incident_date
) values\n${values}
on conflict (source_api, source_record_id) do update set
  crime_type = excluded.crime_type,
  severity_category = excluded.severity_category,
  incident_count = excluded.incident_count,
  lat = excluded.lat,
  lng = excluded.lng,
  h3_index_r7 = excluded.h3_index_r7,
  h3_index_r9 = excluded.h3_index_r9,
  h3_index_r11 = excluded.h3_index_r11,
  incident_date = excluded.incident_date,
  ingested_at = now();`;

console.log(sql);
