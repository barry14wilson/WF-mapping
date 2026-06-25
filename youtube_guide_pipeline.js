#!/usr/bin/env node
/**
 * Wiley Fox — YouTube City GUIDE Pipeline
 * ─────────────────────────────────────────────
 * Sibling to youtube_city_pipeline.js. Same cities, same tiered view floors,
 * but focused on CITY GUIDES: best areas to stay, top attractions, and the
 * common pitfalls / tourist traps / things to avoid.
 *
 * Quality controls (in addition to the per-tier view floor):
 *   • Curated channel ALLOWLIST — trusted travel-guide creators always pass.
 *   • Subscriber-count floor — non-allowlisted channels must clear a per-tier
 *     subscriber minimum (filters hobbyist one-offs and clickbait).
 *   • Max 2 videos per channel per city — keeps a single creator from dominating.
 *
 * The city queue is read from city_knowledge/*.json (the completed safety
 * corpus) so coverage always matches that dataset exactly. Output is written to
 * a SEPARATE city_guides/ folder — the safety corpus is never touched.
 *
 * Usage:
 *   node youtube_guide_pipeline.js                 # next batch of unprocessed cities
 *   node youtube_guide_pipeline.js --city London   # single city
 *   node youtube_guide_pipeline.js --tier 1        # all Tier-1 cities only
 *   node youtube_guide_pipeline.js --batch 3       # process next N unprocessed cities
 *   node youtube_guide_pipeline.js --rerun         # reprocess even if JSON exists
 *   node youtube_guide_pipeline.js --list          # list all cities + status
 *
 * Quota note: ~9 searches/city ≈ 900 units, so ~10–11 cities/day on a 10k quota.
 * API key: set YOUTUBE_API_KEY env var, or create .env.pipeline in this folder.
 * Requirements: npm install youtube-transcript
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── LOAD API KEY ─────────────────────────────────────────────────────────────

let API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  const envFile = path.join(__dirname, '.env.pipeline');
  if (fs.existsSync(envFile)) {
    const match = fs.readFileSync(envFile, 'utf8').match(/YOUTUBE_API_KEY=(.+)/);
    if (match) API_KEY = match[1].trim();
  }
}
if (!API_KEY) {
  console.error('ERROR: Set YOUTUBE_API_KEY env var or add it to .env.pipeline');
  process.exit(1);
}

// ─── ARGS ────────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const flagVal   = (flag) => { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; };
const cityArg   = flagVal('--city') || null;
const tierArg   = parseInt(flagVal('--tier')) || null;
const batchSize = parseInt(flagVal('--batch')) || 10; // realistic daily quota for 9-query runs
const vidLimit  = parseInt(flagVal('--videos')) || 4;
const rerun     = args.includes('--rerun');
const listMode  = args.includes('--list');

const SRC_DIR = path.join(__dirname, 'city_knowledge'); // authoritative city list
const OUT_DIR = path.join(__dirname, 'city_guides');     // NEW — guide output
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── QUALITY THRESHOLDS ───────────────────────────────────────────────────────

const MIN_VIEWS_BY_TIER = { 1: 30_000, 2: 20_000, 3: 10_000, 4: 5_000 };
const MIN_SUBS_BY_TIER  = { 1: 50_000, 2: 40_000, 3: 25_000, 4: 15_000 };
const PUBLISHED_AFTER   = '2022-01-01T00:00:00Z';
const MAX_PER_CHANNEL   = 2;
const ALLOWLIST_MIN_VIEWS = 2_000; // trusted channels bypass the tier floor, but skip dead videos

// Curated, trusted city-guide / "things to avoid" creators. Matched as a
// case-insensitive substring against the channel title, so partial names are
// fine ("rick steves" → "Rick Steves' Europe"). EDIT THIS LIST as you find new
// quality producers — it is the single strongest quality lever in the pipeline.
const CHANNEL_ALLOWLIST = [
  'rick steves', 'wolters world', 'honest guide', 'vagabrothers', 'attache', 'attaché',
  'lost leblanc', 'drew binsky', 'kara and nate', 'mark wiens', 'migrationology',
  'nomadic samuel', 'samuel and audrey', 'gabriel traveler', 'here be barr',
  'love and london', 'the endless adventure', 'backpacker steve', 'indigo traveller',
  'eva zu beck', 'hey nadine', 'lonely planet', 'conde nast', 'expedia',
  'hungry passport', 'world travel guy', 'portable professional', 'walter mods',
  'travel with', 'the traveling clatts', 'allan su', 'dolton',
].map(s => s.toLowerCase());

function isAllowlisted(channelTitle) {
  const t = (channelTitle || '').toLowerCase();
  return CHANNEL_ALLOWLIST.some(name => t.includes(name));
}

// ─── SEARCH QUERIES ───────────────────────────────────────────────────────────
// Original safety set (kept) + new guide-focused set (best areas, attractions,
// common pitfalls / things to avoid).

const SEARCH_QUERIES = [
  // — safety (retained) —
  '{city} travel safety tips',
  '{city} areas to avoid',
  // — city guide —
  '{city} travel guide',
  '{city} best areas to stay neighborhood guide',
  '{city} best things to do top attractions',
  '{city} where to stay first time',
  // — pitfalls / things to avoid —
  '{city} tourist traps to avoid',
  '{city} things NOT to do mistakes',
  '{city} travel tips first time visitor',
];

// ─── PIPELINE HELPERS ─────────────────────────────────────────────────────────

const YT = 'https://www.googleapis.com/youtube/v3';

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function isDone(city) {
  return fs.existsSync(path.join(OUT_DIR, `${slug(city.name)}.json`));
}

// Fallback tier/region for early-schema knowledge files that predate the
// tier/region fields (London, Paris, Dubai, NYC, UK regionals, etc.). Tiers
// mirror the master list in youtube_city_pipeline.js.
const FALLBACK_META = {
  london:        { tier: 1, region: 'England',          visitors: 22 },
  paris:         { tier: 1, region: 'France',           visitors: 18 },
  dubai:         { tier: 1, region: 'UAE',              visitors: 19 },
  new_york_city: { tier: 1, region: 'USA',              visitors: 14 },
  barcelona:     { tier: 1, region: 'Spain',            visitors: 10 },
  miami:         { tier: 1, region: 'USA',              visitors: 9  },
  chicago:       { tier: 2, region: 'USA',              visitors: 6  },
  las_vegas:     { tier: 2, region: 'USA',              visitors: 9  },
  los_angeles:   { tier: 2, region: 'USA',              visitors: 6  },
  manchester:    { tier: 3, region: 'England',          visitors: 3  },
  birmingham:    { tier: 4, region: 'England',          visitors: 1  },
  liverpool:     { tier: 4, region: 'England',          visitors: 1  },
  bristol:       { tier: 4, region: 'England',          visitors: 1  },
  leeds:         { tier: 4, region: 'England',          visitors: 1  },
  newcastle:     { tier: 4, region: 'England',          visitors: 1  },
  cardiff:       { tier: 4, region: 'Wales',            visitors: 1  },
  belfast:       { tier: 4, region: 'Northern Ireland', visitors: 1  },
  brighton:      { tier: 4, region: 'England',          visitors: 1  },
};

// Build the city queue from the completed safety corpus.
function loadCities() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`ERROR: ${SRC_DIR} not found — run youtube_city_pipeline.js first.`);
    process.exit(1);
  }
  const cities = [];
  for (const f of fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
      if (!j.city) continue;
      const fb = FALLBACK_META[slug(j.city)] || {};
      const tier = j.tier || fb.tier;
      if (!tier) { console.warn(`  ⚠ No tier for ${f} — skipped`); continue; }
      cities.push({
        name: j.city,
        region: j.region || fb.region || '',
        tier,
        visitors: j.annualVisitorsM || fb.visitors || 0,
      });
    } catch { /* skip malformed */ }
  }
  return cities;
}

