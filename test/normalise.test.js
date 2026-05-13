import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SEVERITY_WEIGHTS,
  categoriseUK,
  categoriseFBI,
  categoriseICCS,
  categoriseMX,
  categoriseACLED,
  categoriseStatCan,
  categoriseABS,
} from '../lib/normalise.js';

test('severity weights match the spec', () => {
  assert.equal(SEVERITY_WEIGHTS.violent, 3);
  assert.equal(SEVERITY_WEIGHTS.sexual, 4);
  assert.equal(SEVERITY_WEIGHTS.property, 1);
  assert.equal(SEVERITY_WEIGHTS.asb, 1);
});

test('categoriseUK maps known data.police.uk categories', () => {
  assert.equal(categoriseUK('violent-crime'), 'violent');
  assert.equal(categoriseUK('robbery'), 'violent');
  assert.equal(categoriseUK('anti-social-behaviour'), 'asb');
  assert.equal(categoriseUK('burglary'), 'property');
  assert.equal(categoriseUK('bicycle-theft'), 'property');
  assert.equal(categoriseUK('violent-and-sexual-offences'), 'violent');
});

test('categoriseUK falls back to property for unknown', () => {
  assert.equal(categoriseUK('zzz-not-a-thing'), 'property');
  assert.equal(categoriseUK(undefined), 'property');
  assert.equal(categoriseUK(null), 'property');
});

test('categoriseFBI maps known offenses and falls back', () => {
  assert.equal(categoriseFBI('homicide'), 'violent');
  assert.equal(categoriseFBI('robbery'), 'violent');
  assert.equal(categoriseFBI('rape-revised'), 'sexual');
  assert.equal(categoriseFBI('burglary'), 'property');
  assert.equal(categoriseFBI('something-new'), 'property');
});

test('categoriseICCS matches by prefix', () => {
  assert.equal(categoriseICCS('0101'), 'violent');
  assert.equal(categoriseICCS('010199'), 'violent'); // sub-category
  assert.equal(categoriseICCS('0301'), 'sexual');
  assert.equal(categoriseICCS('0501'), 'property');
  assert.equal(categoriseICCS('06012'), 'property');
  assert.equal(categoriseICCS('ICCS0101'), 'violent'); // ICCS prefix stripped
  assert.equal(categoriseICCS(''), 'property');
});

test('categoriseMX handles Spanish labels', () => {
  assert.equal(categoriseMX('HOMICIDIO DOLOSO'), 'violent');
  assert.equal(categoriseMX('VIOLACION'), 'sexual');
  assert.equal(categoriseMX('ROBO A TRANSEUNTE CON VIOLENCIA'), 'violent');
  assert.equal(categoriseMX('ROBO A TRANSEUNTE SIN VIOLENCIA'), 'property');
  assert.equal(categoriseMX('ROBO DE VEHICULO SIN VIOLENCIA'), 'property');
  assert.equal(categoriseMX('SECUESTRO'), 'violent');
});

test('categoriseACLED defaults conflict events to violent', () => {
  assert.equal(categoriseACLED('Battles'), 'violent');
  assert.equal(categoriseACLED('Protests'), 'asb');
  assert.equal(categoriseACLED('Strategic developments'), 'asb');
  assert.equal(categoriseACLED('unknown-event'), 'violent');
});

test('categoriseStatCan / categoriseABS match by keyword', () => {
  assert.equal(categoriseStatCan('Total violent Criminal Code violations'), 'violent');
  assert.equal(categoriseStatCan('Sexual assault — level 1'), 'sexual');
  assert.equal(categoriseStatCan('Theft over $5,000'), 'property');
  assert.equal(categoriseABS('Sexual assault'), 'sexual');
  assert.equal(categoriseABS('Robbery'), 'violent');
  assert.equal(categoriseABS('Public order offences'), 'asb');
  assert.equal(categoriseABS('Other'), 'property');
});
