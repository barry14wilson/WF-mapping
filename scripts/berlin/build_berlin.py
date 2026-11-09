#!/usr/bin/env python3
"""Build Berlin's district-region crime layer: new/data/berlin/kriminalitaetsatlas.json

Sources
  * Crime counts: Polizei Berlin, Kriminalitätsatlas Berlin (Fallzahlen per Bezirksregion, LOR 2021)
    https://daten.berlin.de/datensaetze/kriminalitatsatlas-berlin
    file: https://www.berlin.de/polizei/_assets/dienststellen/lka/fallzahlen_hz-2016-2025.xlsx
  * Areas: Geoportal Berlin LOR 2021 WFS (https://gdi.berlin.de/services/wfs/lor_2021),
    layer a_lor_plr_2021 (542 Planungsräume, each tagged with its Bezirksregion).

Berlin publishes counts per Bezirksregion (143 areas, ~6 km² each). Placing a whole region at one
point would draw it as a single hotspot, so each region's count is spread across its planning
areas in proportion to their area. This is a presentation choice, not finer data: the card says so.
Rows: [lat, lng, categoryIndex, count]; `months` = 12 (annual figures).

Usage: python3 scripts/berlin/build_berlin.py atlas.xlsx plr.json --year 2025   (refresh yearly, ~spring)
"""
import argparse, json, os, datetime as dt, collections
import openpyxl

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'berlin', 'kriminalitaetsatlas.json')

def centroid(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    best, ba = None, 0
    for poly in polys:
        ring = poly[0]; a = cx = cy = 0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
        if abs(a) > ba: ba, best = abs(a), (cy / (3 * a), cx / (3 * a))
    return best

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('xlsx'); ap.add_argument('plr'); ap.add_argument('--year', default='2025'); ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    ws = openpyxl.load_workbook(a.xlsx, read_only=True, data_only=True)[f'Fallzahlen_{a.year}']
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and r[0] and str(r[0]).startswith('LOR-Schl'))
    head = [str(h or '').replace('\n', ' ').replace('-', '').lower() for h in rows[hi]]
    def col(*keys):
        for i, h in enumerate(head):
            if all(k in h for k in keys): return i
        raise SystemExit(f'column {keys} not found in {head}')
    C = dict(raub=col('raub'), kv=col('körper', 'insgesamt'), frei=col('freiheits'), dieb=col('diebstahl', 'insgesamt'),
             kfz=col('diebstahl von kraftwag'), ankfz=col('an/aus kfz'), rad=col('fahrrad'), wohn=col('wohnraum'),
             brand=col('brand', 'insgesamt'), sach=col('sach', 'insgesamt'), drog=col('rauschgift'))
    def n(r, k): return int(r[C[k]] or 0)
    region = {}
    for r in rows[hi + 1:]:
        key = str(r[0] or '').strip()
        # skip district totals (xx0000), 'nicht zuzuordnen' rows (xx9900, 999900) and the city total (999999)
        if len(key) != 6 or not key.isdigit() or key.endswith('0000') or key.endswith('9900') or key == '999999': continue
        theft_other = n(r, 'dieb') - n(r, 'kfz') - n(r, 'ankfz') - n(r, 'rad') - n(r, 'wohn')
        region[key] = {'robbery': n(r, 'raub'), 'violent-crime': n(r, 'kv') + n(r, 'frei'), 'vehicle-crime': n(r, 'kfz') + n(r, 'ankfz'),
                       'bicycle-theft': n(r, 'rad'), 'burglary': n(r, 'wohn'), 'other-theft': max(0, theft_other),
                       'criminal-damage-arson': n(r, 'brand') + n(r, 'sach'), 'drugs': n(r, 'drog')}
    plr = collections.defaultdict(list)
    for f in json.load(open(a.plr))['features']:
        p = f['properties']; c = centroid(f['geometry'])
        if c: plr[p['bzr_id']].append((c, float(p['finhalt'])))
    cats = sorted({c for v in region.values() for c in v})
    out, placed, missing = [], 0, 0
    for key, counts in region.items():
        parts = plr.get(key)
        tot = sum(counts.values())
        if not parts: missing += tot; continue
        area = sum(w for _, w in parts)
        for (lat, lng), w in parts:
            for c, v in counts.items():
                share = round(v * w / area, 2)
                if share > 0: out.append([round(lat, 5), round(lng, 5), cats.index(c), share])
        placed += tot
    payload = {'source': f'Polizei Berlin — Kriminalitätsatlas {a.year} (offences per Bezirksregion)',
               'source_url': 'https://daten.berlin.de/datensaetze/kriminalitatsatlas-berlin',
               'points_source': 'Geoportal Berlin LOR 2021 Planungsräume (area-weighted spread within each Bezirksregion)',
               'period': a.year, 'months': 12, 'generated': dt.date.today().isoformat(),
               'note': 'Annual counts per district region, spread across its planning areas by area (not exact locations).',
               'cats': cats, 'rows': out}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(payload, open(a.out, 'w'), separators=(',', ':'))
    print(f'regions {len(region)}, placed {placed}, unplaced {missing}; rows {len(out)}; {os.path.getsize(a.out)//1024} KB')

if __name__ == '__main__':
    main()
