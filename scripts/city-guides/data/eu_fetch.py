# Fetch Eurostat crim_gen_reg (police-recorded offences by NUTS 3 region), latest year, per 100k + counts
import json, urllib.request, sys
U = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/crim_gen_reg?lang=EN&time={y}"
def get(y):
    return json.load(urllib.request.urlopen(U.format(y=y), timeout=120))
out = {}
for y in (2024, 2023):
    d = get(y); dm = d['dimension']; ids = d['id']; sz = d['size']
    cats = [list(dm[i]['category']['index']) for i in ids]
    geo_lab = dm['geo']['category']['label']
    for k, v in d['value'].items():
        k = int(k); idx = []
        for s in reversed(sz): idx.append(k % s); k //= s
        idx = idx[::-1]; c = {ids[i]: cats[i][idx[i]] for i in range(len(ids))}
        g = c['geo']; r = out.setdefault(g, {'name': geo_lab[g], 'year': y, 'rate': {}, 'count': {}})
        if r['year'] != y: continue  # keep latest year only
        (r['rate'] if c['unit'] == 'P_HTHAB' else r['count'])[c['iccs']] = v
    print(y, len(out), d.get('updated'), file=sys.stderr)
json.dump({'source': 'Eurostat crim_gen_reg — police-recorded offences by NUTS 3 region', 'updated': d.get('updated'),
           'iccs': dm['iccs']['category']['label'], 'regions': out}, open('eu_crime_nuts3.json', 'w'), ensure_ascii=False)
