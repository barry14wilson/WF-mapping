import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { run } from '../connectors/uk-police.js';
import { __setSqlForTests } from '../lib/db.js';
import { makeMockSql, mockFetch, restoreFetch } from './_utils.js';

const SAMPLE_CRIMES = [
  {
    category: 'violent-crime',
    persistent_id: 'p-1',
    month: '2026-02',
    location: { latitude: '51.5074', longitude: '-0.1278', street: { id: 9000, name: 'Strand' } },
  },
  {
    category: 'anti-social-behaviour',
    persistent_id: '', // forces synthetic id fallback
    month: '2026-02',
    location: { latitude: '51.5080', longitude: '-0.1300', street: { id: 9001, name: 'Aldwych' } },
  },
  {
    category: 'bicycle-theft',
    persistent_id: 'p-3',
    month: '2026-02',
    location: { latitude: 'NaN', longitude: '-0.1300' }, // dropped — bad lat
  },
];

let originalDryRun;

beforeEach(() => {
  originalDryRun = process.env.DRY_RUN;
});

afterEach(() => {
  restoreFetch();
  if (originalDryRun === undefined) delete process.env.DRY_RUN;
  else process.env.DRY_RUN = originalDryRun;
});

test('uk-police connector normalises and upserts in dry-run', async () => {
  process.env.DRY_RUN = '1';

  mockFetch([
    { json: { date: '2026-02-01' } },
    { json: SAMPLE_CRIMES },
  ]);
  __setSqlForTests(makeMockSql({}));

  const result = await run({ areas: [{ name: 'London', lat: 51.5074, lng: -0.1278 }] });

  assert.equal(result.fetched, SAMPLE_CRIMES.length, 'fetched count from API');
  assert.equal(result.inserted, 2, 'two valid rows upserted (third has bad lat)');
  assert.equal(result.errors.length, 0);
});

test('uk-police gracefully tolerates an area failing', async () => {
  process.env.DRY_RUN = '1';

  mockFetch([
    { json: { date: '2026-02-01' } },
    { ok: false, status: 503, json: { error: 'too busy' } },
    { json: SAMPLE_CRIMES.slice(0, 1) },
  ]);
  __setSqlForTests(makeMockSql({}));

  const result = await run({
    areas: [
      { name: 'London',     lat: 51.5074, lng: -0.1278 },
      { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
    ],
  });

  assert.equal(result.errors.length, 1, 'one area failed');
  assert.equal(result.inserted, 1, 'the other area still ingested');
});
