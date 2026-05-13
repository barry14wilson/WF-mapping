import { schedule } from '@netlify/functions';
import { run } from '../../connectors/mexico-hoyodecrimen.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@daily', () =>
  runPipeline({ name: 'mexico-hoyodecrimen', connectorRun: () => run(), country: 'MX' }),
);
