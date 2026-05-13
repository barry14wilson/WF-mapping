import { test } from 'node:test';
import assert from 'node:assert/strict';

import { indexLatLng, RESOLUTIONS } from '../lib/h3.js';

test('indexLatLng produces all three resolutions', () => {
  const idx = indexLatLng(51.5074, -0.1278); // London
  assert.equal(typeof idx.h3_index_r7, 'string');
  assert.equal(typeof idx.h3_index_r9, 'string');
  assert.equal(typeof idx.h3_index_r11, 'string');
  assert.notEqual(idx.h3_index_r7, idx.h3_index_r9);
  assert.notEqual(idx.h3_index_r9, idx.h3_index_r11);
});

test('indexLatLng is deterministic', () => {
  const a = indexLatLng(40.7128, -74.0060);
  const b = indexLatLng(40.7128, -74.0060);
  assert.deepEqual(a, b);
});

test('indexLatLng returns nulls for invalid input', () => {
  assert.deepEqual(indexLatLng(NaN, 0),       { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null });
  assert.deepEqual(indexLatLng(0, NaN),       { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null });
  assert.deepEqual(indexLatLng('a', 'b'),     { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null });
  assert.deepEqual(indexLatLng(undefined, 0), { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null });
});

test('exported RESOLUTIONS matches the schema', () => {
  assert.deepEqual(RESOLUTIONS, [7, 9, 11]);
});
