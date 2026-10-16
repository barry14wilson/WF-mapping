# Builds OFFICIAL_AREA data for the Wiley Fox /new prototype (area-level official crime rates).
# Fetch steps (see README.md). Inputs in ./data: eu_by_year.json (Eurostat crim_gen_reg), scot.csv + scot_counts.csv (statistics.gov.scot
# recorded-crime), fr.json (data.gouv.fr base communale 2025), cjq10.json (CSO CJQ10).
import json, csv, math, collections, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
W = {'homicide': 3, 'assault': 3, 'robbery': 3, 'burglary': 2, 'theft': 1}
LBL = {'homicide': 'Homicide', 'assault': 'Assault', 'robbery': 'Robbery', 'burglary': 'Burglary', 'theft': 'Theft'}
def index(r): return sum(W[k] * v for k, v in r.items() if v is not None)
def score(ratio): return max(5, min(95, round(75 - 25 * math.log2(ratio))))
out = {}

# ---- Eurostat NUTS 3 ------------------------------------------------------
eu = json.load(open('eu_by_year.json'))
ICCS = {'homicide': 'ICCS0101', 'assault': 'ICCS02011', 'robbery': 'ICCS0401', 'theft': 'ICCS0502'}
def eu_rates(geo, y, nat):
    r = eu[geo]['y'][y]; n = eu[nat]['y'][y]
    bk = 'ICCS0501' if ('ICCS0501' in n and 'ICCS0501' in r) else 'ICCS05012'
    f = lambda d: {**{k: d.get(c) for k, c in ICCS.items()}, 'burglary': d.get(bk)}
    a, b = f(r), f(n)
    keys = [k for k in W if a.get(k) is not None and b.get(k) is not None]
    a = {k: round(a[k], 1) for k in keys}; b = {k: round(b[k], 1) for k in keys}
    return a, b, ('domestic burglary' if bk == 'ICCS05012' else 'burglary')
EU_CITIES = {  # city: (NUTS3, national, country, level label)
 'Rome': ('ITI43', 'IT', 'Italy', 'province'), 'Milan': ('ITC4C', 'IT', 'Italy', 'province'),
 'Florence': ('ITI14', 'IT', 'Italy', 'province'), 'Venice': ('ITH35', 'IT', 'Italy', 'province'),
 'Naples': ('ITF33', 'IT', 'Italy', 'province'),
 'Barcelona': ('ES511', 'ES', 'Spain', 'province'), 'Amsterdam': ('NL329', 'NL', 'Netherlands', 'NUTS 3 region'),
 'Berlin': ('DE300', 'DE', 'Germany', 'city-state'), 'Munich': ('DE212', 'DE', 'Germany', 'city district'),
 'Cologne': ('DEA23', 'DE', 'Germany', 'city district'), 'Nuremberg': ('DE254', 'DE', 'Germany', 'city district'),
 'Lisbon': ('PT1A0', 'PT', 'Portugal', 'NUTS 3 region'), 'Vienna': ('AT130', 'AT', 'Austria', 'city-state'),
 'Dublin': ('IE061', 'IE', 'Ireland', 'NUTS 3 region'), 'Cork': ('IE053', 'IE', 'Ireland', 'NUTS 3 region'),
 'Galway': ('IE042', 'IE', 'Ireland', 'NUTS 3 region'), 'Limerick': ('IE051', 'IE', 'Ireland', 'NUTS 3 region'),
}
for city, (g, nat, country, lvl) in EU_CITIES.items():
    y = max(eu[g]['y'], key=int) if eu[g]['y'] else None
    y = next(yy for yy in sorted(eu[g]['y'], reverse=True) if eu[g]['y'][yy] and yy in eu[nat]['y'])
    a, b, bl = eu_rates(g, y, nat)
    out[city] = dict(country=country, region=eu[g]['name'].replace(' (NUTS 2021)', ''), level=lvl, period=y,
        source='Eurostat crim_gen_reg (police-recorded offences by NUTS 3 region)',
        url='https://ec.europa.eu/eurostat/databrowser/view/crim_gen_reg/default/table', rates=a, national=b,
        burglaryLabel=bl)

# ---- France: data.gouv.fr base communale 2025 -----------------------------
fr = json.load(open('fr.json'))
FRMAP = {'assault': ['Violences physiques hors cadre familial'], 'robbery': ['Vols violents sans arme', 'Vols avec armes'],
         'burglary': ['Cambriolages de logement'], 'theft': ['Vols sans violence contre des personnes']}
y = '2025'
nat = {k: sum(fr['national'][y][i][0] for i in v) / fr['national'][y][v[0]][1] * 1e5 for k, v in FRMAP.items()}
for city, d in fr['cities'].items():
    dd = d[y]; pop = float(dd['pop'])
    a = {k: round(sum(float(dd['ind'][i][0]) for i in v) / pop * 1e5, 1) for k, v in FRMAP.items()}
    out[city] = dict(country='France', region=city, level='commune', period=y,
        source='SSMSI base statistique communale (police + gendarmerie), data.gouv.fr',
        url='https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/',
        rates=a, national={k: round(v, 1) for k, v in nat.items()}, burglaryLabel='domestic burglary',
        note='Theft counts thefts from people without violence (incl. pickpocketing).')

