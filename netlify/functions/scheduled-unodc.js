import { schedule } from '@netlify/functions';
import { run } from '../../connectors/unodc-global.js';
import { runPipeline } from './_run-pipeline.js';

export const handler = schedule('@monthly', () =>
  runPipeline({ name: 'unodc-global', connectorRun: () => run() }),
);
