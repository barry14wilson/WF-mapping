import { schedule } from '@netlify/functions';
import { run } from '../../connectors/uk-police.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@daily', () =>
  runPipeline({ name: 'uk-police', connectorRun: () => run(), country: 'GB' }),
);
