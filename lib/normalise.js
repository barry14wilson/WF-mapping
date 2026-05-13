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
