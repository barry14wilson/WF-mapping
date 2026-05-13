import { getSupabase, isDryRun } from './supabase.js';

const DEFAULT_BATCH = 500;

export async function upsertIncidents(rows, { batchSize = DEFAULT_BATCH } = {}) {
  if (!rows.length) return 0;

  if (isDryRun()) {
    console.log(`[dry-run] would upsert ${rows.length} rows; sample:`, rows[0]);
    return rows.length;
  }

  const supabase = getSupabase();
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error, count } = await supabase
      .from('crime_incidents')
      .upsert(batch, {
        onConflict: 'source_api,source_record_id',
        count: 'exact',
        ignoreDuplicates: false,
      });
    if (error) throw error;
    inserted += count ?? batch.length;
  }

  return inserted;
}
