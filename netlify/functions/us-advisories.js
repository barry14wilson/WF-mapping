// GET /api/us-advisories
//
// Live US State Department travel advisories for every country, normalised for the
// Wiley Fox map. Wiley Fox uses ONE official advisory source everywhere (US State Dept).
// Source: https://cadataapi.state.gov/api/TravelAdvisories (public, no key; no CORS,
// hence this proxy). Cached for 6 hours at the CDN.

const SRC = 'https://cadataapi.state.gov/api/TravelAdvisories';
const LABEL = { 1: 'Exercise normal precautions', 2: 'Exercise increased caution', 3: 'Reconsider travel', 4: 'Do not travel' };
const RISKS = [['crime', 'Crime'], ['terror', 'Terrorism'], ['civil unrest', 'Civil Unrest'], ['unrest', 'Civil Unrest'], ['kidnap', 'Kidnapping'],
  ['health', 'Health'], ['natural disaster', 'Natural Disaster'], ['wrongful detention', 'Wrongful Detention'], ['armed conflict', 'Armed Conflict'],
  ['drone', 'Armed Conflict'], ['missile', 'Armed Conflict'], ['exit ban', 'Exit Bans']];

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();

function normalise(item) {
  const title = String(item.Title || '');
  const m = title.match(/^(.*?)\s*(?:Travel Advisory)?\s*[-–]\s*Level\s*(\d)/i);
  if (!m) return null;
  const level = +m[2];
  const text = strip(item.Summary);
  // The headline is the sentence that states the advice ("Reconsider travel to X due to ...").
  // Summaries often open with a change note ("Reissued after periodic review..."), so skip those.
  const sentences = text.split(/(?<=\.)\s+/);
  const headline = (sentences.find((t) => /^(exercise|reconsider|do not travel)/i.test(t))
    || `${LABEL[level]} in ${m[1].trim()}.`).slice(0, 280);
  const reasonPart = (headline.match(/due to (.*)$/i) || [])[1] || '';
  const risks = [...new Set(RISKS.filter(([k]) => reasonPart.toLowerCase().includes(k)).map(([, v]) => v))];
  return {
    name: m[1].trim(),
    code: Array.isArray(item.Category) ? item.Category[0] : null,
    level,
    label: LABEL[level],
    headline,
    risks,
    updated: (item.Updated || item.Published || '').slice(0, 10),
    url: item.Link || 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
  };
}

export const handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const r = await fetch(SRC, { headers: { 'User-Agent': 'WileyFox/1.0 (+https://www.thewileyfox.com)' } });
    if (!r.ok) throw new Error('State Dept ' + r.status);
    // One row per country: keep the most recently updated advisory
    const best = new Map();
    for (const row of (await r.json()).map(normalise).filter(Boolean)) {
      const prev = best.get(row.name);
      if (!prev || row.updated > prev.updated) best.set(row.name, row);
    }
    const rows = [...best.values()];
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=3600, s-maxage=21600' },
      body: JSON.stringify({ source: 'US Department of State — travel.state.gov', fetched_at: new Date().toISOString(), count: rows.length, advisories: rows }) };
  } catch (err) {
    console.error('[us-advisories]', err);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'advisory source unavailable' }) };
  }
};
