# Builds per-city data-zone GeoJSON for the /new map: SIMD 2020 crime indicator (recorded crime 2017/18,
# rate per 10,000 residents) on 2011 data zones, coloured with the official-area scoring curve.
import csv, json, math, sys, os, shapefile
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform
from pyproj import Transformer
SRC = sys.argv[1]; OUT = sys.argv[2]
tr = Transformer.from_crs(27700, 4326, always_xy=True).transform
rate, count = {}, {}
for r in csv.DictReader(open(f'{SRC}/simd_crime.csv')):
    if '2017-2018' not in r['period']: continue
    dz = r['dz'].rsplit('/', 1)[-1]
    (rate if r['mt'].endswith('ratio') else count)[dz] = float(r['val'])
both = [d for d in rate if d in count and rate[d] > 0]
nat = sum(count[d] for d in both) / sum(count[d] / rate[d] * 1e4 for d in both) * 1e4
print('Scotland SIMD crime rate per 10k (2017/18):', round(nat, 1), 'zones with data', len(rate))
ca = {}; iz = {}
for r in csv.DictReader(open(f'{SRC}/dz_council.csv')):
    d = r['dz'].rsplit('/', 1)[-1]; ca[d] = r['ca'].rsplit('/', 1)[-1]; iz[d] = r['izname']
CITY = {'edinburgh': ('S12000036', None), 'glasgow': ('S12000049', None), 'aberdeen': ('S12000033', None),
        'inverness': ('S12000017', (57.4778, -4.2247, 12000))}   # Highland: urban Inverness only (12 km)
def band_of(ratio):
    O = max(5, min(95, round(75 - 20 * math.log2(ratio))))
    return O, (5 if O >= 80 else 4 if O >= 60 else 3 if O >= 40 else 2 if O >= 20 else 1)
rd = shapefile.Reader(f'{SRC}/SG_DataZone_Bdry_2011')
feats = {c: [] for c in CITY}
for sr in rd.iterShapeRecords():
    d = sr.record['DataZone']; c_ca = ca.get(d)
    for city, (code, rad) in CITY.items():
        if c_ca != code: continue
        g = shape(sr.shape.__geo_interface__)
        if rad:
            cx, cy = Transformer.from_crs(4326, 27700, always_xy=True).transform(rad[1], rad[0])
            if g.centroid.distance(Point(cx, cy)) > rad[2]: continue
        g = g.simplify(12, preserve_topology=True)
        g = transform(tr, g)
        gj = mapping(g)
        def rnd(x):
            return [rnd(y) for y in x] if isinstance(x[0], (list, tuple)) else [round(x[0], 5), round(x[1], 5)]
        gj = {'type': gj['type'], 'coordinates': rnd(gj['coordinates'])}
        p = {'id': d, 'n': sr.record['Name'], 'iz': iz.get(d, '')}
        if d in rate:
            ratio = rate[d] / nat; O, b = band_of(max(ratio, 0.01))
            p.update(r=round(rate[d]), x=round(ratio, 2), b=b)
        else: p['b'] = 0
        feats[city].append({'type': 'Feature', 'properties': p, 'geometry': gj})
os.makedirs(OUT, exist_ok=True)
for city, f in feats.items():
    json.dump({'type': 'FeatureCollection', 'meta': {'source': 'Scottish Government, SIMD 2020 crime indicator (recorded crime 2017/18, rate per 10,000 residents), 2011 data zones', 'url': 'https://statistics.gov.scot/data/scottish-index-of-multiple-deprivation---crime-indicators', 'scotlandRate': round(nat, 1), 'period': '2017/18'}, 'features': f},
              open(f'{OUT}/{city}.json', 'w'), separators=(',', ':'))
    bands = [x['properties']['b'] for x in f]
    print(city, len(f), 'zones', {k: bands.count(k) for k in range(6)}, round(os.path.getsize(f'{OUT}/{city}.json') / 1024), 'KB')
