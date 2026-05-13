import { neon } from '@neondatabase/serverless';

let sql;
let injected = null;

// Test seam — replace the cached client with a stub. Production code
// never calls this. See test/_utils.js.
export function __setSqlForTests(stub) {
  injected = stub;
  sql = null;
}

// Returns a tagged-template SQL client:
//   const sql = getSql();
//   const rows = await sql`select * from crime_incidents limit 5`;
// `sql.query(text, params)` is also supported for dynamic queries.
export function getSql() {
  if (injected) return injected;
  if (sql) return sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Missing DATABASE_URL. Set it in .env or your deploy environment ' +
        '(Neon pooled connection string).',
    );
  }
  sql = neon(url);
  return sql;
}

export function isDryRun() {
  const v = process.env.DRY_RUN;
  return v === '1' || v === 'true';
}
