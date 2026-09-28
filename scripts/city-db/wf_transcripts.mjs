// Wiley Fox - fetch pending YouTube transcripts on Barry's Mac and send them to the city database.
// YouTube refuses transcript requests from cloud servers, so this step runs locally.
// Usage (from the Wileyfox folder):  node "Creator Guides/_build/wf_transcripts.mjs" [limit] [parallel=4]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { YoutubeTranscript } = require('youtube-transcript');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.pipeline'), 'utf8').split('\n')
  .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const API = 'https://wiley-fox.netlify.app/api/wf-admin';
const call = async (op, body = {}) => {
  const r = await fetch(`${API}?op=${op}`, { method: 'POST', headers: { 'x-wf-admin-token': env.WF_ADMIN_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${op} ${r.status} ${await r.text()}`);
  return r.json();
};
const decode = (s) => s.replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"').replace(/&amp;/g, '&');

const limit = +process.argv[2] || 60;
const conc = +process.argv[3] || 4;
const { sources } = await call('pending_transcripts', { limit });
let ok = 0, none = 0;
const out = [];
const fetchOne = async (s) => {
  const vid = s.id.replace(/^yt:/, '');
  let text = '';
  try { text = (await YoutubeTranscript.fetchTranscript(vid, { lang: 'en' })).map((x) => decode(x.text)).join(' '); }
  catch { try { text = (await YoutubeTranscript.fetchTranscript(vid)).map((x) => decode(x.text)).join(' '); } catch { text = ''; } }
  out.push({ id: s.id, text: text.replace(/\s+/g, ' ').trim() });
  text.length > 200 ? ok++ : none++;
  if (out.length >= 20) await call('put_transcripts', { transcripts: out.splice(0) });
};
const queue = [...sources];
await Promise.all(Array.from({ length: conc }, async () => {
  while (queue.length) { await fetchOne(queue.shift()); await new Promise((r) => setTimeout(r, 300)); }
}));
if (out.length) await call('put_transcripts', { transcripts: out });
await call('log_run', { kind: 'mac_transcripts', stats: { requested: sources.length, ok, none } });
console.log(JSON.stringify({ requested: sources.length, ok, none }));
