#!/usr/bin/env python3
"""Build Australian suburb / police-division crime layers: new/data/australia/<state>.json

State police and statistics agencies publish counts per suburb (NSW, VIC, SA) or per police
division (QLD), not incidents. Each area's count is spread across points inside its boundary
(about 1.2 km apart; small areas get one point at their centre), so a big area doesn't draw as one
hotspot. Rows: [lat, lng, categoryIndex, count]; `months` = months covered.

Sources (see README.md for links)
  nsw  BOCSAR SuburbData.zip (monthly counts by suburb)       → Sydney     (last 12 months)
  vic  Crime Statistics Agency LGA data tables, Table 03      → Melbourne  (year ending, by suburb)
  sa   SAPOL / data.sa.gov.au crime statistics CSV (daily)    → Adelaide   (financial year to date)
  qld  QPS division_Reported_Offences_Number.csv + QPS_DIVISIONS.shp → Brisbane, Gold Coast, Cairns
  Suburb boundaries: ABS ASGS 2021 Suburbs and Localities (SAL) map service.

Usage: python3 build_au.py nsw SuburbData.csv | vic table.xlsx | sa a.csv [b.csv] | qld offences.csv QPS_DIVISIONS.shp
Refresh: NSW quarterly, VIC quarterly, SA quarterly, QLD monthly.
"""
import csv, io, json, os, re, sys, math, collections, datetime as dt, urllib.request as U, urllib.parse as P

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'australia')
CITIES = {'nsw': [('Sydney', -33.87, 151.21, 0.55)], 'vic': [('Melbourne', -37.81, 144.96, 0.55)],
          'sa': [('Adelaide', -34.93, 138.60, 0.4)],
          'qld': [('Brisbane', -27.47, 153.03, 0.45), ('Gold Coast', -28.02, 153.40, 0.3), ('Cairns', -16.92, 145.77, 0.25)]}
STATE_CODE = {'nsw': '1', 'vic': '2', 'qld': '3', 'sa': '4'}
STEP = 0.012   # ~1.2 km; QLD divisions are larger, so a coarser grid (set in main)

def near(lat, lng, cities):
    return any(abs(lat - a) <= r and abs(lng - b) <= r for _, a, b, r in cities)

# ── geometry helpers ─────────────────────────────────────────────────────────
def ring_area_centroid(ring):
    a = cx = cy = 0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    return (a / 2, (cx / (3 * a), cy / (3 * a))) if a else (0, ring[0])
def inside(x, y, rings):
    hit = False
    for ring in rings:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: hit = not hit
    return hit
def spread_points(rings):
    """Points ~STEP apart inside the polygon (lng/lat rings); at least the centroid."""
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    pts = []
    x0 = math.floor(min(xs) / STEP) * STEP + STEP / 2; y0 = math.floor(min(ys) / STEP) * STEP + STEP / 2
    y = y0
    while y <= max(ys):
        x = x0
        while x <= max(xs):
            if inside(x, y, rings): pts.append((round(y, 5), round(x, 5)))
            x += STEP
        y += STEP
    if not pts:
        big = max(rings, key=lambda r: abs(ring_area_centroid(r)[0]))
        cx, cy = ring_area_centroid(big)[1]; pts = [(round(cy, 5), round(cx, 5))]
    return pts

def get(url, t=180):
    for i in range(4):
        try: return json.load(U.urlopen(U.Request(url, headers={'User-Agent': 'WileyFox-data-build'}), timeout=t))
        except Exception as e:
            if i == 3: raise
