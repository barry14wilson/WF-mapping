// Test helpers — kept deliberately tiny.
//
// makeMockSql builds a callable that mimics @neondatabase/serverless's
// `neon()` return: callable both as a tagged template and via .query().
//
// Example:
//   const sql = makeMockSql({
//     'select count(*)': () => [{ count: 3 }],
//     'insert into pipeline_logs': () => [],
//   });
//   __setSqlForTests(sql);

export function makeMockSql(handlers = {}) {
  const calls = [];

  function pickHandler(text) {
    const lower = text.toLowerCase();
    const match = Object.keys(handlers).find((k) => lower.includes(k.toLowerCase()));
    return match ? handlers[match] : null;
  }

  async function run(text, params) {
    calls.push({ text, params });
    const h = pickHandler(text);
    return h ? await h({ text, params }) : [];
  }

  // Tagged-template callable: sql`select ...`
  const tag = async (strings, ...values) => {
    const text = String.raw({ raw: strings }, ...values.map((_, i) => `$${i + 1}`));
    return run(text, values);
  };

  // .query(text, params) form.
  tag.query = (text, params) => run(text, params || []);
  tag.__calls = calls;

  return tag;
}

// Replace globalThis.fetch with a function that returns queued responses.
export function mockFetch(responses) {
  const queue = [...responses];
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const r = queue.shift();
    if (!r) throw new Error(`mockFetch: no response queued for ${url}`);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? null),
    };
  };
  return { calls };
}

export function restoreFetch() {
  delete globalThis.fetch;
}
