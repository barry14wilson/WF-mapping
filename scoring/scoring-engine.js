// scoring-engine.js — Phase 4 of the Wiley Fox pipeline.
//
// Reads crime_incidents, aggregates per (source_country, resolution,
// h3_index), computes the safety score, and writes h3_safety_scores.
//
// Score formula (per spec):
//   score = (volume × 0.30)
//         + (severity_weighted × 0.35)
//         + (recency_weighted × 0.20)
//         + (population_normalised × 0.15)
//
// The four raw terms are on different scales (counts vs rates), so each
// term is min-max normalised to [0, 100] within the (country, resolution)
// cohort before the weighted sum. The combined score is therefore also
// 0–100. Bands then use the 70th / 85th / 95th percentile of the score
// distribution within that cohort:
//
//   < 70th    → green
//   70 – 85th → amber
//   85 – 95th → red
//   > 95th    → purple
//
// Recency weights:
//   last 3 months : 2×
//   3 – 12 months : 1×
//   1 – 3 years   : 0.5×
//   older         : 0×

import 'dotenv/config';

import { getSupabase, isDryRun } from '../lib/supabase.js';
import { SEVERITY_WEIGHTS } from '../lib/normalise.js';
import { COUNTRIES } from '../lib/country-data.js';

const RESOLUTIONS = [7, 9, 11];
const SCORE_WEIGHTS = {
  volume: 0.30,
  severity: 0.35,
  recency: 0.20,
  population: 0.15,
};
const BAND_PERCENTILES = { amber: 70, red: 85, purple: 95 };

function recencyFactor(daysAgo) {
  if (daysAgo < 0) return 1; // future dates are weird; treat as recent
  if (daysAgo <= 90) return 2;
  if (daysAgo <= 365) return 1;
  if (daysAgo <= 365 * 3) return 0.5;
  return 0;
}

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

// Fetch incidents for a country, paginated to avoid the Supabase 1000-row
// default cap.
async function fetchIncidentsForCountry(supabase, country) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('crime_incidents')
      .select(
        'severity_category, incident_count, incident_date, h3_index_r7, h3_index_r9, h3_index_r11',
      )
      .eq('source_country', country)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function listCountries(supabase) {
  const { data, error } = await supabase
    .from('crime_incidents')
    .select('source_country')
    .not('source_country', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.source_country))).filter(Boolean);
}

function aggregateCells(incidents, resolution, today) {
  const key = `h3_index_r${resolution}`;
  const cells = new Map();

  for (const inc of incidents) {
    const h3 = inc[key];
    if (!h3) continue;

    let cell = cells.get(h3);
    if (!cell) {
      cell = { h3, volume: 0, severity: 0, recency: 0 };
      cells.set(h3, cell);
    }
    const count = inc.incident_count ?? 1;
    cell.volume += count;
    cell.severity += count * (SEVERITY_WEIGHTS[inc.severity_category] ?? 1);

    if (inc.incident_date) {
      const days = daysBetween(today, new Date(inc.incident_date));
      cell.recency += count * recencyFactor(days);
    }
  }
  return cells;
}

function minMaxNormalise(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max <= min) return () => 0;
  return (v) => ((v - min) / (max - min)) * 100;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

function scoreToBand(score, thresholds) {
  if (score >= thresholds.purple) return 'purple';
  if (score >= thresholds.red) return 'red';
  if (score >= thresholds.amber) return 'amber';
  return 'green';
}

async function upsertScores(supabase, rows) {
  if (!rows.length) return 0;
  if (isDryRun()) {
    console.log(`[dry-run] would upsert ${rows.length} h3_safety_scores`);
    return rows.length;
  }
  const pageSize = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += pageSize) {
    const batch = rows.slice(i, i + pageSize);
    const { error, count } = await supabase
      .from('h3_safety_scores')
      .upsert(batch, { onConflict: 'h3_index,resolution', count: 'exact' });
    if (error) throw error;
    inserted += count ?? batch.length;
  }
  return inserted;
}

// Re-score a single country across all three resolutions. If `cellFilter`
// is provided, only those cells are written back to h3_safety_scores —
// but the country-wide percentile context is still computed from the
// full set so bands stay consistent.
export async function scoreCountry({ country, cellFilter } = {}) {
  const supabase = getSupabase();
  const today = new Date();
  const popBaseline = COUNTRIES[country]?.population ?? 1_000_000;

  const incidents = await fetchIncidentsForCountry(supabase, country);
  if (!incidents.length) {
    console.log(`[scoring] ${country}: no incidents`);
    return { country, cells: 0 };
  }

  const writeRows = [];

  for (const res of RESOLUTIONS) {
    const cells = aggregateCells(incidents, res, today);
    if (!cells.size) continue;

    // population_normalised: cell volume as a share of country population,
    // expressed per 100k people. Coarser resolutions naturally accumulate
    // more volume, which is why we normalise per (country, resolution).
    const cellList = Array.from(cells.values());
    for (const c of cellList) {
      c.population = (c.volume / popBaseline) * 1e5;
    }

    const volNorm = minMaxNormalise(cellList.map((c) => c.volume));
    const sevNorm = minMaxNormalise(cellList.map((c) => c.severity));
    const recNorm = minMaxNormalise(cellList.map((c) => c.recency));
    const popNorm = minMaxNormalise(cellList.map((c) => c.population));

    for (const c of cellList) {
      c.score =
        volNorm(c.volume) * SCORE_WEIGHTS.volume +
        sevNorm(c.severity) * SCORE_WEIGHTS.severity +
        recNorm(c.recency) * SCORE_WEIGHTS.recency +
        popNorm(c.population) * SCORE_WEIGHTS.population;
    }

    const sortedScores = cellList
      .map((c) => c.score)
      .sort((a, b) => a - b);
    const thresholds = {
      amber: percentile(sortedScores, BAND_PERCENTILES.amber),
      red: percentile(sortedScores, BAND_PERCENTILES.red),
      purple: percentile(sortedScores, BAND_PERCENTILES.purple),
    };

    const filterSet = cellFilter ? new Set(cellFilter) : null;
    for (const c of cellList) {
      if (filterSet && !filterSet.has(c.h3)) continue;
      writeRows.push({
        h3_index: c.h3,
        resolution: res,
        score: Number(c.score.toFixed(2)),
        band: scoreToBand(c.score, thresholds),
        source_country: country,
        last_calculated_at: new Date().toISOString(),
      });
    }
  }

  const written = await upsertScores(supabase, writeRows);
  console.log(`[scoring] ${country}: ${written} cells scored`);
  return { country, cells: written };
}

export async function scoreAll({ countries, cellFilter } = {}) {
  const supabase = getSupabase();
  const targets = countries || (await listCountries(supabase));
  const results = [];
  for (const c of targets) {
    try {
      results.push(await scoreCountry({ country: c, cellFilter }));
    } catch (err) {
      console.error(`[scoring] ${c} failed:`, err.message);
      results.push({ country: c, error: err.message });
    }
  }
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const arg = process.argv[2];
  const promise = arg ? scoreCountry({ country: arg }) : scoreAll();
  promise
    .then((r) => {
      console.log('[scoring] done', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[scoring] fatal', err);
      process.exit(1);
    });
}
