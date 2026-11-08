// us-houston-hpd.js — Houston Police Department NIBRS incident data.
// Source: https://houstontx.gov/police/cs/Monthly_Crime_Data_by_Street_and_Police_Beat.htm
// One CSV per year (NIBRSPublicView<YEAR>.csv, 14–35 MB), one row per offence
// with hundred-block street, beat, premise and map lat/lng. Free, no key,
// updated monthly (HPD posts 1–4 weeks after month end).
//
// Each run ingests the newest HOU_MONTHS months that hold data (default 2),
// so late-reported offences are picked up; upserts make re-runs safe.
// Group A offences only — Group B (90x, arrest-only) and 09C (justifiable
// homicide, not a crime) are skipped, matching the map's NIBRS rule.

import 'dotenv/config';

import { isDryRun } from '../lib/db.js';
import { indexLatLng } from '../lib/h3.js';
import { categoriseNIBRS } from '../lib/normalise.js';
import { logPipelineRun } from '../lib/pipeline-log.js';
import { upsertIncidents } from '../lib/upsert.js';

const SOURCE_API = 'us-houston-hpd';
const SOURCE_COUNTRY = 'US';
const BASE = 'https://houstontx.gov/police/cs/xls/NIBRSPublicView';
const BATCH_SIZE = 500;

// Minimal RFC 4180 line parser (HPD quotes fields that contain commas).
export function parseCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const v = parseCsvLine(l);
    const o = {};
    head.forEach((h, i) => { o[h] = v[i]; });
    return o;
  });
}

export function normaliseHPD(rows, months) {
  const keep = new Set(months);
  const byId = new Map();
  for (const r of rows) {
    const date = r['Occurrence Date'] || '';
    if (!keep.has(date.slice(0, 7))) continue;
    const code = (r['NIBRS Class'] || '').trim().toUpperCase();
    if (!code || code.startsWith('90') || code === '09C') continue;
    const lat = Number(r['Map Latitude']);
    const lng = Number(r['Map Longitude']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) continue;
    const id = `${r.Incident}-${code}`;
    const count = Math.max(1, Number(r['Offense Count']) || 1);
    const prev = byId.get(id);
    if (prev) { prev.incident_count += count; continue; }
    byId.set(id, {
      source_country: SOURCE_COUNTRY,
      source_api: SOURCE_API,
      source_record_id: id,
      crime_type: `${code} ${(r['NIBRS Description'] || '').trim()}`.trim(),
      severity_category: categoriseNIBRS(code),
      incident_count: count,
      lat,
      lng,
      incident_date: date.slice(0, 10),
      ...indexLatLng(lat, lng),
    });
  }
  return [...byId.values()];
}

// The newest n months that actually hold data. HPD's file can lag the
// calendar by several months, so we follow the data rather than today's date.
export function latestMonths(rows, n) {
  const counts = new Map();
  for (const r of rows) {
    const m = (r['Occurrence Date'] || '').slice(0, 7);
    if (m) counts.set(m, (counts.get(m) || 0) + 1);
  }
  return [...counts.keys()].filter((m) => counts.get(m) > 100).sort().slice(-n);
}

async function fetchYear(year) {
  const res = await fetch(`${BASE}${year}.csv`, { headers: { 'User-Agent': 'WileyFox-pipeline' } });
  if (!res.ok) throw new Error(`HPD ${year} CSV HTTP ${res.status}`);
  return parseCsv(await res.text());
}

export async function run({ months: nMonths } = {}) {
  const n = nMonths || Number(process.env.HOU_MONTHS) || 2;
  const year = new Date().getUTCFullYear();
  let fetched = 0, inserted = 0;
  const errors = [];
  console.log(`[us-houston-hpd] last ${n} months with data, dryRun=${isDryRun()}`);

  let raw = [];
  for (const y of [year, year - 1]) {
    try {
      raw = (await fetchYear(y)).concat(raw);
    } catch (err) {
      console.error(`[us-houston-hpd] ${y}: ${err.message}`);
      errors.push(`${y}: ${err.message}`);
    }
    if (latestMonths(raw, n).length >= n) break; // early in a year, fall back to last year's file too
  }
  fetched = raw.length;
  const months = latestMonths(raw, n);
  try {
    const rows = normaliseHPD(raw, months);
    inserted = await upsertIncidents(rows, { batchSize: BATCH_SIZE });
    console.log(`[us-houston-hpd] months=${months.join(',')} csv rows=${raw.length} upserted=${rows.length}`);
  } catch (err) {
    console.error(`[us-houston-hpd] upsert: ${err.message}`);
    errors.push(`upsert: ${err.message}`);
  }

  await logPipelineRun({
    source: SOURCE_API,
    recordsFetched: fetched,
    recordsInserted: inserted,
    errors: errors.length ? errors.join('; ') : null,
  });
  return { months, fetched, inserted, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((r) => console.log(r)).catch((e) => { console.error(e); process.exit(1); });
}
