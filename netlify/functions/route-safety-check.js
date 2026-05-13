// POST /api/route-safety-check
//
// Body: a GeoJSON Feature<LineString> from Mapbox Directions, or
// { lineString: Feature<LineString>, resolution?: 7|9|11 }.
//
// Returns the result of lib/route-safety-check.js#checkRouteSafety.

import { checkRouteSafety } from '../../lib/route-safety-check.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'POST required' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'invalid JSON body' });
  }

  const lineString = body.lineString || body;
  const resolution = Number(body.resolution) || 9;

  try {
    const result = await checkRouteSafety({ lineString, resolution });
    return jsonResponse(200, result);
  } catch (err) {
    return jsonResponse(400, { error: err.message });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
