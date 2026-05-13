import { getSql, isDryRun } from './db.js';

export async function logPipelineRun({
  source,
  recordsFetched,
  recordsInserted,
  errors,
}) {
  const payload = {
    source,
    records_fetched: recordsFetched ?? 0,
    records_inserted: recordsInserted ?? 0,
    errors: errors && errors.length ? String(errors).slice(0, 8000) : null,
  };

  if (isDryRun()) {
    console.log('[dry-run] pipeline_logs ←', payload);
    return;
  }

  try {
    const sql = getSql();
    await sql.query(
      `insert into pipeline_logs (source, records_fetched, records_inserted, errors)
       values ($1, $2, $3, $4)`,
      [payload.source, payload.records_fetched, payload.records_inserted, payload.errors],
    );
  } catch (err) {
    // Don't throw — logging failure shouldn't kill the pipeline run.
    console.error('Failed to write pipeline_logs row:', err.message);
  }
}
