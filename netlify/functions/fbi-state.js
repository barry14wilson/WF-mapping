// GET /api/fbi-state?state=CA
//
// Server-side proxy for the FBI Crime Data Explorer (api.usa.gov/crime/fbi/cde)
// so the API key never ships in public page code. Key comes from the
// FBI_API_KEY environment variable set in Netlify.
//
// Returns the shape the prototype's FBI panel already renders:
//   [{ offense_name, offense_count, data_year }, ...]
// Uses the most recent full calendar year that has data (tries last year,
// then the year before, because FBI publishing lags).

const BASE = 'https://api.usa.gov/crime/fbi/cde';

const OFFENSES = [
  { code: 'V',   name: 'Violent crime' },
  { code: 'HOM', name: 'Homicide' },
  { code: 'RPE', name: 'Rape' },
  { code: 'ROB', name: 'Robbery' },
  { code: 'ASS', name: 'Assault (aggravated)' },
  { code: 'P',   name: 'Property crime' },
  { code: 'BUR', name: 'Burglary' },
  { code: 'LAR', name: 'Theft (larceny)' },
  { code: 'MVT', name: 'Motor vehicle theft' },
];

const json = (status, body, extra = {}) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...extra,
  },
  body: JSON.stringify(body),
});

async function offenseTotal(state, code, year, key) {
  const url = `${BASE}/summarized/state/${state}/${code}?from=01-${year}&to=12-${year}&API_KEY=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const d = await res.json();
  const actuals = d?.offenses?.actuals || {};
  const series = Object.entries(actuals).find(([k]) => / Offenses$/.test(k) && !/United States/.test(k));
  if (!series) return null;
  const months = Object.values(series[1]).filter((v) => typeof v === 'number');
  if (months.length < 12) return null; // incomplete year
  return months.reduce((a, b) => a + b, 0);
}

export const handler = async (event) => {
  const key = process.env.FBI_API_KEY;
  if (!key) return json(500, { error: 'FBI_API_KEY not configured' });

  const state = String(event.queryStringParameters?.state || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return json(400, { error: 'state must be a 2-letter code' });

  const thisYear = new Date().getUTCFullYear();
  for (const year of [thisYear - 1, thisYear - 2]) {
    const totals = await Promise.all(OFFENSES.map((o) => offenseTotal(state, o.code, year, key).catch(() => null)));
    const rows = OFFENSES
      .map((o, i) => (totals[i] == null ? null : { offense_name: o.name, offense_count: totals[i], data_year: year }))
      .filter(Boolean);
    if (rows.length) {
      // FBI data changes at most annually — cache at the edge for a day.
      return json(200, rows, { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' });
    }
  }
  return json(404, { error: 'No FBI data found for ' + state });
};
