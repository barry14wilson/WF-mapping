// Daily 10:00 UK: find new YouTube content and add it to the city database.
//   1. New uploads from every tracked YouTube creator (cheap: ~1 quota unit per creator).
//   2. FOCUS MODE: the city at the top of the focus queue gets the search budget (deep, seasonal,
//      paginated). Background rotation of other cities uses wf_config.discovery.background_share.
// Transcripts are fetched later by the Mac job (YouTube refuses cloud servers).
// Scheduled at 09:00 and 10:00 UTC; only the run that lands on 10:xx London time does work,
// so it stays at 10:00 UK through BST and GMT.

import { getSql } from '../../lib/db.js';
const clean = (s, max) => (s == null ? null : String(s).slice(0, max || 1e9).replace(/\u0000/g, '').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, ''));

const API = 'https://www.googleapis.com/youtube/v3';
const PUBLISHED_AFTER = '2022-01-01T00:00:00Z';
const TRAVEL_WORDS = /travel|guide|tips|visit|things to|where to|avoid|food|eat|hotel|stay|walk|day|trip|neighbourhood|neighborhood|safe|christmas|market|december|winter/i;

// Focus mode: the city at the top of the focus queue (wf_cities.focus_rank, not 'done') gets the
// search budget; background rotation of other cities gets `background_share` of it (0 = paused).
// Each (query, order) pair pages deeper day by day, so repeated runs keep finding new videos.
const DEFAULT_CFG = { daily_searches: 60, background_share: 0, season: 'christmas', season_until: '2026-12-31', min_views_focus: 2000, min_views_background: 5000, min_duration_sec: 120 };
const isoSecs = (d) => { const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0)) : 0; };
const BASE_QUERIES = ['{city} travel guide', '{city} things to know before visiting', '{city} tips for tourists', '{city} safety tips',
  '{city} scams tourists', '{city} where to stay', '{city} food guide', '{city} what to eat', '{city} with kids', '{city} solo travel',
  '{city} public transport guide', '{city} walking tour', '{city} travel vlog', '{city} best neighbourhoods', '{city} day trip'];
const SEASON_QUERIES = { christmas: ['{city} christmas market', '{city} christmas market tips', '{city} in december', '{city} christmas',
  '{city} winter travel', '{city} christmas market food', '{city} christmas market with kids', '{city} christmas market guide'] };
const LOCAL_SEASON = { christmas: {
  nuremberg: ['Nuremberg Christkindlesmarkt', 'Christkindlesmarkt Nürnberg'], cologne: ['Cologne Cathedral Christmas market', 'Köln Weihnachtsmarkt'],
  munich: ['Munich Christkindlmarkt Marienplatz', 'München Weihnachtsmarkt'], berlin: ['Berlin Gendarmenmarkt Christmas market', 'Berlin Weihnachtsmarkt'],
  chicago: ['Chicago Christkindlmarket'] } };
const ORDERS = ['relevance', 'viewCount', 'date'];
const QUERIES = ['{city} travel guide', '{city} things to know before visiting']; // background rotation

async function yt(path, params) {
  const u = new URL(`${API}/${path}`);
  Object.entries({ ...params, key: process.env.YOUTUBE_API_KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`YouTube ${path} ${r.status}`);
  return r.json();
}

function londonHour(d = new Date()) {
  return +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).format(d);
}

