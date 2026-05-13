import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCountry } from '../scoring/scoring-engine.js';
import { __setClientForTests } from '../lib/supabase.js';
import { makeMockSupabase } from './_utils.js';

// Synthesise N incidents spread across distinct H3 cells. Cell 0 gets
// the most incidents, cell N-1 the fewest — gives the percentile bands
// something to differentiate.
function buildIncidents(count) {
  const today = new Date();
  const recentIso = today.toISOString().slice(0, 10);
  const incidents = [];
  for (let cell = 0; cell < count; cell++) {
    const reps = count - cell; // monotonic decreasing
    for (let r = 0; r < reps; r++) {
      incidents.push({
        severity_category: r % 4 === 0 ? 'violent' : 'property',
        incident_count: 1,
        incident_date: recentIso,
        h3_index_r7: `r7-cell-${cell}`,
        h3_index_r9: `r9-cell-${cell}`,
        h3_index_r11: `r11-cell-${cell}`,
      });
    }
  }
  return incidents;
}

test('scoreCountry produces scores and bands per resolution', async () => {
  const incidents = buildIncidents(20);
  const upserted = [];

  const supabase = makeMockSupabase({
    'crime_incidents:select': ({ args }) => {
      const isRangeFollowup = args.some(([op]) => op === 'range');
      if (!isRangeFollowup) return { data: [], error: null };
      // Return everything on the first page, then empty on subsequent ones.
      const rangeArgs = args.find(([op]) => op === 'range')[1];
      if (rangeArgs[0] === 0) return { data: incidents, error: null };
      return { data: [], error: null };
    },
    'h3_safety_scores:upsert': ({ args }) => {
      const [, [rows]] = args.find(([op]) => op === 'upsert');
      upserted.push(...rows);
      return { count: rows.length, error: null };
    },
  });
  __setClientForTests(supabase);

  const result = await scoreCountry({ country: 'GB' });
  assert.equal(result.country, 'GB');
  assert.ok(result.cells > 0, 'should write some cells');

  // Every row should have score, band, h3_index, resolution.
  for (const row of upserted) {
    assert.equal(typeof row.h3_index, 'string');
    assert.ok([7, 9, 11].includes(row.resolution));
    assert.ok(['green', 'amber', 'red', 'purple'].includes(row.band));
    assert.ok(row.score >= 0 && row.score <= 100, `score in range, got ${row.score}`);
    assert.equal(row.source_country, 'GB');
  }

  // Bands should span at least two values across a 20-cell distribution.
  const bands = new Set(upserted.map((r) => r.band));
  assert.ok(bands.size >= 2, `expected multi-band distribution, got ${[...bands]}`);

  // Within a single resolution, the cell with the most incidents
  // (r9-cell-0) should land in the upper bands (red/purple).
  const topCell = upserted.find(
    (r) => r.resolution === 9 && r.h3_index === 'r9-cell-0',
  );
  assert.ok(topCell, 'top cell present');
  assert.ok(['red', 'purple'].includes(topCell.band), `top cell band: ${topCell.band}`);
});

test('scoreCountry handles empty incidents gracefully', async () => {
  const supabase = makeMockSupabase({
    'crime_incidents:select': () => ({ data: [], error: null }),
  });
  __setClientForTests(supabase);

  const result = await scoreCountry({ country: 'ZZ' });
  assert.deepEqual(result, { country: 'ZZ', cells: 0 });
});
