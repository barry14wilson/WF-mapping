import { test } from 'node:test';
import assert from 'node:assert/strict';

import { iterJsonStat } from '../lib/jsonstat.js';

// Small fixture mimicking Eurostat's crim_off_cat shape:
//   geo: 2 countries (BE, DE)
//   iccs: 2 offences (0101, 0501)
//   time: 2 years
//   unit: 1 (NR)
// → 8 total cells, row-major over [geo, iccs, time, unit].
function buildFixture() {
  return {
    id: ['geo', 'iccs', 'time', 'unit'],
    size: [2, 2, 2, 1],
    dimension: {
      geo:  { category: { index: { BE: 0, DE: 1 } } },
      iccs: { category: { index: { '0101': 0, '0501': 1 } } },
      time: { category: { index: ['2022', '2023'] } }, // array-style
      unit: { category: { index: { NR: 0 } } },
    },
    value: {
      0: 11, // BE 0101 2022 NR
      1: 12, // BE 0101 2023 NR
      2: 13, // BE 0501 2022 NR
      3: 14, // BE 0501 2023 NR
      4: 21, // DE 0101 2022 NR
      5: 22, // DE 0101 2023 NR
      6: 23, // DE 0501 2022 NR
      7: 24, // DE 0501 2023 NR
    },
  };
}

test('iterJsonStat decodes row-major flat values', () => {
  const rows = Array.from(iterJsonStat(buildFixture()));
  assert.equal(rows.length, 8);

  const find = (geo, iccs, time) =>
    rows.find((r) => r.geo === geo && r.iccs === iccs && r.time === time);

  assert.equal(find('BE', '0101', '2022').value, 11);
  assert.equal(find('BE', '0501', '2023').value, 14);
  assert.equal(find('DE', '0101', '2022').value, 21);
  assert.equal(find('DE', '0501', '2023').value, 24);
});

test('iterJsonStat skips null/undefined values', () => {
  const fx = buildFixture();
  delete fx.value[3]; // BE 0501 2023
  fx.value[5] = null; // DE 0101 2023
  const rows = Array.from(iterJsonStat(fx));
  assert.equal(rows.length, 6);
});

test('iterJsonStat handles array-style category.index', () => {
  // Ensure the time dimension's array form was respected.
  const rows = Array.from(iterJsonStat(buildFixture()));
  const years = new Set(rows.map((r) => r.time));
  assert.deepEqual([...years].sort(), ['2022', '2023']);
});

test('iterJsonStat handles empty / malformed payload safely', () => {
  assert.deepEqual(Array.from(iterJsonStat(null)), []);
  assert.deepEqual(Array.from(iterJsonStat({})), []);
});
