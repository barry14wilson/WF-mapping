// Phase 7 — Route safety check.
//
// Given a Mapbox Directions LineString, find segments that cross
// Red or Purple H3 cells and suggest waypoints that re-route around them.
//
// Usage:
//   import { checkRouteSafety } from '../lib/route-safety-check.js';
//   const result = await checkRouteSafety({ lineString, resolution: 9 });
//   // → { flaggedSegments: [...], suggestedWaypoints: [...] }
//
// The "suggested waypoint" for a flagged segment is the centroid of the
// nearest neighbouring green/amber cell to the flagged cell. It's a v1
// heuristic — better routing would replan via Mapbox Directions with
// avoid polygons, which the caller can do once it has these hints.

import * as turf from '@turf/turf';
import {
  cellToBoundary,
  cellToLatLng,
  gridRingUnsafe,
  latLngToCell,
} from 'h3-js';

import { getSupabase } from './supabase.js';

const FLAGGED_BANDS = new Set(['red', 'purple']);
const DEFAULT_RES = 9;
const NEIGHBOUR_RINGS = 2;

function lineBbox(line) {
  return turf.bbox(line); // [minLng, minLat, maxLng, maxLat]
}

function cellPolygon(h3) {
  const boundary = cellToBoundary(h3, true); // [lng, lat] pairs
  const ring = boundary.concat([boundary[0]]);
  return turf.polygon([ring], { h3 });
}

// Walk the line, sampling one H3 cell per ~50m, and dedupe. This gives
// us the candidate cells we need to query without scanning the whole
// country.
function cellsAlongLine(line, resolution, sampleMeters = 50) {
  const length = turf.length(line, { units: 'meters' });
  const steps = Math.max(1, Math.ceil(length / sampleMeters));
  const seen = new Set();
  for (let i = 0; i <= steps; i++) {
    const along = turf.along(line, (i / steps) * length, { units: 'meters' });
    const [lng, lat] = along.geometry.coordinates;
    seen.add(latLngToCell(lat, lng, resolution));
  }
  return Array.from(seen);
}

async function fetchScoresFor(cells, resolution) {
  if (!cells.length) return new Map();
  const supabase = getSupabase();
  const out = new Map();
  // Chunked IN queries — Supabase caps at ~1000 items per `in()`.
  const chunkSize = 500;
  for (let i = 0; i < cells.length; i += chunkSize) {
    const chunk = cells.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('h3_safety_scores')
      .select('h3_index, score, band')
      .eq('resolution', resolution)
      .in('h3_index', chunk);
    if (error) throw error;
    for (const row of data || []) out.set(row.h3_index, row);
  }
  return out;
}

function suggestWaypoint(flaggedCell, scores) {
  // Walk outward in rings until we find a green/amber neighbour, then
  // return its centroid as the suggestion.
  for (let r = 1; r <= NEIGHBOUR_RINGS; r++) {
    const ring = gridRingUnsafe(flaggedCell, r) || [];
    for (const candidate of ring) {
      const sc = scores.get(candidate);
      if (sc && !FLAGGED_BANDS.has(sc.band)) {
        const [lat, lng] = cellToLatLng(candidate);
        return { h3: candidate, lat, lng, band: sc.band };
      }
    }
  }
  return null;
}

export async function checkRouteSafety({ lineString, resolution = DEFAULT_RES } = {}) {
  if (!lineString || lineString.type !== 'Feature' || lineString.geometry?.type !== 'LineString') {
    throw new Error('lineString must be a GeoJSON Feature<LineString>');
  }
  if (![7, 9, 11].includes(resolution)) {
    throw new Error('resolution must be 7, 9 or 11');
  }

  const candidates = cellsAlongLine(lineString, resolution);
  const scores = await fetchScoresFor(candidates, resolution);

  // Also pre-load neighbour scores so suggestion lookups don't issue
  // extra DB calls per flagged cell.
  const neighbourSet = new Set();
  for (const cell of candidates) {
    for (let r = 1; r <= NEIGHBOUR_RINGS; r++) {
      for (const n of gridRingUnsafe(cell, r) || []) neighbourSet.add(n);
    }
  }
  const neighboursToFetch = Array.from(neighbourSet).filter((c) => !scores.has(c));
  const neighbourScores = await fetchScoresFor(neighboursToFetch, resolution);
  for (const [k, v] of neighbourScores) scores.set(k, v);

  const flaggedSegments = [];
  const suggestedWaypoints = [];
  const seenSuggestions = new Set();

  for (const cell of candidates) {
    const sc = scores.get(cell);
    if (!sc || !FLAGGED_BANDS.has(sc.band)) continue;

    const polygon = cellPolygon(cell);
    const intersection = turf.lineIntersect(lineString, polygon);
    let segment = null;
    if (intersection.features.length >= 2) {
      // Use the two outermost intersection points to bound the segment.
      const pts = intersection.features.map((f) => f.geometry.coordinates);
      segment = {
        h3: cell,
        band: sc.band,
        score: Number(sc.score),
        from: pts[0],
        to: pts[pts.length - 1],
      };
    } else {
      // Line starts or ends inside the cell — record the centroid as the marker.
      const [lat, lng] = cellToLatLng(cell);
      segment = {
        h3: cell,
        band: sc.band,
        score: Number(sc.score),
        from: [lng, lat],
        to: [lng, lat],
      };
    }
    flaggedSegments.push(segment);

    const suggestion = suggestWaypoint(cell, scores);
    if (suggestion && !seenSuggestions.has(suggestion.h3)) {
      seenSuggestions.add(suggestion.h3);
      suggestedWaypoints.push({ avoidH3: cell, ...suggestion });
    }
  }

  return {
    resolution,
    bbox: lineBbox(lineString),
    cellsChecked: candidates.length,
    flaggedSegments,
    suggestedWaypoints,
  };
}