def sal_areas(state):
    """ABS SAL polygons around the state's cities → {NAME: [points]}"""
    out = {}
    for _, lat, lng, r in CITIES[state]:
        off = 0
        while True:
            q = P.urlencode({'where': f"state_code_2021='{STATE_CODE[state]}'", 'geometry': f'{lng-r},{lat-r},{lng+r},{lat+r}',
                             'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
                             'outFields': 'sal_name_2021', 'returnGeometry': 'true', 'outSR': 4326, 'maxAllowableOffset': 0.0003,
                             'resultOffset': off, 'resultRecordCount': 500, 'f': 'json'})
            j = get('https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0/query?' + q)
            for f in j['features']:
                n = f['attributes']['sal_name_2021']
                n = re.sub(r'\s*\((?:NSW|Vic\.|Qld|SA|WA|Tas\.|NT|ACT)\)$', '', n)          # 'Abbotsford (NSW)' → 'Abbotsford'
                n = re.sub(r' - (?:NSW|Vic\.|Qld|SA|WA|Tas\.|NT|ACT)\)$', ')', n).upper()     # 'Darlington (Sydney - NSW)' → 'DARLINGTON (SYDNEY)'
                if n not in out: out[n] = spread_points(f['geometry']['rings'])
            if not j.get('exceededTransferLimit'): break
            off += 500
    return out

# ── category maps (→ data.police.uk keys used by the map) ────────────────────
def nsw_cat(c, s):
    s = s.strip()
    if c in ('Assault', 'Homicide', 'Sexual offences', 'Intimidation, stalking and harassment', 'Abduction and kidnapping',
             'Other offences against the person', 'Coercive Control'): return 'violent-crime'
    if c == 'Robbery': return 'robbery'
    if c == 'Theft':
        return {'Break and enter dwelling': 'burglary', 'Break and enter non-dwelling': 'burglary', 'Motor vehicle theft': 'vehicle-crime',
                'Steal from motor vehicle': 'vehicle-crime', 'Steal from person': 'theft-from-the-person', 'Steal from retail store': 'shoplifting',
                'Steal from dwelling': 'other-theft', 'Other theft': 'other-theft', 'Stock theft': 'other-theft'}.get(s)
    return {'Malicious damage to property': 'criminal-damage-arson', 'Arson': 'criminal-damage-arson', 'Drug offences': 'drugs',
            'Prohibited and regulated weapons offences': 'possession-of-weapons', 'Disorderly conduct': 'public-order',
            'Liquor offences': 'public-order', 'Blackmail and extortion': 'other-crime'}.get(c)
def sa_cat(l2, l3):
    if l2 in ('ASSAULT', 'HOMICIDE', 'SEXUAL OFFENCES') or (l2 == 'HARM OR ENDANGER PERSONS' and 'Driving' not in l3): return 'violent-crime'
    if l3 == 'Robbery': return 'robbery'
    if l3 == 'Blackmail or other extortion': return 'other-crime'
    if l2 == 'SERIOUS CRIMINAL TRESPASS': return 'burglary'
    if l2 == 'PROPERTY DAMAGE': return 'criminal-damage-arson'
    return {'Motor vehicle theft and related offences': 'vehicle-crime', 'Theft from a person': 'theft-from-the-person',
            'Theft from retail premises': 'shoplifting', 'Other theft': 'other-theft'}.get(l3)
def vic_cat(sub):
    code = (sub or '').split(' ')[0]
    for pre, c in (('A2', 'violent-crime'), ('A7', 'violent-crime'), ('A5', 'robbery'), ('B1', 'criminal-damage-arson'), ('B2', 'criminal-damage-arson'),
                   ('B3', 'burglary'), ('B41', 'vehicle-crime'), ('B42', 'vehicle-crime'), ('B43', 'shoplifting'), ('B44', 'bicycle-theft'),
                   ('B49', 'other-theft'), ('C', 'drugs'), ('D1', 'possession-of-weapons'), ('D2', 'public-order')):
        if code.startswith(pre): return c
    if sub == 'Other crimes against the person': return 'violent-crime'
    return None
