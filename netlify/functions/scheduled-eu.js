import { schedule } from '@netlify/functions';
import { run } from '../../connectors/eu-eurostat.js';
import { runPipeline } from './_run-pipeline.js';

const EU_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
];

export const handler = schedule('@weekly', () =>
  runPipeline({ name: 'eu-eurostat', connectorRun: () => run(), countries: EU_COUNTRIES }),
);
