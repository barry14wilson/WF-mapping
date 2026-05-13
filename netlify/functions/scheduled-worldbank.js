import { schedule } from '@netlify/functions';
import { run } from '../../connectors/worldbank-global.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@monthly', () =>
  runPipeline({ name: 'worldbank-global', connectorRun: () => run() }),
);
