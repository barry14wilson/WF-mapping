// scoring-engine.js — Phase 4 of the Wiley Fox pipeline.
//
// Aggregates crime_incidents per (source_country, resolution, h3_index),
// computes the four-term score, and upserts h3_safety_scores.
//
// All the heavy lifting is done in Postgres in one statement. Each H3
// resolution is processed in the same CTE chain via UNION ALL.
//
// Score formula (per spec):
//   score = (volume × 0.30)
//         + (severity_weighted × 0.35)
//         + (recency_weighted × 0.20)
//         + (population_normalised × 0.15)
//
// All four terms are min-max normalised to [0,100] within each
// (source_country, resolution) cohort so the weighted sum is comparable
// across sources. Bands are assigned by percentile within the same
// cohort: <70 green, 70–85 amber, 85–95 red, >95 purple.

import 'dotenv/config';

import { getSql, isDryRun } from '../lib/db.js';
import { COUNTRIES } from '../lib/country-data.js';

const SCORE_SQL = `
with country_pop(country, population) as (
  values %COUNTRY_POPS%
),
severity_weight(category, weight) as (
  values ('violent', 3), ('sexual', 4), ('property', 1), ('asb', 1)
),
incidents_long as (
  select source_country, h3_index_r7 as h3, 7::smallint as resolution,
         incident_count, severity_category, incident_date
  from crime_incidents where h3_index_r7 is not null
  union all
  select source_country, h3_index_r9, 9::smallint,
         incident_count, severity_category, incident_date
  from crime_incidents where h3_index_r9 is not null
  union all
  select source_country, h3_index_r11, 11::smallint,
         incident_count, severity_category, incident_date
  from crime_incidents where h3_index_r11 is not null
),
cell_metrics as (
  select i.source_country, i.h3, i.resolution,
         sum(i.incident_count)::numeric as volume,
         sum(i.incident_count * s.weight)::numeric as severity_weighted,
         sum(i.incident_count * (
           case
             when i.incident_date is null then 0
             when current_date - i.incident_date <= 90 then 2
             when current_date - i.incident_date <= 365 then 1
             when current_date - i.incident_date <= 365 * 3 then 0.5
             else 0
           end
         ))::numeric as recency_weighted
  from incidents_long i
  join severity_weight s on s.category = i.severity_category
  where ($1::text is null or i.source_country = $1)
  group by i.source_country, i.h3, i.resolution
),
with_pop as (
  select cm.*, (cm.volume / cp.population::numeric) * 100000 as population_normalised
  from cell_metrics cm
  join country_pop cp on cp.country = cm.source_country
),
normalised as (
  select w.*,
    case when max(w.volume) over part = min(w.volume) over part then 0
         else (w.volume - min(w.volume) over part) * 100
              / nullif(max(w.volume) over part - min(w.volume) over part, 0) end as v_norm,
    case when max(w.severity_weighted) over part = min(w.severity_weighted) over part then 0
         else (w.severity_weighted - min(w.severity_weighted) over part) * 100
              / nullif(max(w.severity_weighted) over part - min(w.severity_weighted) over part, 0) end as s_norm,
    case when max(w.recency_weighted) over part = min(w.recency_weighted) over part then 0
         else (w.recency_weighted - min(w.recency_weighted) over part) * 100
              / nullif(max(w.recency_weighted) over part - min(w.recency_weighted) over part, 0) end as r_norm,
    case when max(w.population_normalised) over part = min(w.population_normalised) over part then 0
         else (w.population_normalised - min(w.population_normalised) over part) * 100
              / nullif(max(w.population_normalised) over part - min(w.population_normalised) over part, 0) end as p_norm
  from with_pop w
  window part as (partition by w.source_country, w.resolution)
),
scored as (
  select source_country, h3, resolution,
         (0.30 * v_norm + 0.35 * s_norm + 0.20 * r_norm + 0.15 * p_norm)::numeric as score
  from normalised
),
percentiles as (
  select source_country, resolution,
         percentile_cont(0.70) within group (order by score) as t70,
         percentile_cont(0.85) within group (order by score) as t85,
         percentile_cont(0.95) within group (order by score) as t95
  from scored
  group by source_country, resolution
),
banded as (
  select s.source_country, s.h3, s.resolution, s.score,
    case when s.score >= p.t95 then 'purple'
         when s.score >= p.t85 then 'red'
         when s.score >= p.t70 then 'amber'
         else 'green' end as band
  from scored s
  join percentiles p using (source_country, resolution)
)
insert into h3_safety_scores (h3_index, resolution, score, band, source_country, last_calculated_at)
select h3, resolution, round(score, 2), band, source_country, now()
from banded
on conflict (h3_index, resolution) do update set
  score = excluded.score,
  band = excluded.band,
  source_country = excluded.source_country,
  last_calculated_at = excluded.last_calculated_at
`;

function buildCountryPopValues() {
  return Object.entries(COUNTRIES)
    .map(([iso, c]) => `('${iso}', ${c.population})`)
    .join(', ');
}

export async function scoreCountry({ country } = {}) {
  if (!country) throw new Error('scoreCountry requires a country code');
  if (isDryRun()) {
    console.log(`[dry-run] would score country=${country}`);
    return { country, cells: 0 };
  }
  const sql = getSql();
  const text = SCORE_SQL.replace('%COUNTRY_POPS%', buildCountryPopValues());
  await sql.query(text, [country]);
  const [{ cells }] = await sql.query(
    `select count(*)::int as cells from h3_safety_scores where source_country = $1`,
    [country],
  );
  console.log(`[scoring] ${country}: ${cells} cells in h3_safety_scores`);
  return { country, cells };
}

export async function scoreAll() {
  if (isDryRun()) {
    console.log('[dry-run] would score all countries');
    return [];
  }
  const sql = getSql();
  const text = SCORE_SQL.replace('%COUNTRY_POPS%', buildCountryPopValues());
  await sql.query(text, [null]);

  const rows = await sql.query(
    `select source_country as country, count(*)::int as cells
     from h3_safety_scores group by source_country order by source_country`,
  );
  for (const r of rows) console.log(`[scoring] ${r.country}: ${r.cells} cells`);
  return rows;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const arg = process.argv[2];
  const promise = arg ? scoreCountry({ country: arg }) : scoreAll();
  promise
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[scoring] fatal', err);
      process.exit(1);
    });
}
