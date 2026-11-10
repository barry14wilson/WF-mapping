#!/usr/bin/env python3
"""Build Canadian city crime layers: new/data/canada/<city>.json (rows [lat, lng, categoryIndex, count]).

vancouver  Vancouver Police Department GeoDASH open data: one row per incident at its 100-block
           (UTM zone 10N). Files: https://geodash.vpd.ca/opendata/  (crimedata_csv_AllNeighbourhoods_<year>.zip)
           Uses the latest 12 complete months across the files given. Offences against a person have
           no location in the VPD file (privacy) and are left out, so the card says the data is partial.
           Usage: build_ca.py vancouver crimedata_csv_AllNeighbourhoods_2025.csv crimedata_csv_AllNeighbourhoods_2026.csv
ottawa     Ottawa Police Service Criminal Offences open data (ArcGIS), one point per offence, released yearly.
           https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Criminal_Offences_Open_Data/FeatureServer/0
           Usage: build_ca.py ottawa [year]   (default: latest year in the service)
Refresh: Vancouver weekly-to-monthly (VPD updates weekly); Ottawa yearly (spring).
"""
import csv, json, os, sys, collections, datetime as dt, urllib.parse as P, urllib.request as U

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'canada')
VAN = {'Break and Enter Commercial': 'burglary', 'Break and Enter Residential/Other': 'burglary', 'Mischief': 'criminal-damage-arson',
       'Other Theft': 'other-theft', 'Theft from Vehicle': 'vehicle-crime', 'Theft of Vehicle': 'vehicle-crime',
       'Theft of Bicycle': 'bicycle-theft', 'Homicide': 'violent-crime', 'Offence Against a Person': 'violent-crime'}
OTT = {'Arson': 'criminal-damage-arson', 'Mischief': 'criminal-damage-arson', 'Assaults': 'violent-crime', 'Sexual Violations': 'violent-crime',
       'Other Violations Involving Violence Or The Threat Of Violence': 'violent-crime', 'Violations Causing Death': 'violent-crime',
       'Violations Resulting In The Deprivation Of Freedom': 'violent-crime', 'Attempting The Commission Of A Capital Crime': 'violent-crime',
       'Break and Enter': 'burglary', 'Theft - Motor Vehicle': 'vehicle-crime', 'Theft $5000 and Under': 'other-theft',
       'Theft Over $5000': 'other-theft', 'Offensive Weapons': 'possession-of-weapons'}
OTT_URL = 'https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Criminal_Offences_Open_Data/FeatureServer/0'

def get(url, t=180):
    for i in range(4):
        try: return json.load(U.urlopen(U.Request(url, headers={'User-Agent': 'WileyFox-data-build'}), timeout=t))
        except Exception:
            if i == 3: raise

def write(city, agg, months, period, source, url, note):
    cats = sorted({c for _, _, c in agg})
    rows = [[la, ln, cats.index(c), n] for (la, ln, c), n in agg.items()]
    os.makedirs(OUT, exist_ok=True); path = os.path.join(OUT, f'{city}.json')
    json.dump({'source': source, 'source_url': url, 'period': period, 'months': months, 'generated': dt.date.today().isoformat(),
               'note': note, 'cats': cats, 'rows': rows}, open(path, 'w'), separators=(',', ':'))
    print(f'{city}: {period} ({months} months); {sum(agg.values())} offences; rows {len(rows)}; {os.path.getsize(path)//1024} KB')

def vancouver(files):
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:26910', 'EPSG:4326', always_xy=True)
    recs = []
    for f in files:
        for r in csv.DictReader(open(f, encoding='utf-8-sig')):
            recs.append(r)
    ym = sorted({(int(r['YEAR']), int(r['MONTH'])) for r in recs})
    last = ym[-2] if len(ym) > 1 else ym[-1]           # the newest month is usually incomplete
    keep = [m for m in ym if m <= last][-12:]
    agg = collections.Counter(); skipped = 0
    for r in recs:
        c = VAN.get(r['TYPE'])
        if not c or (int(r['YEAR']), int(r['MONTH'])) not in keep: continue
        x, y = float(r['X'] or 0), float(r['Y'] or 0)
        if not x or not y: skipped += 1; continue      # offences against a person carry no location
        ln, la = tr.transform(x, y)
        agg[(round(la, 5), round(ln, 5), c)] += 1
    print('vancouver: incidents without a location (left out):', skipped)
    write('vancouver', agg, len(keep), f'{dt.date(*keep[0], 1):%b %Y} – {dt.date(*keep[-1], 1):%b %Y}',
          'Vancouver Police Department — GeoDASH crime incidents (100-block)', 'https://geodash.vpd.ca/opendata/',
          'Incidents at their 100-block (VPD offsets locations slightly); offences against a person have no location and are not shown.')

def ottawa(year=None):
    if not year:
        j = get(OTT_URL + '/query?' + P.urlencode({'where': '1=1', 'outStatistics': json.dumps([{'statisticType': 'max', 'onStatisticField': 'YEAR', 'outStatisticFieldName': 'y'}]), 'f': 'json'}))
        year = j['features'][0]['attributes']['y']
    agg = collections.Counter(); off = 0
    while True:
        j = get(OTT_URL + '/query?' + P.urlencode({'where': f'YEAR={year}', 'outFields': 'OFF_CATEG', 'returnGeometry': 'true', 'outSR': 4326,
                                                    'resultOffset': off, 'resultRecordCount': 2000, 'orderByFields': 'OBJECTID', 'f': 'json'}))
        for f in j['features']:
            c = OTT.get(f['attributes']['OFF_CATEG']); g = f.get('geometry')
            if c and g and g.get('x'): agg[(round(g['y'], 5), round(g['x'], 5), c)] += 1
        if not j.get('exceededTransferLimit') and len(j['features']) < 2000: break
        off += 2000
    write('ottawa', agg, 12, str(year), 'Ottawa Police Service — criminal offences (open data)',
          'https://open.ottawa.ca/datasets/ottawa::criminal-offences-open-data', 'Offences placed at the nearest intersection (OPS anonymises locations).')

if __name__ == '__main__':
    city = sys.argv[1]
    if city == 'vancouver': vancouver(sys.argv[2:])
    elif city == 'ottawa': ottawa(int(sys.argv[2]) if len(sys.argv) > 2 else None)
