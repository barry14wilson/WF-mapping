// POST /api/wf-admin?op=<operation>   (header: x-wf-admin-token: <WF_ADMIN_TOKEN>)
//
// Private write/read API for the Wiley Fox city content database. Used by the
// Mac transcript job, the Claude extraction task and one-off backfills, so no
// client ever needs the raw Neon connection string. Append-only by design.
//
// ops: migrate | stats | upsert_cities | upsert_creators | list_creators | add_sources |
//      pending_transcripts | put_transcripts | pending_extraction | get_transcripts |
//      put_facts | put_tips | put_photos | mark_extracted | exclude_source | log_run |
//      get_focus | set_focus | set_config | list_rows | set_status

import { getSql } from '../../lib/db.js';
import { CONTENT_SCHEMA } from '../../lib/wf-content-schema.js';
import { discover } from './scheduled-youtube-discovery.js';

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const arr = (x) => (Array.isArray(x) ? x : []);
// Strip NULs and lone UTF-16 surrogates (slicing emoji can split a pair; Neon rejects them).
export const clean = (s, max) => {
  if (s == null) return null;
  let t = String(s);
  if (max && t.length > max) t = t.slice(0, max);
  return t.replace(/\u0000/g, '').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '');
};

async function bulk(sql, text, rows) {
  let n = 0;
  for (const r of rows) { const res = await sql.query(text, r); n += res?.length ?? 0; }
  return n;
}