async function ytGet(endpoint, params) {
  const url = new URL(`${YT}/${endpoint}`);
  url.searchParams.set('key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`YT API ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

async function searchVideos(query, maxResults) {
  const data = await ytGet('search', {
    part: 'snippet', q: query, type: 'video',
    videoDuration: 'medium', relevanceLanguage: 'en',
    publishedAfter: PUBLISHED_AFTER, maxResults, order: 'relevance',
  });
  return (data.items || []).map(i => ({
    videoId: i.id.videoId, title: i.snippet.title,
    channel: i.snippet.channelTitle, channelId: i.snippet.channelId,
    publishedAt: i.snippet.publishedAt, description: i.snippet.description,
  }));
}

async function getVideoDetails(ids) {
  if (!ids.length) return [];
  const data = await ytGet('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  return (data.items || []).map(v => ({
    videoId: v.id, title: v.snippet.title, channel: v.snippet.channelTitle,
    channelId: v.snippet.channelId,
    publishedAt: v.snippet.publishedAt, description: v.snippet.description,
    tags: v.snippet.tags || [],
    viewCount: parseInt(v.statistics.viewCount || 0),
    likeCount:  parseInt(v.statistics.likeCount  || 0),
    duration: v.contentDetails.duration,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  }));
}

// Fetch subscriber counts for a set of channels (1 unit, batched up to 50 ids).
async function getChannelSubs(channelIds) {
  const subs = {};
  const ids = [...new Set(channelIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const data = await ytGet('channels', { part: 'statistics', id: batch.join(',') });
      for (const c of data.items || []) {
        subs[c.id] = parseInt(c.statistics.subscriberCount || 0);
      }
    } catch (e) { console.warn(`  ⚠ Channel stats: ${e.message}`); }
  }
  return subs;
}

