import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latLngToCell } from 'h3-js';

import { handler } from '../netlify/functions/safety-tiles.js';
import { __setSqlForTests } from '../lib/db.js';
import { makeMockSql } from './_utils.js';

function call(qs) {
  return handler({ queryStringParameters: qs });
}

test('safety-tiles rejects requests without bbox or h3', async () => {
  __setSqlForTests(makeMockSql({}));
  const res = await call({});
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.match(body.error, /bbox|h3/);
});

test('safety-tiles rejects an invalid resolution', async () => {
  __setSqlForTests(makeMockSql({}));
  const res = await call({ bbox: '-0.5,51.3,0.3,51.7', resolution: '12' });
  assert.equal(res.statusCode, 400);
});

test('safety-tiles returns a FeatureCollection from h3 cells', async () => {
  const realCell = latLngToCell(51.5074, -0.1278, 9);
  const fakeRow = {
    h3_index: realCell,
    resolution: 9,
    score: '42.50',
    band: 'amber',
  };

  __setSqlForTests(makeMockSql({
    'h3_safety_scores': () => [fakeRow],
  }));

  const res = await call({ h3: fakeRow.h3_index, resolution: '9' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.type, 'FeatureCollection');
  assert.equal(body.features.length, 1);
  const f = body.features[0];
  assert.equal(f.type, 'Feature');
  assert.equal(f.geometry.type, 'Polygon');
  assert.equal(f.properties.band, 'amber');
  assert.equal(f.properties.color, '#F39C12');
  assert.equal(f.properties.h3, fakeRow.h3_index);
  assert.equal(f.properties.resolution, 9);
  assert.equal(f.properties.score, 42.5);
});

test('safety-tiles parses bbox in any corner order', async () => {
  __setSqlForTests(makeMockSql({ 'h3_safety_scores': () => [] }));
  const res = await call({ bbox: '0.3,51.7,-0.5,51.3', resolution: '7' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.type, 'FeatureCollection');
});

test('safety-tiles returns empty FeatureCollection when no h3 / bbox cells', async () => {
  __setSqlForTests(makeMockSql({}));
  const res = await call({ h3: '   ' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepEqual(body, { type: 'FeatureCollection', features: [] });
});