export async function discover({ force = false } = {}) {
  if (!force && londonHour() !== 10) return { skipped: 'not 10:00 in London' };
  if (!process.env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not set');
  const sql = getSql();
  const cfgRow = (await sql.query(`select value from wf_config where key='discovery'`))[0];
  const cfg = { ...DEFAULT_CFG, ...(cfgRow ? cfgRow.value : {}) };
  const [focus] = await sql.query(`select slug,name,country from wf_cities where focus_rank is not null and coalesce(guide_status,'queued') <> 'done' order by focus_rank limit 1`);
  const queued = new Set((await sql.query(`select slug from wf_cities where focus_rank is not null and coalesce(guide_status,'queued') <> 'done'`)).map((r) => r.slug));
  const stats = { focus: focus?.slug || null, focus_searches: 0, focus_new_pages: 0, creators_checked: 0, cities_searched: 0, candidates: 0, inserted: 0 };
  const cities = await sql.query('select slug,name,region from wf_cities');
  // Match a known city by whole word in the TITLE only (descriptions mention Instagram, other trips etc.).
  // No match -> city_slug stays null and the extraction step assigns it (and can add new cities/towns).
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cityRes = cities.map((c) => ({ slug: c.slug, len: c.name.length, re: new RegExp(`(^|[^a-z])${esc(c.name.toLowerCase())}([^a-z]|$)`) }));
  const cityMatch = (title) => {
    const t = (title || '').toLowerCase(); let best = null;
    for (const c of cityRes) if (c.re.test(t) && (!best || c.len > best.len)) best = c;
    return best?.slug ?? null;
  };
  const found = new Map(); // videoId -> {city, via}

  // 1. Tracked creators' latest uploads
  const creators = await sql.query(`select id,channel_id,uploads_playlist,trust_tier from wf_creators
    where platform='youtube' and channel_id is not null and coalesce(trust_tier,'') not like 'X%'`);
  const pool = async (items, n, fn) => { for (let i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(fn)); };
  await pool(creators, 12, async (c) => {
    try {
      const playlist = c.uploads_playlist || 'UU' + c.channel_id.slice(2);
      const d = await yt('playlistItems', { part: 'snippet', playlistId: playlist, maxResults: 10 });
      for (const it of d.items || []) {
        const sn = it.snippet;
        if (!TRAVEL_WORDS.test(sn.title)) continue;
        const city = cityMatch(sn.title);
        // With background paused, only keep creator uploads about cities in the focus queue
        if (cfg.background_share <= 0 && queued.size && !queued.has(city)) continue;
        found.set(sn.resourceId.videoId, { city, via: 'creator_uploads' });
      }
      stats.creators_checked++;
    } catch (e) { console.warn('[discovery] creator', c.channel_id, e.message); }
  });
  if (creators.length) await sql.query('update wf_creators set last_checked_at=now() where id = any($1)', [creators.map((c) => c.id)]);

  // 2a. Focus city: deep, seasonal, paginated searches
  const total = Math.max(0, +cfg.daily_searches || 0);
  const bgShare = Math.min(1, Math.max(0, +cfg.background_share || 0));
  let focusBudget = focus ? Math.round(total * (1 - bgShare)) : 0;
  if (focus) {
    const seasonOn = cfg.season && (!cfg.season_until || new Date().toISOString().slice(0, 10) <= cfg.season_until);
    const qs = [...(seasonOn ? (LOCAL_SEASON[cfg.season]?.[focus.slug] || []) : []),
      ...(seasonOn ? (SEASON_QUERIES[cfg.season] || []).map((q) => q.replace('{city}', focus.name)) : []),
      ...BASE_QUERIES.map((q) => q.replace('{city}', focus.name))];
    const stateKey = `disc_state:${focus.slug}`;
    const st = ((await sql.query('select value from wf_config where key=$1', [stateKey]))[0] || {}).value || {};
    const combos = [];
    for (const order of ORDERS) for (const q of qs) { const k = `${order}|${q}`; if (st[k] !== 'END') combos.push([k, q, order]); }
    const todo = combos.slice(0, focusBudget);
    await pool(todo, 10, async ([k, q, order]) => {
      try {
        const params = { part: 'snippet', type: 'video', maxResults: 25, order, publishedAfter: PUBLISHED_AFTER, q };
        if (!/[äöüß]/i.test(q)) params.relevanceLanguage = 'en';
        if (st[k]) params.pageToken = st[k];
        const d = await yt('search', params);
        for (const it of d.items || []) if (!found.has(it.id.videoId)) found.set(it.id.videoId, { city: cityMatch(it.snippet.title) || focus.slug, via: `focus:${q}` });
        st[k] = d.nextPageToken || 'END';
        stats.focus_searches++; if (params.pageToken) stats.focus_new_pages++;
      } catch (e) { console.warn('[discovery] focus', q, e.message); }
    });
    await sql.query(`insert into wf_config (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value, updated_at=now()`, [stateKey, JSON.stringify(st)]);
    if (!todo.length) stats.focus_exhausted = true;
  }

  // 2b. Background rotation (paused when background_share = 0)
  const bgSearches = total - focusBudget;
  const citiesToday = Math.floor(bgSearches / QUERIES.length);
  const due = citiesToday > 0 ? await sql.query(`select slug,name,region from wf_cities where slug <> $2 order by last_search_at nulls first, tier nulls last limit $1`, [citiesToday, focus?.slug || '']) : [];
  await pool(due, 5, async (c) => {
    await Promise.all(QUERIES.map(async (q) => {
      try {
        const d = await yt('search', { part: 'snippet', type: 'video', maxResults: 8, relevanceLanguage: 'en', order: 'relevance',
          publishedAfter: PUBLISHED_AFTER, q: q.replace('{city}', c.name) });
        for (const it of d.items || []) if (!found.has(it.id.videoId)) found.set(it.id.videoId, { city: cityMatch(it.snippet.title) || c.slug, via: 'city_search' });
      } catch (e) { console.warn('[discovery] search', c.slug, e.message); }
    }));
    stats.cities_searched++;
  });
  if (due.length) await sql.query('update wf_cities set last_search_at=now() where slug = any($1)', [due.map((c) => c.slug)]);
  if (focus) await sql.query('update wf_cities set last_search_at=now() where slug=$1', [focus.slug]);

  // 3. Keep only videos we have never seen, enrich, insert (append-only)
  const ids = [...found.keys()];
  const known = new Set((await sql.query('select id from wf_sources where id = any($1)', [ids.map((i) => 'yt:' + i)])).map((r) => r.id));
  const fresh = ids.filter((i) => !known.has('yt:' + i));
  stats.candidates = fresh.length;
  const rows = [];
  for (let i = 0; i < fresh.length; i += 50) {
    const d = await yt('videos', { part: 'snippet,statistics,contentDetails', id: fresh.slice(i, i + 50).join(',') });
    for (const v of d.items || []) {
      const views = +(v.statistics?.viewCount || 0);
      const meta = found.get(v.id);
      const isFocus = meta.via.startsWith('focus:');
      if (meta.via !== 'creator_uploads' && views < (isFocus ? cfg.min_views_focus : cfg.min_views_background)) continue; // skip dead or hobby uploads
      if (isoSecs(v.contentDetails?.duration) < cfg.min_duration_sec) continue; // Shorts and clips carry too little to extract
      rows.push(['yt:' + v.id, `https://www.youtube.com/watch?v=${v.id}`, clean(v.snippet.title), clean(v.snippet.channelTitle), v.snippet.channelId, meta.city,
        v.snippet.publishedAt, views, +(v.statistics?.likeCount || 0), v.contentDetails?.duration, clean(v.snippet.description, 4000), meta.via]);
    }
  }
  if (rows.length) {
    const cols = rows[0].length; const params = []; const tuples = rows.map((r, i) => {
      params.push(...r); return '(' + r.map((_, j) => `$${i * cols + j + 1}`).join(',') + ",'youtube')";
    });
    const ins = await sql.query(`insert into wf_sources (id,url,title,channel,channel_id,city_slug,published_at,views,likes,duration,description,discovered_via,platform)
      values ${tuples.join(',')} on conflict (id) do nothing returning id`, params);
    stats.inserted = ins.length;
  }
  await sql.query(`insert into wf_runs (kind,finished_at,stats) values ('youtube_discovery', now(), $1)`, [JSON.stringify(stats)]);
  return stats;
}

export const handler = async (event) => {
  try {
    const force = event?.queryStringParameters?.force === '1' && event?.headers?.['x-wf-admin-token'] === process.env.WF_ADMIN_TOKEN;
    const stats = await discover({ force });
    console.log('[discovery]', stats);
    return { statusCode: 200, body: JSON.stringify(stats) };
  } catch (err) {
    console.error('[discovery]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
