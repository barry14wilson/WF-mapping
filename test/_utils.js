// Test helpers — kept deliberately tiny.
//
// makeMockSupabase builds a chainable stub that records every call and
// returns whatever the test pre-loaded for a given (table, op) pair.
//
// Example:
//   const supabase = makeMockSupabase({
//     'crime_incidents:select': () => ({ data: [...], error: null }),
//     'h3_safety_scores:upsert': () => ({ count: 2, error: null }),
//   });
//   __setClientForTests(supabase);

export function makeMockSupabase(handlers = {}) {
  const calls = [];

  function builder(table) {
    const state = { table, op: null, args: [] };

    const proxy = {
      _state: state,
      select(...a) { state.op = 'select'; state.args.push(['select', a]); return proxy; },
      eq(...a)     { state.args.push(['eq', a]); return proxy; },
      not(...a)    { state.args.push(['not', a]); return proxy; },
      in(...a)     { state.args.push(['in', a]); return proxy; },
      range(...a)  { state.args.push(['range', a]); return proxy; },
      upsert(rows, opts) {
        state.op = 'upsert';
        state.args.push(['upsert', [rows, opts]]);
        return resolve();
      },
      insert(rows) {
        state.op = 'insert';
        state.args.push(['insert', [rows]]);
        return resolve();
      },
      // Awaiting the builder triggers the configured select handler.
      then(onFulfilled, onRejected) {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    function resolve() {
      calls.push({ table, op: state.op, args: state.args });
      const key = `${table}:${state.op}`;
      const handler = handlers[key];
      const result = handler
        ? handler({ table, op: state.op, args: state.args })
        : { data: [], count: 0, error: null };
      return Promise.resolve(result);
    }

    return proxy;
  }

  return {
    from(table) { return builder(table); },
    __calls: calls,
  };
}

// Replace globalThis.fetch with a function that returns the queued
// responses in order. Each entry is { ok, status, json, text }.
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