# ---- Scotland: statistics.gov.scot recorded crime 2025-26 -----------------
SC = {'S12000036': ('Edinburgh', 'City of Edinburgh'), 'S12000049': ('Glasgow', 'Glasgow City'),
      'S12000033': ('Aberdeen', 'Aberdeen City'), 'S12000017': ('Inverness', 'Highland'), 'S92000003': ('Scotland', 'Scotland')}
SCMAP = {'homicide': ['crimes-group-1-murder-and-culpable-homicide'],
         'assault': ['crimes-group-1-serious-assault-and-attempted-murder', 'crimes-group-1-common-assault'],
         'robbery': ['crimes-group-1-robbery'], 'burglary': ['crimes-group-3-housebreaking'],
         'theft': ['crimes-group-3-other-theft']}
cnt = collections.defaultdict(dict); rat = collections.defaultdict(dict)
P = '2025-2026'
for r in csv.DictReader(open('scot_counts.csv')):
    if P in r['period']: cnt[r['area'].split('/')[-1]][r['crime'].split('/')[-1]] = float(r['count'])
for r in csv.DictReader(open('scot.csv')):
    if P in r['period']: rat[r['area'].split('/')[-1]][r['crime'].split('/')[-1]] = float(r['ratio'])
def sc_rates(code):
    pop = cnt[code]['all-crimes'] / rat[code]['all-crimes'] * 1e4
    return {k: round(sum(cnt[code][c] for c in v) / pop * 1e5, 1) for k, v in SCMAP.items()}, pop
natS, popS = sc_rates('S92000003')
for code, (city, area) in SC.items():
    a, pop = sc_rates(code)
    out[city] = dict(country='United Kingdom', nation='Scotland', region=area, level='council area' if code != 'S92000003' else 'country',
        period='Apr 2025 – Mar 2026', source='Scottish Government, Recorded Crime in Scotland (statistics.gov.scot)',
        url='https://statistics.gov.scot/data/recorded-crime', rates=a, national=natS, nationalName='Scotland',
        burglaryLabel='housebreaking', note='Theft excludes shoplifting and vehicle crime.')

# ---- Ireland CSO CJQ10 trend (provisional) --------------------------------
d = json.load(open('cjq10.json')); ids = d['id']; sz = d['size']
dims = [list(d['dimension'][i]['category']['index']) for i in ids]
labs = d['dimension'][ids[2]]['category']['label']; vals = d['value']
def V(q, div, off):
    idx = [0, dims[1].index(q), dims[2].index(div), dims[3].index(off)]
    k = 0
    for i, s in zip(idx, sz): k = k * s + i
    v = vals[k] if isinstance(vals, list) else vals.get(str(k)); return v or 0
Q = dims[1]; last4 = Q[-2:]; prev4 = [str(int(q[:4]) - 1) + q[4:] for q in last4]  # same quarters a year earlier (new divisions start 2025 Q1)
DIV = {'Dublin': [k for k, v in labs.items() if v.startswith('D.M.R.')], 'Cork': [k for k, v in labs.items() if v.startswith('Cork City')],
       'Galway': [k for k, v in labs.items() if v.startswith('Galway')], 'Limerick': [k for k, v in labs.items() if v.startswith('Limerick')]}
OFF = ['03', '06', '07', '08']
qlab = lambda q: q[:4] + ' Q' + q[4:]
for city, divs in DIV.items():
    a = sum(V(q, dv, o) for q in last4 for dv in divs for o in OFF); b = sum(V(q, dv, o) for q in prev4 for dv in divs for o in OFF)
    out[city]['trend'] = dict(pct=round((a - b) / b * 100), count=int(a), period=f'{qlab(last4[0])} – {qlab(last4[-1])}', vs=f'{qlab(prev4[0])} – {qlab(prev4[-1])}',
        area=('Dublin Metropolitan Region' if city == 'Dublin' else labs[divs[0]]),
        source='CSO CJQ10, recorded crime incidents (under reservation)', url='https://data.cso.ie/table/CJQ10',
        what='assaults, robbery, burglary and theft')

for c, o in out.items():
    o['index'] = round(index(o['rates']), 1); o['natIndex'] = round(index({k: o['national'][k] for k in o['rates']}), 1)
    o['ratio'] = round(o['index'] / o['natIndex'], 2); o['O'] = score(o['ratio'])
json.dump(out, open('official_area.json', 'w'), ensure_ascii=False, indent=1)
for c, o in sorted(out.items(), key=lambda x: (x[1]['country'], x[0])):
    print(f"{c:11} {o['country'][:8]:8} {o['period']:>18} ratio {o['ratio']:5} O {o['O']:3} {o.get('trend',{}).get('pct','')}")

# JS block for new/index.html (replace the `const OFFICIAL_AREA = {...};` block)
keep = ['country','nation','region','level','period','source','url','rates','national','nationalName','burglaryLabel','note','trend']
lines = ["const OFFICIAL_AREA = {"] + [f"  {json.dumps(k)}: {json.dumps({kk: v[kk] for kk in keep if kk in v}, ensure_ascii=False)}," for k, v in out.items()] + ["};"]
open('official_data.js', 'w').write("\n".join(lines))
