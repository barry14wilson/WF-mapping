import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCountry, scoreAll } from '../scoring/scoring-engine.js';
import { __setSqlForTests } from '../lib/db.js';
import { makeMockSql } from './_utils.js';

test('scoreCountry runs the score CTE and returns a row count', async () => {
  const sql = makeMockSql({
    'insert into h3_safety_scores': () => [],
    'count(*)::int as cells': () => [{ cells: 42 }],
  });
  __setSqlForTests(sql);

  const result = await scoreCountry({ country: 'GB' });
  assert.deepEqual(result, { country: 'GB', cells: 42 });

  // Should have issued exactly two queries: the upsert + the count.
  assert.equal(sql.__calls.length, 2);
  const insertCall = sql.__calls[0];
  assert.match(insertCall.text, /insert into h3_safety_scores/i);
  assert.deepEqual(insertCall.params, ['GB']);
});

test('scoreCountry requires a country', async () => {
  __setSqlForTests(makeMockSql({}));
  await assert.rejects(() => scoreCountry({}), /requires a country/);
});

test('scoreAll runs the unscoped CTE and returns per-country counts', async () => {
  const sql = makeMockSql({
    'insert into h3_safety_scores': () => [],
    'group by source_country': () => [
      { country: 'GB', cells: 12 },
      { country: 'US', cells: 8 },
    ],
  });
  __setSqlForTests(sql);

  const rows = await scoreAll();
  assert.deepEqual(rows, [
    { country: 'GB', cells: 12 },
    { country: 'US', cells: 8 },
  ]);

  // The score CTE should have been called with country=null (score all).
  const insertCall = sql.__calls[0];
  assert.match(insertCall.text, /insert into h3_safety_scores/i);
  assert.deepEqual(insertCall.params, [null]);
});
