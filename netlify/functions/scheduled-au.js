import { schedule } from '@netlify/functions';
import { run } from '../../connectors/australia-abs.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@weekly', () =>
  runPipeline({ name: 'australia-abs', connectorRun: () => run(), country: 'AU' }),
);
