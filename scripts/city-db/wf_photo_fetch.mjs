// Wiley Fox - download free-licence (Wikimedia Commons) photos for a city guide.
// Usage: node wf_photo_fetch.mjs <wants.json> <out_dir>   wants = [{key, q}]
import fs from 'fs'; import path from 'path';
const [,, wantsFile, outDir] = process.argv;
const wants = JSON.parse(fs.readFileSync(wantsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const credFile = path.join(outDir, 'credits.json');
const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : {};
const UA = { 'User-Agent': 'WileyFoxGuides/1.0 (https://www.thewileyfox.com)' };
const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const used = new Set(Object.values(credits).map((c) => c.page));
for (const w of wants) {
  if (credits[w.key]) continue;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${w.q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 8,
    prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: 1400 }).forEach(([k, v]) => u.searchParams.set(k, v));
  try {
    const d = await (await fetch(u, { headers: UA })).json();
    const pages = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
    const hit = pages.find((p) => { const ii = p.imageinfo?.[0]; const lic = (ii?.extmetadata?.LicenseShortName?.value || '').toLowerCase();
      return ii && ii.width >= 1000 && ii.width >= ii.height * 1.1 && /cc|public domain|pd/.test(lic) && !/nc|nd/.test(lic) && !used.has(ii.descriptionurl); });
    if (!hit) { console.log('MISS', w.key); continue; }
    const ii = hit.imageinfo[0], m = ii.extmetadata;
    const file = `img/${slug(w.key)}.jpg`;
    const buf = Buffer.from(await (await fetch(ii.thumburl, { headers: UA })).arrayBuffer());
    fs.writeFileSync(path.join(outDir, path.basename(file)), buf);
    credits[w.key] = { file, artist: strip(m.Artist?.value).slice(0, 120), page: ii.descriptionurl, license: m.LicenseShortName?.value, title: hit.title };
    used.add(ii.descriptionurl);
    console.log('OK', w.key, '<-', hit.title);
  } catch (e) { console.log('ERR', w.key, e.message); }
  await new Promise((r) => setTimeout(r, 500));
}
fs.writeFileSync(credFile, JSON.stringify(credits, null, 1));
