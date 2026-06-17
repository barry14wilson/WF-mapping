#!/usr/bin/env node
/**
 * Wiley Fox — YouTube City Knowledge Pipeline
 * ─────────────────────────────────────────────
 * Fetches YouTube travel/safety videos + transcripts for every global city
 * that receives significant tourist traffic, organised into 4 tiers by
 * annual visitor volume.  Saves structured JSON to city_knowledge/{slug}.json.
 *
 * Usage:
 *   node youtube_city_pipeline.js                  # next batch of unprocessed cities
 *   node youtube_city_pipeline.js --city London    # single city
 *   node youtube_city_pipeline.js --tier 1         # all Tier-1 cities only
 *   node youtube_city_pipeline.js --batch 10       # process next 10 unprocessed cities
 *   node youtube_city_pipeline.js --rerun          # reprocess even if JSON exists
 *   node youtube_city_pipeline.js --list           # list all cities + status
 *
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
// Read the value following a flag, or null/undefined if the flag is absent.
// (indexOf returns -1 when a flag is missing; guard against reading args[0].)
const flagVal   = (flag) => { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; };
const cityArg   = flagVal('--city') || null;
const tierArg   = parseInt(flagVal('--tier')) || null;
const batchSize = parseInt(flagVal('--batch')) || 18; // ~daily quota
const vidLimit  = parseInt(flagVal('--videos')) || 4;
const rerun     = args.includes('--rerun');
const listMode  = args.includes('--list');

const OUT_DIR = path.join(__dirname, 'city_knowledge');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── QUALITY THRESHOLDS ───────────────────────────────────────────────────────

const MIN_VIEWS_BY_TIER = { 1: 30_000, 2: 20_000, 3: 10_000, 4: 5_000 };
const PUBLISHED_AFTER   = '2022-01-01T00:00:00Z';

// ─── GLOBAL CITY LIST — TIERED BY ANNUAL VISITORS ────────────────────────────
// Tier 1: 15 M+ visitors/yr   Tier 2: 5–15 M   Tier 3: 1–5 M   Tier 4: 500k–1 M

const CITIES = [
  // ══ TIER 1 — Mega destinations (15 M+ visitors/yr) ══════════════════════
  { name: 'Bangkok',        region: 'Thailand',          tier: 1, visitors: 30 },
  { name: 'Hong Kong',      region: 'China',             tier: 1, visitors: 23 },
  { name: 'London',         region: 'England',           tier: 1, visitors: 22 },
  { name: 'Istanbul',       region: 'Turkey',            tier: 1, visitors: 20 },
  { name: 'Dubai',          region: 'UAE',               tier: 1, visitors: 19 },
  { name: 'Antalya',        region: 'Turkey',            tier: 1, visitors: 18 },
  { name: 'Paris',          region: 'France',            tier: 1, visitors: 18 },
  { name: 'Kuala Lumpur',   region: 'Malaysia',          tier: 1, visitors: 17 },
  { name: 'Seoul',          region: 'South Korea',       tier: 1, visitors: 16 },
  { name: 'New York City',  region: 'USA',               tier: 1, visitors: 14 },
  { name: 'Singapore',      region: 'Singapore',         tier: 1, visitors: 14 },
  { name: 'Tokyo',          region: 'Japan',             tier: 1, visitors: 13 },
  { name: 'Rome',           region: 'Italy',             tier: 1, visitors: 11 },
  { name: 'Barcelona',      region: 'Spain',             tier: 1, visitors: 10 },
  { name: 'Phuket',         region: 'Thailand',          tier: 1, visitors: 10 },
  { name: 'Amsterdam',      region: 'Netherlands',       tier: 1, visitors: 9  },
  { name: 'Miami',          region: 'USA',               tier: 1, visitors: 9  },
  { name: 'Prague',         region: 'Czech Republic',    tier: 1, visitors: 9  },
  { name: 'Vienna',         region: 'Austria',           tier: 1, visitors: 8  },
  { name: 'Milan',          region: 'Italy',             tier: 1, visitors: 8  },

  // ══ TIER 2 — Major destinations (5–15 M visitors/yr) ════════════════════
  { name: 'Madrid',         region: 'Spain',             tier: 2, visitors: 9  },
  { name: 'Las Vegas',      region: 'USA',               tier: 2, visitors: 9  },
  { name: 'Berlin',         region: 'Germany',           tier: 2, visitors: 8  },
  { name: 'Osaka',          region: 'Japan',             tier: 2, visitors: 8  },
  { name: 'Lisbon',         region: 'Portugal',          tier: 2, visitors: 7  },
  { name: 'Athens',         region: 'Greece',            tier: 2, visitors: 7  },
  { name: 'Cancun',         region: 'Mexico',            tier: 2, visitors: 8  },
  { name: 'Bali',           region: 'Indonesia',         tier: 2, visitors: 6  },
  { name: 'Los Angeles',    region: 'USA',               tier: 2, visitors: 6  },
  { name: 'Chicago',        region: 'USA',               tier: 2, visitors: 6  },
  { name: 'Shanghai',       region: 'China',             tier: 2, visitors: 6  },
  { name: 'Sydney',         region: 'Australia',         tier: 2, visitors: 5  },
  { name: 'Toronto',        region: 'Canada',            tier: 2, visitors: 5  },
  { name: 'Abu Dhabi',      region: 'UAE',               tier: 2, visitors: 5  },
  { name: 'Mexico City',    region: 'Mexico',            tier: 2, visitors: 5  },
  { name: 'Mumbai',         region: 'India',             tier: 2, visitors: 5  },
  { name: 'Ho Chi Minh City', region: 'Vietnam',         tier: 2, visitors: 5  },
  { name: 'San Francisco',  region: 'USA',               tier: 2, visitors: 5  },
  { name: 'Orlando',        region: 'USA',               tier: 2, visitors: 5  },
  { name: 'Cairo',          region: 'Egypt',             tier: 2, visitors: 5  },
  { name: 'Taipei',         region: 'Taiwan',            tier: 2, visitors: 5  },
  { name: 'Doha',           region: 'Qatar',             tier: 2, visitors: 5  },
  { name: 'Florence',       region: 'Italy',             tier: 2, visitors: 5  },
  { name: 'Budapest',       region: 'Hungary',           tier: 2, visitors: 5  },
  { name: 'Delhi',          region: 'India',             tier: 2, visitors: 5  },
  { name: 'Hanoi',          region: 'Vietnam',           tier: 2, visitors: 4  },
  { name: 'Dublin',         region: 'Ireland',           tier: 2, visitors: 4  },
  { name: 'Brussels',       region: 'Belgium',           tier: 2, visitors: 4  },
  { name: 'Copenhagen',     region: 'Denmark',           tier: 2, visitors: 4  },
  { name: 'Venice',         region: 'Italy',             tier: 2, visitors: 4  },

  // ══ TIER 3 — Strong destinations (1–5 M visitors/yr) ════════════════════
  { name: 'Stockholm',      region: 'Sweden',            tier: 3, visitors: 3  },
  { name: 'Munich',         region: 'Germany',           tier: 3, visitors: 4  },
  { name: 'Zurich',         region: 'Switzerland',       tier: 3, visitors: 3  },
  { name: 'Warsaw',         region: 'Poland',            tier: 3, visitors: 3  },
  { name: 'Krakow',         region: 'Poland',            tier: 3, visitors: 3  },
  { name: 'Porto',          region: 'Portugal',          tier: 3, visitors: 3  },
  { name: 'Edinburgh',      region: 'Scotland',          tier: 3, visitors: 3  },
  { name: 'Manchester',     region: 'England',           tier: 3, visitors: 3  },
  { name: 'Washington DC',  region: 'USA',               tier: 3, visitors: 4  },
  { name: 'New Orleans',    region: 'USA',               tier: 3, visitors: 3  },
  { name: 'Seattle',        region: 'USA',               tier: 3, visitors: 3  },
  { name: 'Boston',         region: 'USA',               tier: 3, visitors: 3  },
  { name: 'Vancouver',      region: 'Canada',            tier: 3, visitors: 4  },
  { name: 'Montreal',       region: 'Canada',            tier: 3, visitors: 3  },
  { name: 'Melbourne',      region: 'Australia',         tier: 3, visitors: 4  },
  { name: 'Auckland',       region: 'New Zealand',       tier: 3, visitors: 3  },
  { name: 'Marrakech',      region: 'Morocco',           tier: 3, visitors: 3  },
  { name: 'Cape Town',      region: 'South Africa',      tier: 3, visitors: 2  },
  { name: 'Johannesburg',   region: 'South Africa',      tier: 3, visitors: 3  },
  { name: 'Nairobi',        region: 'Kenya',             tier: 3, visitors: 2  },
  { name: 'Buenos Aires',   region: 'Argentina',         tier: 3, visitors: 3  },
  { name: 'Rio de Janeiro', region: 'Brazil',            tier: 3, visitors: 3  },
  { name: 'Lima',           region: 'Peru',              tier: 3, visitors: 3  },
  { name: 'Santiago',       region: 'Chile',             tier: 3, visitors: 3  },
  { name: 'Bogota',         region: 'Colombia',          tier: 3, visitors: 2  },
  { name: 'Havana',         region: 'Cuba',              tier: 3, visitors: 2  },
  { name: 'Amman',          region: 'Jordan',            tier: 3, visitors: 3  },
  { name: 'Tel Aviv',       region: 'Israel',            tier: 3, visitors: 2  },
  { name: 'Riyadh',         region: 'Saudi Arabia',      tier: 3, visitors: 3  },
  { name: 'Muscat',         region: 'Oman',              tier: 3, visitors: 2  },
  { name: 'Colombo',        region: 'Sri Lanka',         tier: 3, visitors: 2  },
  { name: 'Siem Reap',      region: 'Cambodia',          tier: 3, visitors: 2  },
  { name: 'Manila',         region: 'Philippines',       tier: 3, visitors: 2  },
  { name: 'Hurghada',       region: 'Egypt',             tier: 3, visitors: 3  },
  { name: 'Seville',        region: 'Spain',             tier: 3, visitors: 3  },
  { name: 'Dubrovnik',      region: 'Croatia',           tier: 3, visitors: 2  },
  { name: 'Helsinki',       region: 'Finland',           tier: 3, visitors: 2  },
  { name: 'Oslo',           region: 'Norway',            tier: 3, visitors: 2  },
  { name: 'Reykjavik',      region: 'Iceland',           tier: 3, visitors: 2  },
  { name: 'Da Nang',        region: 'Vietnam',           tier: 3, visitors: 3  },
  { name: 'Jaipur',         region: 'India',             tier: 3, visitors: 2  },
  { name: 'Cusco',          region: 'Peru',              tier: 3, visitors: 2  },
  { name: 'Cartagena',      region: 'Colombia',          tier: 3, visitors: 1  },
  { name: 'Medellin',       region: 'Colombia',          tier: 3, visitors: 1  },
  { name: 'Phnom Penh',     region: 'Cambodia',          tier: 3, visitors: 2  },
  { name: 'Kathmandu',      region: 'Nepal',             tier: 3, visitors: 1  },
  { name: 'Casablanca',     region: 'Morocco',           tier: 3, visitors: 2  },
  { name: 'Lagos',          region: 'Nigeria',           tier: 3, visitors: 2  },
  { name: 'Guadalajara',    region: 'Mexico',            tier: 3, visitors: 1  },
  { name: 'Queenstown',     region: 'New Zealand',       tier: 3, visitors: 1  },

  // ══ TIER 4 — Growing destinations (500k–1 M visitors/yr) ════════════════
  { name: 'Birmingham',     region: 'England',           tier: 4, visitors: 1  },
  { name: 'Liverpool',      region: 'England',           tier: 4, visitors: 1  },
  { name: 'Bristol',        region: 'England',           tier: 4, visitors: 1  },
  { name: 'Leeds',          region: 'England',           tier: 4, visitors: 1  },
  { name: 'Newcastle',      region: 'England',           tier: 4, visitors: 1  },
  { name: 'Cardiff',        region: 'Wales',             tier: 4, visitors: 1  },
  { name: 'Belfast',        region: 'Northern Ireland',  tier: 4, visitors: 1  },
  { name: 'Brighton',       region: 'England',           tier: 4, visitors: 1  },
  { name: 'Glasgow',        region: 'Scotland',          tier: 4, visitors: 1  },
  { name: 'Valletta',       region: 'Malta',             tier: 4, visitors: 1  },
  { name: 'Riga',           region: 'Latvia',            tier: 4, visitors: 1  },
  { name: 'Tallinn',        region: 'Estonia',           tier: 4, visitors: 1  },
  { name: 'Vilnius',        region: 'Lithuania',         tier: 4, visitors: 1  },
  { name: 'Ljubljana',      region: 'Slovenia',          tier: 4, visitors: 1  },
  { name: 'Sarajevo',       region: 'Bosnia',            tier: 4, visitors: 1  },
  { name: 'Tbilisi',        region: 'Georgia',           tier: 4, visitors: 1  },
  { name: 'Yerevan',        region: 'Armenia',           tier: 4, visitors: 1  },
  { name: 'Tashkent',       region: 'Uzbekistan',        tier: 4, visitors: 1  },
  { name: 'Baku',           region: 'Azerbaijan',        tier: 4, visitors: 1  },
  { name: 'Almaty',         region: 'Kazakhstan',        tier: 4, visitors: 1  },
  { name: 'Accra',          region: 'Ghana',             tier: 4, visitors: 1  },
  { name: 'Dar es Salaam',  region: 'Tanzania',          tier: 4, visitors: 1  },
  { name: 'Zanzibar',       region: 'Tanzania',          tier: 4, visitors: 1  },
  { name: 'Mombasa',        region: 'Kenya',             tier: 4, visitors: 1  },
  { name: 'Luanda',         region: 'Angola',            tier: 4, visitors: 1  },
  { name: 'Houston',        region: 'USA',               tier: 4, visitors: 2  },
  { name: 'Nashville',      region: 'USA',               tier: 4, visitors: 2  },
  { name: 'San Diego',      region: 'USA',               tier: 4, visitors: 2  },
  { name: 'Denver',         region: 'USA',               tier: 4, visitors: 2  },
  { name: 'Austin',         region: 'USA',               tier: 4, visitors: 2  },
  { name: 'Phoenix',        region: 'USA',               tier: 4, visitors: 2  },
  { name: 'Calgary',        region: 'Canada',            tier: 4, visitors: 1  },
  { name: 'Brisbane',       region: 'Australia',         tier: 4, visitors: 2  },
  { name: 'Perth',          region: 'Australia',         tier: 4, visitors: 1  },
  { name: 'Chiang Mai',     region: 'Thailand',          tier: 4, visitors: 1  },
  { name: 'Cebu',           region: 'Philippines',       tier: 4, visitors: 1  },
  { name: 'Penang',         region: 'Malaysia',          tier: 4, visitors: 1  },
  { name: 'Langkawi',       region: 'Malaysia',          tier: 4, visitors: 1  },
  { name: 'Colombo',        region: 'Sri Lanka',         tier: 4, visitors: 1  },
  { name: 'Dhaka',          region: 'Bangladesh',        tier: 4, visitors: 1  },
  { name: 'Islamabad',      region: 'Pakistan',          tier: 4, visitors: 1  },
  { name: 'Goa',            region: 'India',             tier: 4, visitors: 1  },
  { name: 'Agra',           region: 'India',             tier: 4, visitors: 1  },
  { name: 'Jerusalem',      region: 'Israel',            tier: 4, visitors: 1  },
  { name: 'Petra',          region: 'Jordan',            tier: 4, visitors: 1  },
  { name: 'Luxor',          region: 'Egypt',             tier: 4, visitors: 1  },
  { name: 'Tunis',          region: 'Tunisia',           tier: 4, visitors: 1  },
  { name: 'Algiers',        region: 'Algeria',           tier: 4, visitors: 1  },
  { name: 'Addis Ababa',    region: 'Ethiopia',          tier: 4, visitors: 1  },
  { name: 'Kigali',         region: 'Rwanda',            tier: 4, visitors: 1  },
  { name: 'São Paulo',      region: 'Brazil',            tier: 4, visitors: 2  },
  { name: 'Quito',          region: 'Ecuador',           tier: 4, visitors: 1  },
  { name: 'Montevideo',     region: 'Uruguay',           tier: 4, visitors: 1  },
  { name: 'Bogota',         region: 'Colombia',          tier: 4, visitors: 2  },
  { name: 'Panama City',    region: 'Panama',            tier: 4, visitors: 1  },
  { name: 'San Jose',       region: 'Costa Rica',        tier: 4, visitors: 1  },
  { name: 'Reykjavik',      region: 'Iceland',           tier: 4, visitors: 2  },
  { name: 'Split',          region: 'Croatia',           tier: 4, visitors: 1  },
  { name: 'Kotor',          region: 'Montenegro',        tier: 4, visitors: 1  },
  { name: 'Skopje',         region: 'North Macedonia',   tier: 4, visitors: 1  },
  { name: 'Sofia',          region: 'Bulgaria',          tier: 4, visitors: 1  },
  { name: 'Bucharest',      region: 'Romania',           tier: 4, visitors: 1  },
  { name: 'Belgrade',       region: 'Serbia',            tier: 4, visitors: 1  },
  { name: 'Nicosia',        region: 'Cyprus',            tier: 4, visitors: 1  },
  { name: 'Limassol',       region: 'Cyprus',            tier: 4, visitors: 1  },
];

// ─── PIPELINE HELPERS ─────────────────────────────────────────────────────────

const YT = 'https://www.googleapis.com/youtube/v3';

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function isDone(city) {
  return fs.existsSync(path.join(OUT_DIR, `${slug(city.name)}.json`));
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
    channel: i.snippet.channelTitle,
    publishedAt: i.snippet.publishedAt,
    description: i.snippet.description,
  }));
}

async function getVideoDetails(ids) {
  if (!ids.length) return [];
  const data = await ytGet('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  return (data.items || []).map(v => ({
    videoId: v.id, title: v.snippet.title, channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt, description: v.snippet.description,
    tags: v.snippet.tags || [],
    viewCount: parseInt(v.statistics.viewCount || 0),
    likeCount:  parseInt(v.statistics.likeCount  || 0),
    duration: v.contentDetails.duration,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  }));
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

function extractKnowledge(text, cityName) {
  if (!text) return { places: [], safetyNotes: [], recommendations: [] };
  const lines = text.replace(/https?:\/\/\S+/g, '').split(/[.\n!?]/)
    .map(s => s.trim()).filter(s => s.length > 20);
  const SAFETY = [/avoid/i,/dangerous/i,/unsafe/i,/crime/i,/theft/i,/pickpocket/i,
    /scam/i,/careful/i,/warning/i,/caution/i,/don'?t/i,/beware/i,/safe\b/i,/robbery/i];
  const RECS   = [/recommend/i,/must.?see/i,/must.?visit/i,/best/i,/top\b/i,
    /don'?t miss/i,/worth/i,/hidden gem/i,/local tip/i,/pro tip/i,/check out/i];
  const STOP   = new Set(['This','That','There','When','Where','What','With','From','Have',
    'Been','Will','Your','More','Like','About','Also','Just','Then','Here','They',
    'Their','These','Those','Some','Many','Most','After','Before','During','Inside',
    'Outside','Around','Between','Amazon','Google','Instagram','YouTube','Watch',
    'Thanks','Guide','Travel','Visit','Tourist','Music','Beyond','Londoner']);
  const places = new Set(), safety = [], recs = [];
  for (const line of lines) {
    if (SAFETY.some(r => r.test(line)) && line.length < 200) safety.push(line);
    if (RECS.some(r => r.test(line))   && line.length < 200) recs.push(line);
    for (const m of [...line.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g)].map(x => x[1])) {
      if (!STOP.has(m) && m.toLowerCase() !== cityName.toLowerCase()) places.add(m);
    }
  }
  return { places: [...places].slice(0, 40), safetyNotes: [...new Set(safety)].slice(0, 15),
           recommendations: [...new Set(recs)].slice(0, 15) };
}

const SEARCH_QUERIES = [
  '{city} travel safety tips',
  '{city} travel guide 2024 2025',
  '{city} best places to visit',
  '{city} areas to avoid',
  '{city} travel tips first time visitor',
];

async function processCity(city) {
  const { name, region, tier } = city;
  const minViews = MIN_VIEWS_BY_TIER[tier];
  const sl = slug(name);
  const outFile = path.join(OUT_DIR, `${sl}.json`);
  console.log(`\n╔══ [T${tier}] ${name} (${region}) — min ${minViews.toLocaleString()} views`);

  const seenIds = new Set(), candidates = [];
  for (const tmpl of SEARCH_QUERIES) {
    const q = tmpl.replace('{city}', `${name} ${region}`);
    console.log(`  ↳ ${q}`);
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
    const all = await getVideoDetails(candidates.slice(0, vidLimit * SEARCH_QUERIES.length));
    videos = all.filter(v => v.viewCount >= minViews)
                .sort((a, b) => b.viewCount - a.viewCount)
                .slice(0, vidLimit * 3);
    const dropped = all.length - videos.length;
    if (dropped) console.log(`  ⚙ Filtered ${dropped} low-view videos`);
  } catch (e) { console.warn(`  ⚠ Details: ${e.message}`); }

  const enriched = [];
  for (const v of videos) {
    console.log(`  📹 ${v.title.slice(0, 55)}… (${(v.viewCount/1000).toFixed(0)}k)`);
    const transcript = await getTranscript(v.videoId);
    if (transcript) console.log(`     📝 ${transcript.length} chars`);
    const knowledge = extractKnowledge([v.title, v.description, transcript||''].join('. '), name);
    enriched.push({ ...v, transcriptLength: transcript?.length || 0, transcript: transcript||null, knowledge });
    await sleep(400);
  }

  const allPlaces = {};
  const allSafety = new Set(), allRecs = new Set();
  for (const v of enriched) {
    for (const p of v.knowledge.places) allPlaces[p] = (allPlaces[p]||0)+1;
    v.knowledge.safetyNotes.forEach(s => allSafety.add(s));
    v.knowledge.recommendations.forEach(r => allRecs.add(r));
  }

  const result = {
    city: name, region, tier, slug: sl,
    annualVisitorsM: city.visitors,
    lastUpdated: new Date().toISOString().split('T')[0],
    qualityThreshold: { minViews, publishedAfter: PUBLISHED_AFTER },
    videoCount: enriched.length,
    videos: enriched,
    aggregated: {
      topPlaces: Object.entries(allPlaces).sort((a,b)=>b[1]-a[1]).map(([place,count])=>({place,count})).slice(0,30),
      safetyNotes: [...allSafety].slice(0, 20),
      recommendations: [...allRecs].slice(0, 20),
    },
  };

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
  console.log(`  ✅ Saved → city_knowledge/${sl}.json  (${enriched.length} videos)`);
  return result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

(async () => {
  // Deduplicate city list by slug
  const seen = new Set();
  const allCities = CITIES.filter(c => { const s = slug(c.name); if (seen.has(s)) return false; seen.add(s); return true; });

  // --list mode
  if (listMode) {
    console.log('\nWiley Fox City List\n');
    for (const t of [1,2,3,4]) {
      const tier = allCities.filter(c => c.tier === t);
      console.log(`\nTier ${t} (${tier.length} cities):`);
      tier.forEach(c => console.log(`  ${isDone(c) ? '✅' : '○'} ${c.name} (${c.region}) — ${c.visitors}M visitors`));
    }
    const done = allCities.filter(isDone).length;
    console.log(`\n${done}/${allCities.length} cities processed\n`);
    return;
  }

  // Single city mode
  if (cityArg) {
    const city = allCities.find(c => c.name.toLowerCase() === cityArg.toLowerCase());
    if (!city) { console.error(`City not found: ${cityArg}`); process.exit(1); }
    await processCity(city);
    return;
  }

  // Tier filter mode
  let queue = tierArg
    ? allCities.filter(c => c.tier === tierArg)
    : allCities.sort((a,b) => a.tier - b.tier || b.visitors - a.visitors);

  // Skip already processed (unless --rerun)
  if (!rerun) queue = queue.filter(c => !isDone(c));

  const toProcess = queue.slice(0, batchSize);
  const total = allCities.length;
  const done  = allCities.filter(isDone).length;

  console.log(`\nWiley Fox — YouTube City Knowledge Pipeline`);
  console.log(`Global coverage: ${done}/${total} cities done`);
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
    console.log('🎉 All cities complete!');
  }
})();
