#!/usr/bin/env python3
"""Build US city crime layers from feeds without map coordinates (or as a yearly/rolling file):
new/data/us/<city>.json, rows [lat, lng, categoryIndex, count].

austin      Austin PD crime reports (Socrata fdj4-gpfu): counts by census block group, placed at each block
            group's Census interior point (TIGERweb). Rolling last 12 complete months.
louisville  LMPD crime data <year> (ArcGIS, crime_data_<year>): counts by ZIP code, spread across the ZIP area
            (Census ZCTA, TIGERweb). Rolling last 12 complete months across this year's and last year's layers.
phoenix     Phoenix PD crime data CSV (phoenixopendata.com): counts by ZIP, spread across the ZIP area.
            Usage: build_us_areas.py phoenix crime-data_crimestat.csv   (uses the latest complete calendar year)
milwaukee   Milwaukee PD WIBR CSV (data.milwaukee.gov): one row per incident with address coordinates.
            Usage: build_us_areas.py milwaukee wibr.csv   (rolling last 12 complete months)
Refresh monthly (Phoenix: yearly when the city posts the previous year).
"""
import csv, json, math, os, sys, collections, datetime as dt, urllib.parse as P, urllib.request as U

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'us')
TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer'
STEP = 0.012

def get(url, t=180):
    for i in range(4):
        try: return json.load(U.urlopen(U.Request(url, headers={'User-Agent': 'WileyFox-data-build'}), timeout=t))
        except Exception:
            if i == 3: raise

def nibrs(code):
    """NIBRS offence code → map category (None = not shown: fraud, Group B, etc.)."""
    c = code.strip().upper()
    if c in ('09A', '09B', '13A', '13B', '13C', '100', '11A', '11B', '11C', '11D', '36A', '36B', '64A', '64B'): return 'violent-crime'
    if c == '120': return 'robbery'
    if c == '220': return 'burglary'
    if c in ('240', '23F', '23G'): return 'vehicle-crime'
    if c in ('23A', '23B'): return 'theft-from-the-person'
    if c == '23C': return 'shoplifting'
    if c in ('23D', '23E', '23H'): return 'other-theft'
    if c in ('200', '290'): return 'criminal-damage-arson'
    if c in ('35A', '35B'): return 'drugs'
    if c == '520': return 'possession-of-weapons'
    if c in ('90C', '90E', '90J'): return 'public-order'
    return None
PHX = {'LARCENY-THEFT': 'other-theft', 'BURGLARY': 'burglary', 'MOTOR VEHICLE THEFT': 'vehicle-crime', 'AGGRAVATED ASSAULT': 'violent-crime',
       'SIMPLE ASSAULT': 'violent-crime', 'RAPE': 'violent-crime', 'MURDER AND NON-NEGLIGENT MANSLAUGHTER': 'violent-crime',
       'ROBBERY': 'robbery', 'ARSON': 'criminal-damage-arson', 'DRUG OFFENSE': 'drugs', 'DRUG OFFENSES': 'drugs'}
AUSTIN = {'Aggravated Assault': 'violent-crime', 'Assault': 'violent-crime', 'Simple Assault': 'violent-crime', 'Murder': 'violent-crime',
          'Rape': 'violent-crime', 'Robbery': 'robbery', 'Burglary': 'burglary', 'Auto Theft': 'vehicle-crime', 'Motor Vehicle Theft': 'vehicle-crime',
          'Theft': 'other-theft', 'Larceny': 'other-theft', 'Arson': 'criminal-damage-arson', 'Vandalism': 'criminal-damage-arson',
          'Drug Offenses': 'drugs', 'Weapon Law Violations': 'possession-of-weapons'}

def last12(months):
    """latest 12 complete months from a set of (y, m); the newest month in a feed is usually partial."""
    ms = sorted(months); ms = ms[:-1] if len(ms) > 12 else ms
    return ms[-12:]

# ── geometry ────────────────────────────────────────────────────────────────
def inside(x, y, rings):
    hit = False
    for ring in rings:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: hit = not hit
    return hit
def spread(rings, label):
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]; pts = []
    y = math.floor(min(ys) / STEP) * STEP + STEP / 2
    while y <= max(ys):
        x = math.floor(min(xs) / STEP) * STEP + STEP / 2
        while x <= max(xs):
            if inside(x, y, rings): pts.append((round(y, 5), round(x, 5)))
            x += STEP
        y += STEP
    return pts or [label]