QLD = {'violent-crime': ['Homicide (Murder)', 'Attempted Murder', 'Conspiracy to Murder', 'Manslaughter (excl. by driving)',
                         'Manslaughter Unlawful Striking Causing Death', 'Grievous Assault', 'Serious Assault', 'Serious Assault (Other)',
                         "Common Assault'", 'Rape and Attempted Rape', 'Other Sexual Offences', 'Kidnapping & Abduction etc.',
                         'Coercive Control', 'Stalking', 'Life Endangering Acts'],
       'robbery': ['Armed Robbery', 'Unarmed Robbery'], 'other-crime': ['Extortion'],
       'burglary': ['Unlawful Entry Without Violence - Dwelling', 'Unlawful Entry With Violence - Dwelling',
                    'Unlawful Entry With Intent - Shop', 'Unlawful Entry With Intent - Other'],
       'criminal-damage-arson': ['Arson', 'Other Property Damage'],
       'vehicle-crime': ['Unlawful Use of Motor Vehicle', 'Vehicles (steal from/enter with intent)'],
       'other-theft': ['Stealing from Dwellings', 'Other Stealing'], 'shoplifting': ['Shop Stealing'],
       'drugs': ['Trafficking Drugs', 'Possess Drugs', 'Produce Drugs', 'Sell Supply Drugs', 'Other Drug Offences'],
       'possession-of-weapons': ['Unlawful Possess Concealable Firearm', 'Unlawful Possess Firearm - Other', 'Bomb Possess and/or use of',
                                 'Possess and/or use other weapons; restricted items', 'Weapons Act Offences - Other'],
       'public-order': ['Liquor (excl. Drunkenness)', 'Trespassing and Vagrancy', 'Disobey Move-on Direction', 'Public Nuisance']}
CATS = sorted({'violent-crime', 'robbery', 'other-crime', 'burglary', 'criminal-damage-arson', 'vehicle-crime', 'other-theft', 'shoplifting',
               'drugs', 'possession-of-weapons', 'public-order', 'theft-from-the-person', 'bicycle-theft'})
MON = {m: i for i, m in enumerate(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], 1)}

