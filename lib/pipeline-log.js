import { getSupabase, isDryRun } from './supabase.js';

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

  const { error } = await getSupabase().from('pipeline_logs').insert(payload);
  if (error) {
    // Don't throw — logging failure shouldn't kill the pipeline run.
    console.error('Failed to write pipeline_logs row:', error.message);
  }
}
