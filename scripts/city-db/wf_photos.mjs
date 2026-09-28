// Wiley Fox - find free-licence (Wikimedia Commons) photos for attractions named in the city database.
// Usage (from Wileyfox folder): node "Creator Guides/_build/wf_photos.mjs" london paris ...
import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.pipeline'), 'utf8').split('\n').filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const UA = { 'User-Agent': 'WileyFoxGuides/1.0 (https://www.thewileyfox.com)' };
const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const cities = process.argv.slice(2);
const photos = [];
for (const city of cities) {
  const g = await (await fetch(`https://wiley-fox.netlify.app/api/city-guide?city=${city}`)).json().catch(() => ({}));
  const have = new Set((g.photos || []).map((p) => p.subject_name.toLowerCase()));
  const names = [...new Set((g.facts?.visit || []).map((f) => f.name).filter(Boolean))].filter((n) => !have.has(n.toLowerCase())).slice(0, 10);
  const cityName = g.city?.name || city.replace(/_/g, ' ');
  for (const name of names) {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${name} ${cityName} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 5,
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: 1200 }).forEach(([k, v]) => u.searchParams.set(k, v));
    try {
      const d = await (await fetch(u, { headers: UA })).json();
      const pages = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
      const words = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const hit = pages.find((p) => { const ii = p.imageinfo?.[0]; const m = ii?.extmetadata || {};
        const lic = (m.LicenseShortName?.value || '').toLowerCase();
        return ii && ii.width >= 800 && ii.width > ii.height * 0.9 && /cc|public domain|pd/.test(lic) && !/nc|nd/.test(lic)
          && words.some((w) => p.title.toLowerCase().includes(w)); });
      if (hit) { const ii = hit.imageinfo[0], m = ii.extmetadata;
        photos.push({ city_slug: city, subject_type: 'attraction', subject_name: name, url: ii.thumburl || ii.url, page_url: ii.descriptionurl,
          provider: 'wikimedia', license: m.LicenseShortName?.value, credit: strip(m.Artist?.value).slice(0, 120) }); }
    } catch (e) { console.error(name, e.message); }
    await new Promise((r) => setTimeout(r, 400));
  }
}
if (photos.length) {
  const r = await fetch('https://wiley-fox.netlify.app/api/wf-admin?op=put_photos', { method: 'POST',
    headers: { 'x-wf-admin-token': env.WF_ADMIN_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ photos }) });
  console.log(await r.text());
}
console.log(JSON.stringify(photos.map((p) => `${p.city_slug}: ${p.subject_name} (${p.license})`)));