def main():
    global STEP
    state, files = sys.argv[1], sys.argv[2:]
    if state == 'qld': STEP = 0.018
    counts = collections.defaultdict(collections.Counter)    # AREA → cat → n
    if state == 'nsw':
        rd = csv.reader(open(files[0], encoding='utf-8-sig', errors='replace')); head = next(rd)
        idx = list(range(len(head) - 12, len(head))); months = 12
        period = f'{head[idx[0]]} – {head[idx[-1]]}'
        for r in rd:
            c = nsw_cat(r[1], r[2])
            if c: counts[r[0].upper()][c] += sum(int(r[i] or 0) for i in idx)
        source, url = 'NSW Bureau of Crime Statistics and Research — recorded criminal incidents by suburb', 'https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html'
    elif state == 'vic':
        import openpyxl
        ws = openpyxl.load_workbook(files[0], read_only=True, data_only=True)['Table 03']
        it = ws.iter_rows(values_only=True); head = next(it); latest = None
        rows = [r for r in it if r and r[0]]
        latest = max(r[0] for r in rows); ye = next(r[1] for r in rows if r[0] == latest)
        for r in rows:
            if r[0] != latest: continue
            c = vic_cat(r[7] or r[6])
            if c: counts[str(r[4]).strip().upper()][c] += int(r[8] or 0)
        months, period = 12, f'year ending {ye} {latest}'
        source, url = 'Crime Statistics Agency Victoria — recorded offences by suburb', 'https://www.crimestatistics.vic.gov.au/crime-statistics/latest-victorian-crime-data/download-data'
    elif state == 'sa':
        dates = []
        for f in files:
            for r in csv.DictReader(open(f, encoding='utf-8-sig')):
                c = sa_cat(r['Offence Level 2 Description'], r['Offence Level 3 Description'])
                d = dt.datetime.strptime(r['Reported Date'], '%d/%m/%Y').date(); dates.append(d)
                if c: counts[r['Suburb - Incident'].strip().upper()][c] += int(r['Offence count'] or 0)
        d0, d1 = min(dates), max(dates); months = round((d1 - d0).days / 30.44)
        period = f'{d0:%b %Y} – {d1:%b %Y}'
        source, url = 'South Australia Police — crime statistics by suburb (data.sa.gov.au)', 'https://data.sa.gov.au/data/dataset/crime-statistics'
    elif state == 'qld':
        R = list(csv.reader(open(files[0], encoding='utf-8-sig'))); head = R[0]
        col = {h: i for i, h in enumerate(head)}
        def key(m): return int('20' + m[3:]) * 100 + MON[m[:3]]
        last12 = sorted({r[1] for r in R[1:]}, key=key)[-12:]; months = 12
        period = f'{last12[0][:3].title()} 20{last12[0][3:]} – {last12[-1][:3].title()} 20{last12[-1][3:]}'
        for r in R[1:]:
            if r[1] not in last12: continue
            for c, cols in QLD.items(): counts[r[0].upper()][c] += sum(int(r[col[h]] or 0) for h in cols)
        source, url = 'Queensland Police Service — reported offences by police division, monthly', 'https://www.data.qld.gov.au/dataset/offence-numbers-police-divisions-monthly-from-july-2001'
    # areas
    if state == 'qld':
        import shapefile
        sf = shapefile.Reader(files[1]); fld = [f[0] for f in sf.fields[1:]]
        nk = next(f for f in fld if 'NAME' in f.upper() or 'DIV' in f.upper())
        areas = {}
        for sr in sf.iterShapeRecords():
            pts, parts = sr.shape.points, list(sr.shape.parts) + [len(sr.shape.points)]
            rings = [[tuple(p) for p in pts[a:b]] for a, b in zip(parts, parts[1:])]
            cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
            if not near(cy, cx, [(n, a, b, r + 0.3) for n, a, b, r in CITIES[state]]): continue
            areas[str(sr.record[nk]).strip().upper()] = spread_points(rings)
        points_source = 'QPS division boundaries (QPS_DIVISIONS), counts spread across each division'
    else:
        areas = sal_areas(state); points_source = 'ABS ASGS 2021 Suburbs and Localities, counts spread across each suburb'
    # a name the data gives without its '(LGA)' tag matches the suburb of that name inside the city area
    base = {}
    for a in areas: base.setdefault(re.sub(r'\s*\(.*\)$', '', a), a)
    out, placed = [], 0
    for area, cc in counts.items():
        n = sum(cc.values())
        pts = areas.get(area) or (areas.get(base[area]) if area in base and area not in areas else None)
        if not pts: continue
        pts = [p for p in pts if near(p[0], p[1], CITIES[state])]
        if not pts: continue
        placed += n
        for c, v in cc.items():
            share = round(v / len(pts), 2)
            if share > 0:
                for la, ln in pts: out.append([la, ln, CATS.index(c), share])
    os.makedirs(OUT, exist_ok=True); path = os.path.join(OUT, f'{state}.json')
    json.dump({'source': source, 'source_url': url, 'points_source': points_source, 'period': period, 'months': months,
               'generated': dt.date.today().isoformat(), 'note': 'Counts per suburb or police division, spread across the area (not exact locations).',
               'cats': CATS, 'rows': out}, open(path, 'w'), separators=(',', ':'))
    print(f'{state}: {period}, {months} months; areas with data {len(counts)}, in city areas {sum(1 for a in counts if a in areas)}/{len(areas)}; '
          f'placed {placed} of {sum(sum(c.values()) for c in counts.values())} statewide; rows {len(out)}; {os.path.getsize(path)//1024} KB')
    missing = sorted(a for a in areas if a not in counts and not any(base.get(k) == a for k in counts))[:15]; print('  areas without data (sample):', missing)

if __name__ == '__main__':
    main()
