import { latLngToCell } from 'h3-js';

// Resolutions we index at, per spec:
//   r7  ≈ 5 km² cells   (city-level rollups)
//   r9  ≈ 0.1 km² cells (neighbourhood)
//   r11 ≈ 2,150 m² cells (street segment)
export const RESOLUTIONS = [7, 9, 11];

export function indexLatLng(lat, lng) {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null };
  }
  return {
    h3_index_r7: latLngToCell(lat, lng, 7),
    h3_index_r9: latLngToCell(lat, lng, 9),
    h3_index_r11: latLngToCell(lat, lng, 11),
  };
}
