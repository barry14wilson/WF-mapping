// Severity mapping, per spec Phase 2:
//   violent → 3× weight
//   sexual  → 4× weight
//   asb / theft / property → 1× weight
// These weights are applied by the scoring engine; here we only assign the
// category. Each connector calls categoriseFor<Source>(rawType) to map its
// native taxonomy to one of the four buckets.

export const SEVERITY_WEIGHTS = {
  violent: 3,
  sexual: 4,
  property: 1,
  asb: 1,
};

// UK data.police.uk category slugs → severity bucket.
// Reference: https://data.police.uk/docs/method/crime-street/
const UK_CATEGORY_MAP = {
  'anti-social-behaviour': 'asb',
  'bicycle-theft': 'property',
  burglary: 'property',
  'criminal-damage-arson': 'property',
  drugs: 'property',
  'other-theft': 'property',
  'possession-of-weapons': 'violent',
  'public-order': 'asb',
  robbery: 'violent',
  shoplifting: 'property',
  'theft-from-the-person': 'property',
  'vehicle-crime': 'property',
  'violent-crime': 'violent',
  // Legacy slug used in pre-2017 data — bundles violent + sexual together.
  'violent-and-sexual-offences': 'violent',
  'other-crime': 'property',
};

export function categoriseUK(category) {
  if (!category) return 'property';
  return UK_CATEGORY_MAP[category] || 'property';
}

// FBI NIBRS / SRS offense codes → severity bucket.
// Covers the offense_code values returned by the Crime Data Explorer
// summarized endpoint. Anything not listed defaults to 'property'.
const FBI_OFFENSE_MAP = {
  // Violent
  homicide: 'violent',
  'murder-and-nonnegligent-manslaughter': 'violent',
  manslaughter: 'violent',
  robbery: 'violent',
  'aggravated-assault': 'violent',
  assault: 'violent',
  'violent-crime': 'violent',
  // Sexual
  rape: 'sexual',
  'rape-legacy': 'sexual',
  'rape-revised': 'sexual',
  'sex-offenses': 'sexual',
  // Property
  burglary: 'property',
  'larceny-theft': 'property',
  'motor-vehicle-theft': 'property',
  arson: 'property',
  'property-crime': 'property',
};

export function categoriseFBI(offense) {
  if (!offense) return 'property';
  return FBI_OFFENSE_MAP[offense] || 'property';
}

// ICCS — International Classification of Crime for Statistical Purposes.
// Used by Eurostat (crim_off_cat), UNODC and many comparable datasets.
// Reference: https://www.unodc.org/unodc/en/data-and-analysis/statistics/iccs.html
// Codes are matched by prefix so sub-categories inherit the parent's bucket.
const ICCS_PREFIX_MAP = [
  ['0101', 'violent'], // Intentional homicide
  ['0102', 'violent'], // Attempted intentional homicide
  ['0103', 'violent'], // Assault
  ['0104', 'violent'], // Threat
  ['0105', 'violent'], // Coercion
  ['0106', 'violent'], // Kidnapping
  ['0107', 'violent'], // Trafficking in persons
  ['02',   'violent'], // Acts causing harm or risk of harm
  ['0301', 'sexual'],  // Sexual violence
  ['0302', 'sexual'],  // Rape
  ['0303', 'sexual'],  // Sexual assault
  ['0304', 'sexual'],  // Sexual exploitation
  ['0305', 'sexual'],  // Other sexual offences
  ['04',   'violent'], // Acts against property involving violence (robbery)
  ['0501', 'property'], // Burglary
  ['0502', 'property'], // Theft
  ['0503', 'property'], // Motor vehicle theft
  ['0504', 'property'], // Property damage
  ['06',   'property'], // Acts involving controlled drugs
  ['07',   'property'], // Acts involving fraud, deception
  ['08',   'property'], // Acts against public order, authority
  ['09',   'asb'],      // Acts against public order, asb-ish
];

export function categoriseICCS(code) {
  if (!code) return 'property';
  const c = String(code).replace(/^ICCS/i, '');
  for (const [prefix, bucket] of ICCS_PREFIX_MAP) {
    if (c.startsWith(prefix)) return bucket;
  }
  return 'property';
}

// hoyodecrimen.com publishes Mexico City crime by category — Spanish labels.
const MX_CRIME_MAP = {
  'HOMICIDIO DOLOSO': 'violent',
  'HOMICIDIO CULPOSO': 'violent',
  'LESIONES POR ARMA DE FUEGO': 'violent',
  'LESIONES DOLOSAS POR ARMA BLANCA': 'violent',
  'ROBO DE VEHICULO AUTOMOTOR': 'property',
  'ROBO DE VEHICULO CON VIOLENCIA': 'violent',
  'ROBO DE VEHICULO SIN VIOLENCIA': 'property',
  'ROBO A TRANSEUNTE EN VIA PUBLICA CON Y SIN VIOLENCIA': 'violent',
  'ROBO A TRANSEUNTE CON VIOLENCIA': 'violent',
  'ROBO A TRANSEUNTE SIN VIOLENCIA': 'property',
  'ROBO A CASA HABITACION CON VIOLENCIA': 'violent',
  'ROBO A CASA HABITACION SIN VIOLENCIA': 'property',
  'ROBO A NEGOCIO CON VIOLENCIA': 'violent',
  'ROBO A NEGOCIO SIN VIOLENCIA': 'property',
  'VIOLACION': 'sexual',
  'VIOLACION EQUIPARADA': 'sexual',
  'SECUESTRO': 'violent',
};

export function categoriseMX(label) {
  if (!label) return 'property';
  const upper = String(label).toUpperCase();
  if (MX_CRIME_MAP[upper]) return MX_CRIME_MAP[upper];
  if (upper.includes('VIOLAC')) return 'sexual';
  if (upper.includes('HOMICID') || upper.includes('LESION')) return 'violent';
  if (upper.startsWith('ROBO') && upper.includes('VIOLENCIA') && !upper.includes('SIN')) {
    return 'violent';
  }
  if (upper.startsWith('ROBO')) return 'property';
  return 'property';
}

// ACLED event types — conflict events. Bucketed conservatively.
const ACLED_EVENT_MAP = {
  'Battles': 'violent',
  'Violence against civilians': 'violent',
  'Explosions/Remote violence': 'violent',
  'Riots': 'violent',
  'Protests': 'asb',
  'Strategic developments': 'asb',
};

export function categoriseACLED(eventType) {
  if (!eventType) return 'violent';
  return ACLED_EVENT_MAP[eventType] || 'violent';
}

// Canadian Centre for Justice & Community Safety Statistics — UCR codes.
// Loose mapping — refine against StatCan's offence taxonomy when live data
// is available.
export function categoriseStatCan(label) {
  if (!label) return 'property';
  const s = String(label).toLowerCase();
  if (/sexual|rape/.test(s)) return 'sexual';
  if (/violent|homicide|murder|assault|robbery|weapon|kidnap|abduct/.test(s)) {
    return 'violent';
  }
  if (/mischief|disturb|nuisance/.test(s)) return 'asb';
  return 'property';
}

// ABS / ANZSOC offence divisions — high-level mapping.
export function categoriseABS(label) {
  if (!label) return 'property';
  const s = String(label).toLowerCase();
  if (/sexual/.test(s)) return 'sexual';
  if (/violent|homicide|assault|robbery|kidnap|abduct|weapon/.test(s)) return 'violent';
  if (/public order|disorderly|nuisance/.test(s)) return 'asb';
  return 'property';
}
