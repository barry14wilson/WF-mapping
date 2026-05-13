import { schedule } from '@netlify/functions';
import { run } from '../../connectors/us-fbi.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@weekly', () =>
  runPipeline({ name: 'us-fbi', connectorRun: () => run(), country: 'US' }),
);
