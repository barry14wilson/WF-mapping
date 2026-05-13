import { getSql, isDryRun } from './db.js';

const DEFAULT_BATCH = 500;

const COLUMNS = [
  'source_country', 'source_api', 'source_record_id', 'crime_type',
  'severity_category', 'incident_count', 'lat', 'lng',
  'h3_index_r7', 'h3_index_r9', 'h3_index_r11', 'incident_date',
];

function buildUpsertSql(rowCount) {
  const placeholders = [];
  for (let i = 0; i < rowCount; i++) {
    const base = i * COLUMNS.length;
    const tuple = COLUMNS.map((_, c) => `$${base + c + 1}`).join(', ');
    placeholders.push(`(${tuple})`);
  }
  return (
    `insert into crime_incidents (${COLUMNS.join(', ')}) values\n` +
    placeholders.join(',\n') +
    `\non conflict (source_api, source_record_id) do update set
  crime_type = excluded.crime_type,
  severity_category = excluded.severity_category,
  incident_count = excluded.incident_count,
  lat = excluded.lat,
  lng = excluded.lng,
  h3_index_r7 = excluded.h3_index_r7,
  h3_index_r9 = excluded.h3_index_r9,
  h3_index_r11 = excluded.h3_index_r11,
  incident_date = excluded.incident_date,
  ingested_at = now()`
  );
}

function flatten(rows) {
  const out = new Array(rows.length * COLUMNS.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const base = i * COLUMNS.length;
    for (let c = 0; c < COLUMNS.length; c++) {
      out[base + c] = r[COLUMNS[c]] ?? null;
    }
  }
  return out;
}

export async function upsertIncidents(rows, { batchSize = DEFAULT_BATCH } = {}) {
  if (!rows.length) return 0;

  if (isDryRun()) {
    console.log(`[dry-run] would upsert ${rows.length} rows; sample:`, rows[0]);
    return rows.length;
  }

  const sql = getSql();
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const text = buildUpsertSql(batch.length);
    const params = flatten(batch);
    await sql.query(text, params);
    inserted += batch.length;
  }

  return inserted;
}
