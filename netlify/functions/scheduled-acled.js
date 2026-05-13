import { schedule } from '@netlify/functions';
import { run } from '../../connectors/acled-conflict.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@monthly', () =>
  runPipeline({ name: 'acled-conflict', connectorRun: () => run() }),
);
