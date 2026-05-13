// Shared helper for scheduled connector functions. Each scheduled-*.js
// imports a connector's run() + a country code, this runs them and
// returns a Netlify-compatible response.
//
// "Affected H3 cells only" per the Phase 5 spec is approximated by
// re-scoring the connector's country/countries after ingest, which is
// the practical unit of partial recalc — bands need country-wide
// percentile context anyway.

import { scoreCountry, scoreAll } from '../../scoring/scoring-engine.js';

export async function runPipeline({ name, connectorRun, country, countries }) {
  const started = Date.now();
  let connectorResult;
  let scoringResult;
  let error;

  try {
    connectorResult = await connectorRun();
  } catch (err) {
    error = `connector ${name}: ${err.message}`;
    console.error(error);
  }

  if (!error) {
    try {
      if (countries) {
        scoringResult = [];
        for (const c of countries) {
          scoringResult.push(await scoreCountry({ country: c }));
        }
      } else if (country) {
        scoringResult = await scoreCountry({ country });
      } else {
        scoringResult = await scoreAll();
      }
    } catch (err) {
      error = `scoring after ${name}: ${err.message}`;
      console.error(error);
    }
  }

  const took = Date.now() - started;
  console.log(`[${name}] pipeline done in ${took}ms`);

  return {
    statusCode: error ? 500 : 200,
    body: JSON.stringify({
      ok: !error,
      name,
      took_ms: took,
      connector: connectorResult,
      scoring: scoringResult,
      error,
    }),
  };
}
