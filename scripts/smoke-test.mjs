// Live end-to-end smoke test.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (or shell) and
// the migration applied to the target project.
//
// What it does:
//   1. Runs the UK Police connector for London-only (small, fast).
//   2. Runs the scoring engine for GB.
//   3. Invokes the /api/safety-tiles handler in-process for a London bbox
//      and asserts the response shape.
//
// Use this before/after touching infra to confirm the chain is alive.
// Exits non-zero on any step's failure.

import 'dotenv/config';

import { run as runUK } from '../connectors/uk-police.js';
import { scoreCountry } from '../scoring/scoring-engine.js';
import { handler as safetyTiles } from '../netlify/functions/safety-tiles.js';

const DIVIDER = '─'.repeat(60);
const log = (msg) => console.log(msg);
const fail = (msg, err) => {
  console.error(`\nx ${msg}`);
  if (err) console.error(err.stack || err);
  process.exit(1);
};

function requireEnv() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    fail(`Missing env vars: ${missing.join(', ')}. Copy .env.example → .env first.`);
  }
}

async function step1Ingest() {
  log(`\n${DIVIDER}\n1. Ingest UK (London only)\n${DIVIDER}`);
  const result = await runUK({
    areas: [{ name: 'London', lat: 51.5074, lng: -0.1278 }],
  });
  log(`   fetched=${result.fetched} upserted=${result.inserted} errors=${result.errors.length}`);
  if (result.errors.length) {
    log(`   ! errors: ${result.errors.join('; ')}`);
  }
  if (result.inserted === 0 && result.errors.length === 0) {
    log('   note: no rows inserted. data.police.uk may have returned an empty set for this month.');
  }
  return result;
}

async function step2Score() {
  log(`\n${DIVIDER}\n2. Score GB\n${DIVIDER}`);
  const result = await scoreCountry({ country: 'GB' });
  log(`   country=${result.country} cells=${result.cells ?? 0}`);
  return result;
}

async function step3Query() {
  log(`\n${DIVIDER}\n3. GET /api/safety-tiles (London bbox)\n${DIVIDER}`);
  const event = {
    queryStringParameters: {
      bbox: '-0.51,51.28,0.34,51.69',
      resolution: '9',
    },
  };
  const res = await safetyTiles(event);
  if (res.statusCode !== 200) fail(`endpoint returned ${res.statusCode}: ${res.body}`);
  const body = JSON.parse(res.body);
  if (body.type !== 'FeatureCollection') fail(`unexpected body shape: ${res.body.slice(0, 200)}`);

  log(`   features=${body.features.length}`);
  if (body.features.length > 0) {
    const sample = body.features[0];
    log(`   sample: h3=${sample.properties.h3} band=${sample.properties.band} ` +
        `score=${sample.properties.score} color=${sample.properties.color}`);
  } else {
    log('   note: no cells in this bbox have scores yet. Did step 2 score any cells?');
  }
  return body;
}

async function main() {
  requireEnv();
  log(`Wiley Fox pipeline smoke test\n${DIVIDER}`);
  log(`Supabase: ${process.env.SUPABASE_URL}`);

  try {
    await step1Ingest();
    await step2Score();
    await step3Query();
  } catch (err) {
    fail('smoke test failed', err);
  }

  log(`\n${DIVIDER}\nOK — pipeline is alive end-to-end.\n${DIVIDER}`);
}

main();
