// GET /api/safety-tiles
//
// Query params (one of):
//   bbox=minLng,minLat,maxLng,maxLat     bounding box (any order accepted)
//   h3=cell1,cell2,...                   explicit list of H3 cells
//
// Optional:
//   resolution=7|9|11                    default 9
//   bands=red,purple                     filter to specific bands
//
// Returns a GeoJSON FeatureCollection. Each feature is the H3 cell's
// hexagonal boundary with properties { h3, score, band, color, resolution }.

import { cellToBoundary, polygonToCells, latLngToCell } from 'h3-js';

import { getSql } from '../../lib/db.js';
import { colourFor } from '../../lib/bands.js';

const ALLOWED_RES = new Set([7, 9, 11]);
const DEFAULT_RES = 9;
const MAX_CELLS_PER_QUERY = 5000;

function parseBbox(raw) {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d] = parts;
  const minLng = Math.min(a, c);
  const maxLng = Math.max(a, c);
  const minLat = Math.min(b, d);
  const maxLat = Math.max(b, d);
  return { minLat, minLng, maxLat, maxLng };
}

function bboxToCells(bbox, resolution) {
  // Build a closed polygon ring (lat, lng pairs as h3-js expects in v4).
  const ring = [
    [bbox.minLat, bbox.minLng],
    [bbox.minLat, bbox.maxLng],
    [bbox.maxLat, bbox.maxLng],
    [bbox.maxLat, bbox.minLng],
    [bbox.minLat, bbox.minLng],
  ];
  let cells;
  try {
    cells = polygonToCells([ring], resolution, false);
  } catch {
    cells = [];
  }
  // Fallback: always include the four corners if polygonToCells returned
  // nothing (very small / degenerate bboxes near the poles).
  if (!cells.length) {
    cells = [
      latLngToCell(bbox.minLat, bbox.minLng, resolution),
      latLngToCell(bbox.minLat, bbox.maxLng, resolution),
      latLngToCell(bbox.maxLat, bbox.minLng, resolution),
      latLngToCell(bbox.maxLat, bbox.maxLng, resolution),
    ];
  }
  return cells.slice(0, MAX_CELLS_PER_QUERY);
}

function cellToFeature({ h3_index, resolution, score, band }) {
  const boundary = cellToBoundary(h3_index, true); // [lng, lat] pairs
  // Close the ring.
  const ring = boundary.concat([boundary[0]]);
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      h3: h3_index,
      resolution,
      score: score == null ? null : Number(score),
      band,
      color: colourFor(band),
    },
  };
}

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const resolution = Number(qs.resolution) || DEFAULT_RES;
  if (!ALLOWED_RES.has(resolution)) {
    return jsonResponse(400, { error: `resolution must be one of ${[...ALLOWED_RES].join(', ')}` });
  }

  let cells = [];
  if (qs.h3) {
    cells = qs.h3.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_CELLS_PER_QUERY);
  } else if (qs.bbox) {
    const bbox = parseBbox(qs.bbox);
    if (!bbox) return jsonResponse(400, { error: 'bad bbox; want minLng,minLat,maxLng,maxLat' });
    cells = bboxToCells(bbox, resolution);
  } else {
    return jsonResponse(400, { error: 'provide either ?bbox= or ?h3=' });
  }

  if (!cells.length) {
    return jsonResponse(200, { type: 'FeatureCollection', features: [] });
  }

  const bandFilter = qs.bands ? qs.bands.split(',').map((s) => s.trim()).filter(Boolean) : null;

  let rows;
  try {
    const sql = getSql();
    if (bandFilter?.length) {
      rows = await sql.query(
        `select h3_index, resolution, score, band
         from h3_safety_scores
         where resolution = $1
           and h3_index = any($2::text[])
           and band = any($3::text[])`,
        [resolution, cells, bandFilter],
      );
    } else {
      rows = await sql.query(
        `select h3_index, resolution, score, band
         from h3_safety_scores
         where resolution = $1
           and h3_index = any($2::text[])`,
        [resolution, cells],
      );
    }
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }

  const features = rows.map(cellToFeature);
  return jsonResponse(200, { type: 'FeatureCollection', features });
};

function jsonResponse(statusCode, body) {
  const cacheable = statusCode >= 200 && statusCode < 300;
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheable ? 'public, max-age=60' : 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