const OPS = {
  async migrate(sql) {
    for (const stmt of CONTENT_SCHEMA) await sql.query(stmt);
    return { ok: true, statements: CONTENT_SCHEMA.length };
  },

  async stats(sql) {
    const q = async (t) => (await sql.query(t))[0];
    return {
      cities: await q('select count(*)::int n from wf_cities'),
      creators: await q('select count(*)::int n from wf_creators'),
      sources: await q(`select count(*)::int n, count(*) filter (where transcript_status='ok')::int with_transcript,
                          count(*) filter (where transcript_status='pending')::int pending,
                          count(*) filter (where extracted_at is not null)::int extracted,
                          count(distinct city_slug)::int cities from wf_sources`),
      facts: await q(`select count(*)::int n, count(distinct city_slug)::int cities from wf_facts where status='active'`),
      tips: await q(`select count(*)::int n from wf_tips where status='active'`),
      photos: await q(`select count(*)::int n from wf_photos where status='active'`),
      last_runs: await sql.query('select kind, started_at, finished_at, stats from wf_runs order by id desc limit 5'),
    };
  },

  async upsert_cities(sql, b) {
    const n = await bulk(sql, `insert into wf_cities (slug,name,country,region,tier) values ($1,$2,$3,$4,$5)
      on conflict (slug) do update set name=excluded.name, country=coalesce(excluded.country,wf_cities.country),
      region=coalesce(excluded.region,wf_cities.region), tier=coalesce(excluded.tier,wf_cities.tier) returning slug`,
      arr(b.cities).map((c) => [c.slug, c.name, c.country ?? null, c.region ?? null, c.tier ?? null]));
    return { upserted: n };
  },

  async upsert_creators(sql, b) {
    let n = 0;
    for (const c of arr(b.creators)) {
      const key = [c.platform || 'youtube', c.channel_id || null, c.handle || null, c.url || null];
      const existing = await sql.query(
        `select id from wf_creators where platform=$1 and coalesce(channel_id, lower(handle), lower(url)) = coalesce($2, lower($3), lower($4))`, key);
      if (existing.length) {
        await sql.query(`update wf_creators set name=coalesce($2,name), url=coalesce($3,url), instagram_url=coalesce($4,instagram_url),
          trust_tier=coalesce($5,trust_tier), partner_status=coalesce($6,partner_status), notes=coalesce($7,notes),
          uploads_playlist=coalesce($8,uploads_playlist), handle=coalesce($9,handle), updated_at=now() where id=$1`,
          [existing[0].id, c.name ?? null, c.url ?? null, c.instagram_url ?? null, c.trust_tier ?? null, c.partner_status ?? null,
           c.notes ?? null, c.uploads_playlist ?? null, c.handle ?? null]);
      } else {
        await sql.query(`insert into wf_creators (platform,handle,channel_id,name,url,instagram_url,trust_tier,partner_status,source,notes,uploads_playlist)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [c.platform || 'youtube', c.handle ?? null, c.channel_id ?? null, c.name ?? null, c.url ?? null, c.instagram_url ?? null,
           c.trust_tier ?? null, c.partner_status ?? null, c.source ?? 'sheet', c.notes ?? null, c.uploads_playlist ?? null]);
      }
      n++;
    }
    return { upserted: n };
  },

  async update_creator(sql, b) {
    const r = await sql.query(`update wf_creators set channel_id=coalesce($2,channel_id), url=coalesce($3,url), trust_tier=coalesce($4,trust_tier),
      notes=coalesce($5,notes), updated_at=now() where id=$1 returning id`, [b.id, b.channel_id ?? null, b.url ?? null, b.trust_tier ?? null, b.notes ?? null]);
    return { updated: r.length };
  },

  async list_creators(sql) {
    return { creators: await sql.query(`select * from wf_creators order by id`) };
  },

  // Insert-only. Existing ids are left untouched (history is never overwritten).
  async add_sources(sql, b) {
    let inserted = 0, transcripts = 0;
    for (const s of arr(b.sources)) {
      const r = await sql.query(`insert into wf_sources (id,platform,url,title,channel,channel_id,city_slug,published_at,views,likes,duration,description,discovered_via,transcript_status)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (id) do nothing returning id`,
        [s.id, s.platform || 'youtube', s.url, clean(s.title), clean(s.channel), s.channel_id ?? null, s.city_slug ?? null,
         s.published_at ?? null, s.views ?? null, s.likes ?? null, s.duration ?? null, clean(s.description, 4000),
         s.discovered_via ?? 'unknown', s.transcript ? 'ok' : (s.transcript_status || 'pending')]);
      if (r.length) inserted++;
      if (s.transcript) {
        const t = await sql.query(`insert into wf_transcripts (source_id,text,length,lang) values ($1,$2,$3,$4) on conflict (source_id) do nothing returning source_id`,
          [s.id, clean(s.transcript), s.transcript.length, s.lang ?? 'en']);
        if (t.length) { transcripts++; await sql.query(`update wf_sources set transcript_status='ok', updated_at=now() where id=$1`, [s.id]); }
      }
    }
    return { received: arr(b.sources).length, inserted, transcripts };
  },

  async pending_transcripts(sql, b) {
    return { sources: await sql.query(`select id,url,title,city_slug from wf_sources
      where platform='youtube' and transcript_status='pending' and transcript_attempts < 3 and not excluded
      order by (city_slug = (select slug from wf_cities where focus_rank is not null and coalesce(guide_status,'queued') <> 'done'
                             order by focus_rank limit 1)) desc nulls last, first_seen_at
      limit $1`, [Math.min(+b.limit || 50, 200)]) };
  },

  async put_transcripts(sql, b) {
    let ok = 0, none = 0;
    for (const t of arr(b.transcripts)) {
      if (t.text && t.text.length > 200) {
        await sql.query(`insert into wf_transcripts (source_id,text,length,lang) values ($1,$2,$3,$4) on conflict (source_id) do nothing`,
          [t.id, clean(t.text), t.text.length, t.lang ?? 'en']);
        await sql.query(`update wf_sources set transcript_status='ok', transcript_attempts=transcript_attempts+1, updated_at=now() where id=$1`, [t.id]);
        ok++;
      } else {
        await sql.query(`update wf_sources set transcript_attempts=transcript_attempts+1,
          transcript_status = case when transcript_attempts+1 >= 3 or $2 then 'none' else 'pending' end, updated_at=now() where id=$1`,
          [t.id, !!t.final]);
        none++;
      }
    }
    return { ok, none };
  },

  // Sources with transcripts (or captions) not yet read by the extraction step.
  async pending_extraction(sql, b) {
    return { sources: await sql.query(`select s.id,s.url,s.title,s.channel,s.city_slug,s.published_at,
        coalesce(t.length, length(s.description)) as length
      from wf_sources s left join wf_transcripts t on t.source_id=s.id
      where s.extracted_at is null and not s.excluded and (s.transcript_status='ok' or s.platform<>'youtube')
        and ($2::text is null or s.city_slug=$2 or ($2='unassigned' and s.city_slug is null))
      order by (s.city_slug = (select slug from wf_cities where focus_rank is not null and coalesce(guide_status,'queued') <> 'done'
                               order by focus_rank limit 1)) desc nulls last, s.first_seen_at
      limit $1`, [Math.min(+b.limit || 20, 100), b.city ?? null]) };
  },

  async get_transcripts(sql, b) {
    const ids = arr(b.ids).slice(0, 20);
    return { transcripts: await sql.query(`select s.id,s.title,s.channel,s.url,s.city_slug,s.published_at,s.description,t.text
      from wf_sources s left join wf_transcripts t on t.source_id=s.id where s.id = any($1)`, [ids]) };
  },

  async put_facts(sql, b) {
    const n = await bulk(sql, `insert into wf_facts (city_slug,kind,area,name,data,source_id,creator,observed_at,created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      arr(b.facts).map((f) => [f.city_slug, f.kind, clean(f.area), clean(f.name), clean(JSON.stringify(f.data || {})),
        f.source_id ?? null, f.creator ?? null, f.observed_at ?? null, f.created_by ?? 'claude']));
    return { inserted: n };
  },

  async put_tips(sql, b) {
    const n = await bulk(sql, `insert into wf_tips (scope,category,worry,tip,verified_url,verified_at,source_id,creator)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      arr(b.tips).map((t) => [t.scope, t.category, clean(t.worry), clean(t.tip), t.verified_url ?? null, t.verified_at ?? null, t.source_id ?? null, t.creator ?? null]));
    return { inserted: n };
  },

  async put_photos(sql, b) {
    const n = await bulk(sql, `insert into wf_photos (city_slug,subject_type,subject_name,url,page_url,provider,license,credit)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      arr(b.photos).map((p) => [p.city_slug ?? null, p.subject_type, p.subject_name, p.url, p.page_url ?? null, p.provider ?? null, p.license ?? null, p.credit ?? null]));
    return { inserted: n };
  },


  // Review helpers: list fact/tip rows for given sources, and change their status
  // (active | superseded | rejected). Rows are never deleted.
  async list_rows(sql, b) {
    const t = b.table === 'tips' ? 'wf_tips' : 'wf_facts';
    return { rows: await sql.query(`select id, source_id, kind, name, area, status, created_at from ${t === 'wf_tips' ? "(select id, source_id, category as kind, worry as name, scope as area, status, created_at from wf_tips) x" : t}
      where source_id = any($1) order by id`, [arr(b.source_ids)]) };
  },
  async set_status(sql, b) {
    const t = b.table === 'tips' ? 'wf_tips' : 'wf_facts';
    const st = ['active', 'superseded', 'rejected'].includes(b.status) ? b.status : null;
    if (!st) throw new Error('bad status');
    const r = await sql.query(`update ${t} set status=$2 where id = any($1) returning id`, [arr(b.ids).map(Number), st]);
    return { updated: r.length };
  },


  // Focus queue: the city being built gets (almost) all discovery effort.
  // body: { queue: ["nuremberg","cologne",...] } replaces the order; { slug, status } marks one city.
  async get_focus(sql) {
    const queue = await sql.query(`select slug,name,focus_rank,coalesce(guide_status,'queued') as guide_status from wf_cities
      where focus_rank is not null order by focus_rank`);
    const cfg = Object.fromEntries((await sql.query('select key,value from wf_config')).map((r) => [r.key, r.value]));
    return { queue, current: queue.find((c) => c.guide_status !== 'done') || null, config: cfg };
  },
  async set_focus(sql, b) {
    if (Array.isArray(b.queue)) {
      await sql.query('update wf_cities set focus_rank=null where focus_rank is not null');
      for (const [i, slug] of b.queue.entries()) await sql.query(`update wf_cities set focus_rank=$2, guide_status=coalesce(guide_status,'queued') where slug=$1`, [slug, i + 1]);
    }
    if (b.slug && b.status) await sql.query('update wf_cities set guide_status=$2 where slug=$1', [b.slug, b.status]);
    return OPS.get_focus(sql);
  },
  async set_config(sql, b) {
    await sql.query(`insert into wf_config (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value, updated_at=now()`, [b.key, JSON.stringify(b.value)]);
    return { ok: true };
  },

  async mark_extracted(sql, b) {
    const r = await sql.query(`update wf_sources set extracted_at=now(), updated_at=now() where id = any($1) returning id`, [arr(b.ids)]);
    return { marked: r.length };
  },

  // Correct the city a source belongs to (metadata only; content is never altered).
  async set_city(sql, b) {
    let n = 0;
    for (const x of arr(b.items)) {
      if (x.city_slug && x.city_name) await sql.query(`insert into wf_cities (slug,name,country,region) values ($1,$2,$3,$4) on conflict (slug) do nothing`,
        [x.city_slug, x.city_name, x.country ?? null, x.region ?? null]);
      const r = await sql.query(`update wf_sources set city_slug=$2, updated_at=now() where id=$1 returning id`, [x.id, x.city_slug ?? null]);
      n += r.length;
    }
    return { updated: n };
  },

  async exclude_source(sql, b) {
    const r = await sql.query(`update wf_sources set excluded=true, excluded_reason=$2, updated_at=now() where id=$1 returning id`, [b.id, b.reason ?? null]);
    return { excluded: r.length };
  },

  async run_discovery() {
    return discover({ force: true });
  },

  async log_run(sql, b) {
    const r = await sql.query(`insert into wf_runs (kind,finished_at,stats) values ($1, now(), $2) returning id`, [b.kind || 'manual', JSON.stringify(b.stats || {})]);
    return { id: r[0].id };
  },
};

export const handler = async (event) => {
  const token = process.env.WF_ADMIN_TOKEN;
  const given = event.headers?.['x-wf-admin-token'] || event.headers?.['X-Wf-Admin-Token'];
  if (!token || given !== token) return json(401, { error: 'unauthorised' });
  const op = event.queryStringParameters?.op;
  if (!OPS[op]) return json(400, { error: 'unknown op', ops: Object.keys(OPS) });
  let body = {};
  try { body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}; }
  catch { return json(400, { error: 'invalid JSON' }); }
  try { return json(200, await OPS[op](getSql(), body)); }
  catch (err) { console.error('[wf-admin]', op, err); return json(500, { error: err.message }); }
};