def zcta_areas(zips):
    out = {}
    zl = sorted(zips)
    for i in range(0, len(zl), 40):
        w = 'ZCTA5 IN (' + ','.join(f"'{z}'" for z in zl[i:i + 40]) + ')'
        j = get(f'{TIGER}/2/query?' + P.urlencode({'where': w, 'outFields': 'ZCTA5,INTPTLAT,INTPTLON', 'returnGeometry': 'true',
                                                   'outSR': 4326, 'maxAllowableOffset': 0.0005, 'f': 'json'}))
        for f in j['features']:
            a = f['attributes']
            out[a['ZCTA5']] = spread(f['geometry']['rings'], (round(float(a['INTPTLAT']), 5), round(float(a['INTPTLON']), 5)))
    return out
def blockgroups(state, counties):
    out = {}
    for c in counties:
        off = 0
        while True:
            j = get(f'{TIGER}/10/query?' + P.urlencode({'where': f"STATE='{state}' AND COUNTY='{c}'", 'outFields': 'GEOID,INTPTLAT,INTPTLON',
                                                        'returnGeometry': 'false', 'resultOffset': off, 'resultRecordCount': 1000, 'f': 'json'}))
            for f in j['features']:
                a = f['attributes']; out[a['GEOID'][2:]] = [(round(float(a['INTPTLAT']), 5), round(float(a['INTPTLON']), 5))]
            if not j.get('exceededTransferLimit'): break
            off += 1000
    return out

def write(city, counts, areas, months, period, source, url, unit, note):
    """counts: {(area, cat): n}; areas: {area: [points]} or None when keys are already (lat, lng)."""
    cats = sorted({c for _, c in counts}); agg = collections.Counter(); placed = lost = 0
    for (a, c), n in counts.items():
        pts = areas.get(a) if areas is not None else [a]
        if not pts: lost += n; continue
        placed += n
        for la, ln in pts: agg[(la, ln, c)] += n / len(pts)
    rows = [[la, ln, cats.index(c), round(n, 2)] for (la, ln, c), n in agg.items() if round(n, 2) > 0]
    os.makedirs(OUT, exist_ok=True); path = os.path.join(OUT, f'{city}.json')
    json.dump({'source': source, 'source_url': url, 'period': period, 'months': months, 'unit': unit, 'generated': dt.date.today().isoformat(),
               'note': note, 'cats': cats, 'rows': rows}, open(path, 'w'), separators=(',', ':'))
    print(f'{city}: {period} ({months} mo); placed {placed} ({placed / max(1, placed + lost):.1%}); rows {len(rows)}; {os.path.getsize(path) // 1024} KB')

def austin():
    base = 'https://data.austintexas.gov/resource/fdj4-gpfu.json?'
    ms = get(base + P.urlencode({'$select': "date_trunc_ym(occ_date) as m, count(*)", '$group': 'm', '$where': "occ_date > '2024-06-01'", '$limit': 100}))
    keep = last12({(int(r['m'][:4]), int(r['m'][5:7])) for r in ms})
    a, b = keep[0], keep[-1]; end = dt.date(b[0] + (b[1] == 12), b[1] % 12 + 1, 1)
    rows = get(base + P.urlencode({'$select': 'census_block_group, ucr_category, category_description, count(*)', '$group': 'census_block_group, ucr_category, category_description',
                                   '$where': f"occ_date >= '{a[0]}-{a[1]:02d}-01' and occ_date < '{end}'", '$limit': 50000}), 600)
    counts = collections.Counter()
    for r in rows:
        # Austin codes only the FBI Part I offences (NIBRS code in ucr_category); other reports carry no category
        c = nibrs(r.get('ucr_category') or '') or AUSTIN.get(r.get('category_description', ''))
        if c and r.get('census_block_group'): counts[(r['census_block_group'], c)] += int(r['count'])
    print('austin categories seen:', sorted({r.get('category_description') or '' for r in rows}))
    areas = blockgroups('48', ['453', '491', '209'])
    write('austin', counts, areas, 12, f'{dt.date(*a, 1):%b %Y} – {dt.date(*b, 1):%b %Y}', 'Austin Police Department — crime reports by census block group',
          'https://data.austintexas.gov/Public-Safety/Crime-Reports/fdj4-gpfu', 'block group', 'Counts per census block group, placed at its centre (not exact locations). Part I offences only (Austin does not categorise the rest).')

