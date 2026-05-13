import { createClient } from '@supabase/supabase-js';

let client;
let injected = null;

// Test seam — replace the cached client with a stub. Production code
// never calls this. See test/_utils.js.
export function __setClientForTests(stub) {
  injected = stub;
  client = null;
}

export function getSupabase() {
  if (injected) return injected;
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set them in .env or your deploy environment.',
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function isDryRun() {
  const v = process.env.DRY_RUN;
  return v === '1' || v === 'true';
}