async function getTranscript(videoId) {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    return items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
  } catch { return null; }
}

function isRelevant(video, cityName) {
  return (video.title + ' ' + video.description).toLowerCase().includes(cityName.toLowerCase());
}

// Topic-aware extraction: best areas, attractions, pitfalls (+ legacy safety/recs).
function extractKnowledge(text, cityName) {
  const empty = { places: [], bestAreas: [], attractions: [], pitfalls: [], safetyNotes: [], recommendations: [] };
  if (!text) return empty;
  const lines = text.replace(/https?:\/\/\S+/g, '').split(/[.\n!?]/)
    .map(s => s.trim()).filter(s => s.length > 20 && s.length < 220);

  const AREAS   = [/neighbou?rhood/i,/\bdistrict/i,/\barea\b/i,/where to stay/i,/stay in/i,/\bquarter\b/i,/part of town/i,/\bbarrio/i];
  const ATTRACT = [/must.?see/i,/must.?visit/i,/attraction/i,/landmark/i,/\bvisit the/i,/\bsee the/i,/worth (a )?visit/i,/top (thing|place|spot)/i,/don'?t miss/i,/iconic/i];
  const PITFALL = [/tourist trap/i,/avoid/i,/\bscam/i,/overpriced/i,/rip.?off/i,/don'?t\b/i,/do not\b/i,/mistake/i,/\btrap\b/i,/never\b/i,/careful/i,/beware/i,/overrated/i];
  const SAFETY  = [/dangerous/i,/unsafe/i,/crime/i,/theft/i,/pickpocket/i,/robbery/i,/warning/i,/caution/i,/safe\b/i];
  const RECS    = [/recommend/i,/\bbest\b/i,/\btop\b/i,/worth/i,/hidden gem/i,/local tip/i,/pro tip/i,/check out/i];

  const STOP = new Set(['This','That','There','When','Where','What','With','From','Have',
    'Been','Will','Your','More','Like','About','Also','Just','Then','Here','They',
    'Their','These','Those','Some','Many','Most','After','Before','During','Inside',
    'Outside','Around','Between','Amazon','Google','Instagram','YouTube','Watch',
    'Thanks','Guide','Travel','Visit','Tourist','Music','Beyond']);

  const places = new Set(), bestAreas = [], attractions = [], pitfalls = [], safety = [], recs = [];
  for (const line of lines) {
    if (AREAS.some(r => r.test(line)))   bestAreas.push(line);
    if (ATTRACT.some(r => r.test(line))) attractions.push(line);
    if (PITFALL.some(r => r.test(line))) pitfalls.push(line);
    if (SAFETY.some(r => r.test(line)))  safety.push(line);
    if (RECS.some(r => r.test(line)))    recs.push(line);
    for (const m of [...line.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g)].map(x => x[1])) {
      if (!STOP.has(m) && m.toLowerCase() !== cityName.toLowerCase()) places.add(m);
    }
  }
  const uniq = (a, n) => [...new Set(a)].slice(0, n);
  return {
    places: [...places].slice(0, 40),
    bestAreas: uniq(bestAreas, 15),
    attractions: uniq(attractions, 20),
    pitfalls: uniq(pitfalls, 20),
    safetyNotes: uniq(safety, 15),
    recommendations: uniq(recs, 15),
  };
}

async function processCity(city) {
  const { name, region, tier } = city;
  const minViews = MIN_VIEWS_BY_TIER[tier];
  const minSubs  = MIN_SUBS_BY_TIER[tier];
  const sl = slug(name);
  const outFile = path.join(OUT_DIR, `${sl}.json`);
  console.log(`\n╔══ [T${tier}] ${name} (${region}) — min ${minViews.toLocaleString()} views / ${minSubs.toLocaleString()} subs`);

  const seenIds = new Set(), candidates = [];
  for (const tmpl of SEARCH_QUERIES) {
    const q = tmpl.replace('{city}', `${name} ${region}`);
    try {
      const results = await searchVideos(q, vidLimit + 2);
      for (const r of results)
        if (!seenIds.has(r.videoId) && isRelevant(r, name)) {
          seenIds.add(r.videoId); candidates.push(r.videoId);
        }
    } catch (e) { console.warn(`  ⚠ ${e.message}`); }
    await sleep(250);
  }
  console.log(`  ✓ ${candidates.length} relevant candidates`);

  let videos = [];
  try {
    const all = await getVideoDetails(candidates);
    const subs = await getChannelSubs(all.map(v => v.channelId));
    let allowCount = 0, qualCount = 0;
    const perChannel = {};
    videos = all
      .map(v => ({ ...v, subscriberCount: subs[v.channelId] || 0, allowlisted: isAllowlisted(v.channel) }))
      .filter(v => {
        // Quality gate: trusted channel (bypasses floors) OR clears view+sub floors.
        const pass = v.allowlisted
          ? v.viewCount >= ALLOWLIST_MIN_VIEWS
          : (v.viewCount >= minViews && v.subscriberCount >= minSubs);
        if (pass && v.allowlisted) allowCount++;
        else if (pass) qualCount++;
        return pass;
      })
      .sort((a, b) => (b.allowlisted - a.allowlisted) || (b.viewCount - a.viewCount))
      .filter(v => {
        // Diversify: cap videos per channel.
        perChannel[v.channelId] = (perChannel[v.channelId] || 0) + 1;
        return perChannel[v.channelId] <= MAX_PER_CHANNEL;
      })
      .slice(0, vidLimit * 3);
    const dropped = all.length - videos.length;
    console.log(`  ⚙ Kept ${videos.length} (${allowCount} allowlisted, ${qualCount} via floors) · dropped ${dropped}`);
  } catch (e) { console.warn(`  ⚠ Details: ${e.message}`); }

  const enriched = [];
  for (const v of videos) {
    const tag = v.allowlisted ? '★' : ' ';
    console.log(`  ${tag}📹 ${v.title.slice(0, 50)}… (${(v.viewCount/1000).toFixed(0)}k views, ${(v.subscriberCount/1000).toFixed(0)}k subs)`);
    const transcript = await getTranscript(v.videoId);
    const knowledge = extractKnowledge([v.title, v.description, transcript||''].join('. '), name);
    enriched.push({ ...v, transcriptLength: transcript?.length || 0, transcript: transcript||null, knowledge });
    await sleep(400);
  }

  const allPlaces = {};
  const agg = { bestAreas: new Set(), attractions: new Set(), pitfalls: new Set(), safetyNotes: new Set(), recommendations: new Set() };
  for (const v of enriched) {
    for (const p of v.knowledge.places) allPlaces[p] = (allPlaces[p]||0)+1;
    v.knowledge.bestAreas.forEach(s => agg.bestAreas.add(s));
    v.knowledge.attractions.forEach(s => agg.attractions.add(s));
    v.knowledge.pitfalls.forEach(s => agg.pitfalls.add(s));
    v.knowledge.safetyNotes.forEach(s => agg.safetyNotes.add(s));
    v.knowledge.recommendations.forEach(s => agg.recommendations.add(s));
  }

  const result = {
    city: name, region, tier, slug: sl,
    annualVisitorsM: city.visitors,
    dataset: 'city_guide',
    lastUpdated: new Date().toISOString().split('T')[0],
    qualityThreshold: { minViews, minSubs, publishedAfter: PUBLISHED_AFTER, maxPerChannel: MAX_PER_CHANNEL },
    videoCount: enriched.length,
    videos: enriched,
    aggregated: {
      topPlaces: Object.entries(allPlaces).sort((a,b)=>b[1]-a[1]).map(([place,count])=>({place,count})).slice(0,30),
      bestAreas: [...agg.bestAreas].slice(0, 25),
      attractions: [...agg.attractions].slice(0, 30),
      pitfalls: [...agg.pitfalls].slice(0, 30),
      safetyNotes: [...agg.safetyNotes].slice(0, 20),
      recommendations: [...agg.recommendations].slice(0, 20),
    },
  };

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
  console.log(`  ✅ Saved → city_guides/${sl}.json  (${enriched.length} videos)`);
  return result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

(async () => {
  const seen = new Set();
  const allCities = loadCities()
    .filter(c => { const s = slug(c.name); if (seen.has(s)) return false; seen.add(s); return true; });

  if (listMode) {
    console.log('\nWiley Fox City GUIDE List\n');
    for (const t of [1,2,3,4]) {
      const tier = allCities.filter(c => c.tier === t).sort((a,b)=>b.visitors-a.visitors);
      console.log(`\nTier ${t} (${tier.length} cities):`);
      tier.forEach(c => console.log(`  ${isDone(c) ? '✅' : '○'} ${c.name} (${c.region})`));
    }
    const done = allCities.filter(isDone).length;
    console.log(`\n${done}/${allCities.length} cities processed\n`);
    return;
  }

  if (cityArg) {
    const city = allCities.find(c => c.name.toLowerCase() === cityArg.toLowerCase());
    if (!city) { console.error(`City not found: ${cityArg}`); process.exit(1); }
    await processCity(city);
    return;
  }

  let queue = tierArg
    ? allCities.filter(c => c.tier === tierArg)
    : allCities.sort((a,b) => a.tier - b.tier || b.visitors - a.visitors);

  if (!rerun) queue = queue.filter(c => !isDone(c));

  const toProcess = queue.slice(0, batchSize);
  const total = allCities.length;
  const done  = allCities.filter(isDone).length;

  console.log(`\nWiley Fox — YouTube City GUIDE Pipeline`);
  console.log(`Guide coverage: ${done}/${total} cities done`);
  console.log(`This run: ${toProcess.length} cities  |  Batch limit: ${batchSize}`);
  if (queue.length > batchSize) console.log(`Remaining after this run: ${queue.length - batchSize}`);
  console.log();

  let success = 0, failed = 0;
  for (const city of toProcess) {
    try { await processCity(city); success++; }
    catch (e) { console.error(`  ✗ ${city.name}: ${e.message}`); failed++; }
    if (toProcess.length > 1) await sleep(1200);
  }

  const newDone = allCities.filter(isDone).length;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Run complete: ${success} processed, ${failed} failed`);
  console.log(`Total progress: ${newDone}/${total} cities (${Math.round(newDone/total*100)}%)`);
  const remaining = allCities.filter(c => !isDone(c));
  if (remaining.length) {
    const nextBatch = remaining.slice(0, 3).map(c => c.name).join(', ');
    console.log(`Next up: ${nextBatch}${remaining.length > 3 ? ` +${remaining.length-3} more` : ''}`);
  } else {
    console.log('🎉 All guide cities complete!');
  }
})();
