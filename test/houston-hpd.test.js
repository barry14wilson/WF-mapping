import { test } from 'node:test';
import assert from 'node:assert/strict';

import { categoriseNIBRS } from '../lib/normalise.js';
import { parseCsv, normaliseHPD } from '../connectors/us-houston-hpd.js';

const CSV = [
  '﻿Incident,Occurrence Date,Occurrence Hour,NIBRS Class,NIBRS Description,Offense Count,Beat,Premise,Street Number,Street Name,Street Type,Street Suffix,City,ZIP Code,Map Longitude,Map Latitude',
  '1,2026-05-02,10,13A,Aggravated Assault,1,Beat 1A10,"Residence, Home",100,MAIN,ST,,HOUSTON,77002,-95.36,29.76',
  '1,2026-05-02,10,13A,Aggravated Assault,1,Beat 1A10,"Residence, Home",100,MAIN,ST,,HOUSTON,77002,-95.36,29.76',
  '2,2026-05-03,11,90Z,All other offenses,1,Beat 1A10,Street,100,MAIN,ST,,HOUSTON,77002,-95.36,29.76',
  '3,2026-04-03,11,11A,Rape,1,Beat 1A10,Street,100,MAIN,ST,,HOUSTON,77002,-95.36,29.76',
  '4,2026-05-04,12,09C,Justifiable homicide,1,Beat 1A10,Street,100,MAIN,ST,,HOUSTON,77002,-95.36,29.76',
].join('\n');

test('NIBRS codes map to severity buckets', () => {
  assert.equal(categoriseNIBRS('09A'), 'violent');
  assert.equal(categoriseNIBRS('11a'), 'sexual');
  assert.equal(categoriseNIBRS('23F'), 'property');
  assert.equal(categoriseNIBRS('90C'), 'asb');
  assert.equal(categoriseNIBRS(''), 'property');
});

test('HPD rows: quoted commas, month filter, Group B / 09C dropped, duplicates merged', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows[0].Premise, 'Residence, Home');
  const out = normaliseHPD(rows, ['2026-05']);
  assert.equal(out.length, 1);
  assert.equal(out[0].source_record_id, '1-13A');
  assert.equal(out[0].incident_count, 2);
  assert.equal(out[0].severity_category, 'violent');
  assert.equal(out[0].incident_date, '2026-05-02');
  assert.ok(out[0].h3_index_r9);
});

test('latestMonths follows the data, not the calendar', async () => {
  const { latestMonths } = await import('../connectors/us-houston-hpd.js');
  const rows = [];
  for (const m of ['2026-03', '2026-04', '2026-05']) for (let i = 0; i < 150; i++) rows.push({ 'Occurrence Date': `${m}-01` });
  rows.push({ 'Occurrence Date': '2026-06-01' }); // a thin, just-started month is ignored
  assert.deepEqual(latestMonths(rows, 2), ['2026-04', '2026-05']);
});
