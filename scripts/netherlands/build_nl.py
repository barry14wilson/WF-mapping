#!/usr/bin/env python3
"""Build the Dutch neighbourhood (buurt) crime layer: new/data/netherlands/nl_buurt.json

Sources
  * Crime: Politie / CBS open data 47022NED "Geregistreerde misdrijven; soort misdrijf, wijk, buurt, maandcijfers"
    https://data.politie.nl/#/Politie/nl/dataset/47022NED  (OData: https://dataderden.cbs.nl/ODataApi/odata/47022NED/)
  * Neighbourhood centres: CBS/PDOK Wijk- en Buurtkaart (WFS), polygon centroids.
    https://service.pdok.nl/cbs/wijkenbuurten/<year>/wfs/v1_0

Takes the latest N final months (default 3), averages to a month, and writes rows
[lat, lng, categoryIndex, monthlyCount] per buurt × Wiley Fox category.
Usage: python3 scripts/netherlands/build_nl.py [--months 3]   (refresh monthly)
"""
import argparse, json, os, urllib.parse as P, urllib.request as U, datetime as dt, collections

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'netherlands', 'nl_buurt.json')
ODATA = 'https://dataderden.cbs.nl/ODataApi/odata/47022NED/'
FEED = 'https://dataderden.cbs.nl/ODataFeed/odata/47022NED/'
CITIES = {'GM0363': 'Amsterdam', 'GM0599': 'Rotterdam', 'GM0518': 'The Hague', 'GM0344': 'Utrecht'}
# Kept offence types → Wiley Fox category. Dropped: road accidents, relationship disputes, environmental,
# traffic/DUI, fraud, cybercrime, immigration and other offences with no meaningful street location.
MAP = {
    '1.1.1': 'burglary', '1.1.2': 'burglary', '2.5.1': 'burglary',
    '1.2.1': 'vehicle-crime', '1.2.2': 'vehicle-crime', '1.2.5': 'vehicle-crime',
    '1.2.3': 'bicycle-theft', '1.2.4': 'theft-from-the-person',
    '1.4.1': 'violent-crime', '1.4.2': 'violent-crime', '1.4.3': 'violent-crime', '1.4.4': 'violent-crime', '1.4.5': 'violent-crime',
    '1.4.6': 'robbery', '1.4.7': 'robbery',
    '1.5.2': 'other-theft', '1.6.2': 'other-theft',
    '1.6.1': 'criminal-damage-arson', '2.2.1': 'criminal-damage-arson',
    '2.1.1': 'anti-social-behaviour', '2.4.2': 'public-order', '3.6.4': 'public-order',
    '2.5.2': 'shoplifting', '3.1.1': 'drugs', '3.1.3': 'possession-of-weapons',
}

def get(url, t=120):
    return json.load(U.urlopen(U.Request(url, headers={'User-Agent': 'WileyFox-data-build'}), timeout=t))

def centroid(geom):
    """Area-weighted centroid of the largest polygon ring (lon/lat)."""
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    best, ba = None, 0
    for poly in polys:
        ring = poly[0]; a = cx = cy = 0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
        if abs(a) > ba: ba, best = abs(a), (cy / (3 * a), cx / (3 * a))
    return best

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--months', type=int, default=3); ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    per = [p['Key'] for p in get(ODATA + 'Perioden')['value'] if p['Status'] == 'Definitief' and 'MM' in p['Key']]
    months = sorted(per)[-a.months:]
    # buurt centres (latest available map year)
    cent = {}
    for year in (dt.date.today().year, dt.date.today().year - 1, dt.date.today().year - 2):
        try:
            for gm in CITIES:
                flt = f"<Filter><PropertyIsEqualTo><PropertyName>gemeentecode</PropertyName><Literal>{gm}</Literal></PropertyIsEqualTo></Filter>"
                q = P.urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeName': 'wijkenbuurten:buurten',
                                 'outputFormat': 'json', 'srsName': 'EPSG:4326', 'filter': flt})
                for f in get(f'https://service.pdok.nl/cbs/wijkenbuurten/{year}/wfs/v1_0?{q}', 180)['features']:
                    c = centroid(f['geometry'])
                    if c: cent[f['properties']['buurtcode']] = c
            map_year = year; break
        except Exception as e:
            print('map', year, 'failed', e); cent = {}
    cats = sorted(set(MAP.values()))
    out, placed, missing = [], 0, 0
    pf = ' or '.join(f"Perioden eq '{m}'" for m in months)
    for gm in CITIES:
        flt = f"startswith(WijkenEnBuurten,'BU{gm[2:]}') and ({pf})"
        # the ODataFeed endpoint pages via odata.nextLink (the ODataApi endpoint caps at 10,000 rows)
        rows, url = [], FEED + 'TypedDataSet?' + P.urlencode({'$filter': flt, '$format': 'json'})
        while url:
            j = get(url, 300)
            rows += j['value']
            url = j.get('odata.nextLink')
        agg = collections.defaultdict(float)
        for r in rows:
            c = MAP.get(r['SoortMisdrijf'].strip())
            n = r.get('GeregistreerdeMisdrijven_1') or 0
            if c and n: agg[(r['WijkenEnBuurten'].strip(), c)] += n / len(months)
        for (bu, c), n in agg.items():
            p = cent.get(bu)
            if not p: missing += n; continue
            placed += n
            out.append([round(p[0], 5), round(p[1], 5), cats.index(c), round(n, 2)])
    payload = {'source': 'Politie / CBS 47022NED — registered crimes by neighbourhood (buurt), monthly',
               'source_url': 'https://data.politie.nl/#/Politie/nl/dataset/47022NED',
               'points_source': f'CBS/PDOK Wijk- en Buurtkaart {map_year} (neighbourhood centroids)',
               'period': f'{months[0][:4]}-{months[0][-2:]} to {months[-1][:4]}-{months[-1][-2:]}', 'months': 1,
               'averaged_over_months': len(months), 'generated': dt.date.today().isoformat(),
               'note': 'Monthly average per neighbourhood, placed at the neighbourhood centre (not exact locations).',
               'cats': cats, 'rows': out}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(payload, open(a.out, 'w'), separators=(',', ':'))
    print(f'months {months}; map {map_year}; rows {len(out)}; placed {placed:.0f}/mo, unplaced {missing:.0f}/mo ({missing/(placed+missing):.1%}); {os.path.getsize(a.out)//1024} KB')

if __name__ == '__main__':
    main()