def louisville():
    y = dt.date.today().year; recs = []
    for yr in (y - 1, y):
        B = f'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/crime_data_{yr}/FeatureServer/0/query?'
        off = 0
        while True:
            j = get(B + P.urlencode({'where': '1=1', 'outFields': 'zip_code,nibrs_code,date_occurred', 'returnGeometry': 'false',
                                     'resultOffset': off, 'resultRecordCount': 2000, 'orderByFields': 'ObjectId', 'f': 'json'}), 300)
            recs += [f['attributes'] for f in j['features']]
            if not j['features'] or not j.get('exceededTransferLimit'): break
            off += len(j['features'])
    for r in recs: r['ym'] = (dt.datetime.utcfromtimestamp(r['date_occurred'] / 1000).year, dt.datetime.utcfromtimestamp(r['date_occurred'] / 1000).month) if r['date_occurred'] else None
    keep = set(last12({r['ym'] for r in recs if r['ym'] and (y - 1, 1) <= r['ym'] <= (y, dt.date.today().month)})); ks = sorted(keep)
    counts = collections.Counter()
    for r in recs:
        c = nibrs(r['nibrs_code'] or '')
        z = str(r['zip_code'] or '').strip()[:5]
        if c and r['ym'] in keep and len(z) == 5: counts[(z, c)] += 1
    areas = zcta_areas({z for z, _ in counts})
    write('louisville', counts, areas, 12, f'{dt.date(*ks[0], 1):%b %Y} – {dt.date(*ks[-1], 1):%b %Y}',
          'Louisville Metro Police Department — crime data by ZIP code', 'https://data.louisvilleky.gov/', 'ZIP code',
          'Counts per ZIP code, spread across the ZIP area (not exact locations).')

def phoenix(f):
    recs = []
    for r in csv.DictReader(open(f, encoding='utf-8-sig')):
        try: d = dt.datetime.strptime(r['OCCURRED ON'].split()[0], '%m/%d/%Y')
        except Exception: continue
        recs.append((d, r))
    yr = max(d for d, _ in recs).year
    if max(d for d, _ in recs) < dt.datetime(yr, 12, 1): yr -= 1
    counts = collections.Counter()
    for d, r in recs:
        c = PHX.get(r['UCR CRIME CATEGORY'].strip()); z = (r['ZIP'] or '').strip()[:5]
        if c and d.year == yr and len(z) == 5: counts[(z, c)] += 1
    areas = zcta_areas({z for z, _ in counts})
    write('phoenix', counts, areas, 12, str(yr), 'Phoenix Police Department — crime data by ZIP code',
          'https://www.phoenixopendata.com/dataset/crime-data', 'ZIP code', 'Counts per ZIP code, spread across the ZIP area (not exact locations).')

def milwaukee(f):
    recs = []
    for r in csv.DictReader(open(f, encoding='utf-8-sig', newline='')):
        try: d = dt.datetime.strptime(r['Incident_Date'][:10], '%Y-%m-%d')
        except Exception: continue
        if d.date() > dt.date.today(): continue                      # a few rows carry future-dated typos
        recs.append((d, r))
    keep = set(last12({(d.year, d.month) for d, _ in recs})); ks = sorted(keep)
    counts = collections.Counter()
    for d, r in recs:
        if (d.year, d.month) not in keep: continue
        try: la, ln = round(float(r['Address_Latitude']), 5), round(float(r['Address_Longitude']), 5)
        except ValueError: continue
        for code in set((r['Offense_All'] or '').split(';')):
            c = nibrs(code)
            if c: counts[((la, ln), c)] += 1
    write('milwaukee', counts, None, 12, f'{dt.date(*ks[0], 1):%b %Y} – {dt.date(*ks[-1], 1):%b %Y}',
          'Milwaukee Police Department — WIBR crime data', 'https://data.milwaukee.gov/dataset/wibr', 'address',
          'Offences at the reported address (each offence in a multi-offence incident counted once).')

if __name__ == '__main__':
    city = sys.argv[1]
    {'austin': austin, 'louisville': louisville}.get(city, lambda: None)()
    if city == 'phoenix': phoenix(sys.argv[2])
    if city == 'milwaukee': milwaukee(sys.argv[2])
