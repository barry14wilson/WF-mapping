import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handler } from '../netlify/functions/route-safety-check.js';

test('route-safety-check rejects non-POST', async () => {
  const res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('route-safety-check rejects invalid JSON', async () => {
  const res = await handler({ httpMethod: 'POST', body: 'not-json' });
  assert.equal(res.statusCode, 400);
});

test('route-safety-check rejects a body that is not a LineString feature', async () => {
  const res = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } }),
  });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /LineString/);
});
