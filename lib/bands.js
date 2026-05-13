// Band colour palette per the Phase 6 spec.
export const BAND_COLOURS = {
  green:  '#2ECC71',
  amber:  '#F39C12',
  red:    '#E74C3C',
  purple: '#8E44AD',
};

export function colourFor(band) {
  return BAND_COLOURS[band] ?? '#888888';
}
