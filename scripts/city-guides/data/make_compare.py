import json, sys
EU = json.load(open('/home/claude/cityguide/data/eu_crime_nuts3.json'))
R = EU['regions']
DE = [('DE212','Munich'),('DE254','Nuremberg'),('DE111','Stuttgart'),('DE600','Hamburg'),('DEA23','Cologne'),('DE712','Frankfurt'),('DE300','Berlin'),('DEA11','Düsseldorf')]
ICCS = [('ICCS0502','Theft'),('ICCS0401','Robbery'),('ICCS02011','Assault'),('ICCS0501','Burglary')]
def de_block(me):
    rows = [{'name': n, 'vals': [round(R[g]['rate'][k]) for k, _ in ICCS], 'me': n == me} for g, n in DE]
    rows.sort(key=lambda r: r['vals'][1])
    rows.append({'name': 'Germany average', 'vals': [round(R['DE']['rate'][k]) for k, _ in ICCS], 'avg': True})
    m = next(r for r in rows if r.get('me')); a = rows[-1]
    rank = sorted([r for r in rows if not r.get('avg')], key=lambda r: r['vals'][1]).index(m) + 1
    return {
      'title': f'How {me} compares with other German cities',
      'intro': f'Police-recorded offences per 100,000 residents in 2024, using the same Eurostat measure for every city. {me} ranks {rank} of {len(DE)} big German cities for robbery (1 = lowest). Big cities all sit above the national average because shoppers, commuters and visitors are counted as victims but not as residents.',
      'cols': [l for _, l in ICCS], 'unit': 'per 100,000 residents, 2024', 'rows': rows,
      'note': 'Compare within Germany only. Countries record assault and burglary differently, so a lower number in another country does not mean it is safer.',
      'source': {'name': 'Eurostat, police-recorded offences by NUTS 3 region (crim_gen_reg), 2024', 'url': 'https://ec.europa.eu/eurostat/databrowser/view/crim_gen_reg/default/table'}}
US = {'New York City': {2024: (694.1, 2415.7), 2025: (660.0, 2300.2)}, 'Chicago': {2025: (420.4, 2955.8)},
      'New York State': {2024: (392.2, 1717.2), 2025: (368.0, 1566.8)}, 'Illinois': {2025: (257.6, 1556.1)},
      'US average': {2024: (363.4, 1766.8), 2025: (329.3, 1552.1)}}
def us_block(me, state):
    names = [me, 'Chicago' if me != 'Chicago' else 'New York City', state, 'US average']
    rows = [{'name': n + ' police' if n in ('New York City', 'Chicago') else n, 'vals': [round(x) for x in US[n][2025]], 'me': n == me, 'avg': n == 'US average'} for n in names]
    v24, v25 = US[me].get(2024), US[me][2025]
    chg = f' Violent crime fell about {round((1 - v25[0]/v24[0])*100)}% on 2024 and property crime about {round((1 - v25[1]/v24[1])*100)}%.' if v24 else ''
    return {
      'title': f'How {me} compares with the rest of the US',
      'intro': f'Offences per 100,000 residents in 2025, as reported to the FBI. {me} is about {v25[0]/US["US average"][2025][0]:.1f} times the US average for violent crime and {v25[1]/US["US average"][2025][1]:.1f} times for property crime.{chg} Big cities always sit above the national average: millions of commuters and visitors are counted as victims but not as residents, and crime is concentrated in some neighbourhoods rather than spread evenly.',
      'cols': ['Violent crime', 'Property crime'], 'unit': 'per 100,000 residents, 2025', 'rows': rows,
      'note': 'Violent crime is murder, rape, robbery and aggravated assault. Property crime is burglary, theft and vehicle theft. For the street you are on, use the area figures above or the Wiley Fox map.',
      'source': {'name': 'FBI Crime Data Explorer, agency summary data (2024–2025)', 'url': 'https://cde.ucr.cjis.gov/'}}
if __name__ == '__main__':
    kind, me, gpath = sys.argv[1], sys.argv[2], sys.argv[3]
    g = json.load(open(gpath))
    g['compare'] = de_block(me) if kind == 'de' else us_block(me, sys.argv[4])
    json.dump(g, open(gpath, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(g['compare'], ensure_ascii=False, indent=1))
