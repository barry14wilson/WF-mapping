import { schedule } from '@netlify/functions';
import { run } from '../../connectors/us-houston-hpd.js';
import { runPipeline } from './_run-pipeline.js';

// HPD posts each month 1–4 weeks after it ends; the 20th catches most of it.
export const handler = schedule('0 6 20 * *', () =>
  runPipeline({ name: 'us-houston-hpd', connectorRun: () => run(), country: 'US' }),
);
