// GET /api/city-guide?city=london
//
// Public, read-only bundle of everything Wiley Fox has collected for a city:
// creator-sourced facts (areas, hotels, food, transport, costs, safety feeling),
// local tips (city + UK-wide), photos and the credited sources behind them.
// The prototype's travel-guide generator reads this so every guide it builds
// uses the full, growing database. Transcripts are never exposed.

import { getSql } from '../../lib/db.js';

const json = (status, body, extra = {}) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra },
  body: JSON.stringify(body),
});

const UK = new Set(['london', 'manchester', 'birmingham', 'liverpool', 'leeds', 'bristol', 'newcastle', 'cardiff', 'belfast', 'brighton',
  'edinburgh', 'glasgow', 'oxford', 'cambridge', 'bath', 'york']);

export const handler = async (event) => {
  const city = String(event.queryStringParameters?.city || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (!/^[a-z_]{2,40}$/.test(city)) return json(400, { error: 'city required, e.g. ?city=london' });
  try {
    const sql = getSql();
    const [c] = await sql.query('select slug,name,country from wf_cities where slug=$1', [city]);
    const facts = await sql.query(`select f.kind,f.area,f.name,f.data,f.creator,f.observed_at,f.source_id,s.url as source_url
      from wf_facts f left join wf_sources s on s.id=f.source_id
      where f.city_slug=$1 and f.status='active' order by f.kind, f.created_at`, [city]);
    const scopes = UK.has(city) ? [city, 'uk'] : [city];
    const tips = await sql.query(`select scope,category,worry,tip,verified_url,verified_at,creator from wf_tips
      where scope = any($1) and status='active' order by category, created_at`, [scopes]);
    const photos = await sql.query(`select subject_type,subject_name,url,page_url,provider,license,credit from wf_photos
      where (city_slug=$1 or city_slug is null) and status='active' order by created_at desc`, [city]);
    const sources = await sql.query(`select id,url,title,channel,published_at from wf_sources
      where city_slug=$1 and not excluded and extracted_at is not null order by published_at desc nulls last`, [city]);
    const [counts] = await sql.query(`select count(*)::int videos, count(*) filter (where transcript_status='ok')::int transcripts,
      max(first_seen_at) last_added from wf_sources where city_slug=$1 and not excluded`, [city]);
    if (!c && !facts.length && !counts.videos) return json(404, { error: 'no data for ' + city });
    const byKind = {};
    for (const f of facts) (byKind[f.kind] ||= []).push(f);
    return json(200, { city: c || { slug: city }, counts, facts: byKind, tips, photos, sources, generated_at: new Date().toISOString() },
      { 'Cache-Control': 'public, max-age=300, s-maxage=900' });
  } catch (err) {
    console.error('[city-guide]', err);
    return json(500, { error: 'database unavailable' });
  }
};
