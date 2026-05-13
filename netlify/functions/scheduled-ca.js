import { schedule } from '@netlify/functions';
import { run } from '../../connectors/canada-statcan.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@weekly', () =>
  runPipeline({ name: 'canada-statcan', connectorRun: () => run(), country: 'CA' }),
);
