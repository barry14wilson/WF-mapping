# Builds stra/guide.json for the Strasbourg Christmas 2026 guide from researched content + creator DB export.
import json, re, collections, urllib.parse
D = '/home/claude/cityguide/stra'
api = json.load(open(f'{D}/api.json'))
tips = json.load(open(f'{D}/tips.json'))['tips']
costs = json.load(open(f'{D}/costs.json'))
key = lambda n: re.sub(r'[^a-z0-9]', '', n.lower())[:14]
maps = lambda q: 'https://www.google.com/maps/search/?api=1&query=' + urllib.parse.quote(q + ' Strasbourg')
book = lambda q: 'https://www.booking.com/searchresults.html?ss=' + urllib.parse.quote(q + ' Strasbourg') + '&aid=YOUR_AID_HERE'

# creators + sources from the DB export (only videos that yielded facts)
# No channels excluded. One fact was filed under kind 'safety'; it is merged into safety_feeling below.
EXCLUDE = set()
for k in list(api['facts']):
    api['facts'][k] = [f for f in api['facts'][k] if key(f['creator']) not in EXCLUDE]
api['facts'].setdefault('safety_feeling', []).extend(api['facts'].pop('safety', []))
srcs = {s['id']: s for s in api['sources']}
used, cnt = {}, collections.Counter()
for v in api['facts'].values():
    for f in v:
        used.setdefault(f['source_id'], f['creator']); cnt[f['creator']] += 1
creators = {}
for sid, name in used.items():
    creators.setdefault(key(name), {'name': name, 'url': srcs.get(sid, {}).get('url') or f'https://www.youtube.com/watch?v={sid[3:]}'})
sources = sorted([{'creator': used[sid], 'creator_url': creators[key(used[sid])]['url'], 'title': s['title'], 'url': s['url'], 'date': (s.get('published_at') or '')[:7]}
                  for sid, s in srcs.items() if sid in used], key=lambda x: x['creator'].lower())
NC, NV = len(creators), len(sources)

G = {
 'city': 'Strasbourg', 'slug': 'strasbourg', 'country': 'France', 'edition': 'Christmas 2026 edition', 'updated': '2026-10-06',
 'status': "Draft for Barry's approval", 'audience': 'Families and solo travellers',
 'tagline': 'The Wiley Fox guide to Strasbourg for families and solo travellers',
 'cover_blurb': f"What {NC} travel creators actually say about the 'Capital of Christmas', checked against France's 2025 police figures - one of Europe's oldest Christmas markets, where to stay, what to eat, and how the security and crowds work.",
 'banner_text': 'Official travel advice for 200+ countries, community reports, one-tap SOS, and QR wristbands so lost children and lost bags find their way back.',
 'safety': {
  'wf_rating': 3, 'wf_label': 'Moderate',
  'wf_summary': "Strasbourg is a compact, well-policed city where creators - solo women included - felt safe day and night. The main risk for visitors is theft in crowds. French police recorded 25.8 thefts without violence (which includes pickpocketing) per 1,000 residents in 2025, up 16% on 2024: more than twice the Bas-Rhin and French averages, but well below Paris (45.1), Lyon (39.3) and Bordeaux (39.1). Rates are per resident, and the city draws more than three million market visitors. Street robbery and assault are rarer but also above the regional average, and street robbery rose in 2025. At Christmas, security is heavy: more than 1,000 people a day work on market security, every bridge onto the Grande Île has a checkpoint, and cars are banned from the island during market hours. The UK Foreign Office says terrorists are very likely to try to attack in France; a gunman killed five people at the market in December 2018. This rating is for the city as a whole: France does not publish street-level crime data.",
  'creator_feeling': 4, 'creator_feeling_label': 'Safe and friendly - very crowded at weekends',
  'creator_summary': "Creators repeatedly call Strasbourg very safe. Several solo women walked through Petite France and around the cathedral until 11pm without worry, and older solo travellers found it friendly and easy. The visible armed patrols and bag checks at the market struck some as intense but reassuring. The complaints are crowds - the first weekend and the last two weekends before Christmas are shoulder to shoulder - pickpocket warnings from a tour guide at the cathedral and in Petite France, fast cyclists in pedestrian streets, hotel prices of €400-600 a night, and restaurants that close early.",
  'data_note': "Figures are from the SSMSI, the French Interior Ministry's statistics service, for the commune of Strasbourg (about 294,000 residents), published in July 2026. Rates are offences recorded by police per 1,000 residents (burglary per 1,000 homes) and do not count visitors. 2025 in Strasbourg: thefts without violence 25.8 (+16%), thefts from vehicles 6.9 (+32%), violent theft without a weapon 1.3 (+26%), assault outside the family 4.9 (-3%), home burglary 4.3 (-4%), sexual violence 2.2 (+20%). France publishes no street-level crime data, so this guide's map shows the markets, sights and the places named in official or press reports. On New Year's Eve 2025/26, fireworks and petards were banned across Bas-Rhin, under-16s on their own had a curfew, police cleared Place Kléber of fireworks just after midnight, and press counted 117-123 cars burnt across the wider area, mostly in outer districts.",
  'data_months': ['2025-12', '2025-01'],
 },
 'official_crime': [
  {'number': '25.8', 'label': 'Thefts without violence per 1,000 residents (2025)', 'desc': 'Includes pickpocketing. Up 16% on 2024; Paris 45.1, Lyon 39.3, Bas-Rhin 10.0 (SSMSI).'},
  {'number': '1,000+', 'label': 'People on market security every day', 'desc': 'Police, gendarmes, Sentinelle soldiers and private security, with checks on every bridge onto the Grande Île (Préfecture, 2025).'},
  {'number': '-3%', 'label': 'Assaults outside the family (2025)', 'desc': '4.9 per 1,000 residents, against 5.3 in Paris and Lyon. Home burglary also fell 4%.'},
 ],
 'crime_source': {'name': 'SSMSI, Ministère de l\'Intérieur - recorded crime by commune, 2025', 'citation': "Commune and department crime databases (2025 edition, published 9 July 2026 on data.gouv.fr), Eurostat crim_gen_reg for Bas-Rhin (2024), the Préfecture du Bas-Rhin and City of Strasbourg market security plan (November 2025), regional press on New Year's Eve 2025/26, and FCDO France advice (11 August 2026). Rates are per resident, not adjusted for visitors; no street-level data is published."},
 'credit_fallback': 'Source: SSMSI / Préfecture du Bas-Rhin',
 'app_ctas': [
  {'where': 'before_booking', 'text': "France doesn't publish street-level crime data, so before you book, check your hotel's street on the Wiley Fox map and in community reports. Remember the Grande Île is closed to cars during market hours - check how you'll reach your hotel with luggage.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'families', 'text': 'Clip a Wiley Fox QR wristband on each child. If you get separated in the crowd at the cathedral or the Grand Sapin, anyone who scans it can contact you straight away - no app needed on their side.', 'url': 'https://www.thewileyfox.com'},
  {'where': 'night', 'text': "The old town is quiet after the stalls close at 9pm. Save your hotel on Wiley Fox and keep SOS one tap away on the walk back.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'community', 'text': 'Found a cash-only stall, a closed bridge or a street that felt wrong? Drop a community report on the map - it helps the next family.', 'url': 'https://www.thewileyfox.com'},
 ],
 'stats': [
  {'number': '27 Nov', 'label': 'The 2026 market opens', 'desc': 'Stalls 11:30-21:00 daily, from 14:00 on opening day and to 18:00 on 24 December (City of Strasbourg). The 2026 end date is not yet published.'},
  {'number': '3.4m', 'label': 'Visitors in 2024', 'desc': 'A record. Mondays, Tuesdays and mornings are quietest; weekends are packed.'},
  {'number': str(NC), 'label': f'Creators · {NV} videos', 'desc': 'Paraphrased and credited, cross-checked with official sources.'},
 ],
 'overview': [
  "Strasbourg sits on the French side of the Rhine, opposite Germany, and its historic centre - the Grande Île, a UNESCO site - is an island ringed by the River Ill. Everything visitors come for is on or beside it: the soaring Gothic cathedral, the half-timbered canals of Petite France, the Palais Rohan and Place Kléber. It is flat, compact and walkable, with trams for everything else; the station is 10-15 minutes' walk away. Creators suggest two or three days, plus a day trip to Colmar or a wine village.",
  "At Christmas the city calls itself the Capital of Christmas. Its market, the Christkindelsmärik, dates back to 1570 and is one of Europe's oldest; today around 300 wooden chalets fill eight market areas across the island, with a 30-metre tree on Place Kléber that lights up to music every hour after dark. For families there is a free Advent Village with storytelling and workshops, carousels, a tourist train, bear-covered streets and a heated baby-changing area.",
  "For solo travellers Strasbourg feels safe and friendly, and the trams are easy. Plan for heavy crowds at weekends, bag checks on the bridges, a market that closes at 9pm and restaurants that close earlier than you might expect, hotel prices that can triple in December, and cold, damp weather.",
 ],
 'facts': {
  'Currency': 'Euro (EUR) - cards work in most places, but some stalls are cash only or have a €10 minimum; carry small notes',
  'Language': 'French (with Alsatian heritage) - English is spoken in tourist areas, less so in small restaurants',
  'Time zone': 'Central European Time (UTC+1) - one hour ahead of the UK',
  'Plug': 'Type C and E, 230V - UK plugs need an adaptor',
  'Emergency': '112 all services · 17 police · 15 ambulance · 18 fire · 3237 duty pharmacy',
  'Entry': 'UK passport issued less than 10 years before arrival and valid 3+ months after you leave the Schengen area; up to 90 days in any 180. EES biometric checks are running at the border (gov.uk, Oct 2026)',
  'Tipping': "Service is included ('service compris') - leave a few coins for good service if you like",
  'Best time': 'The Christmas market from 27 November, on weekdays and mornings; May-June and September for the canals and storks',
 },
 'stay': [
  {'area': 'Grande Île (the old town)', 'for': ['First-timers', 'Christmas markets', 'Families'], 'why': "Inside the island, steps from the cathedral and the markets. Creators loved waking up in the middle of it, but it is the most expensive area - €400-600 a night at Christmas, booked months ahead - and the island is closed to cars during market hours, so expect to wheel your luggage from the tram or station.", 'creators': ['alpgaliptravel', 'mandyroams', 'alliepiki', 'sebbyfung']},
  {'area': 'Petite France', 'for': ['Couples', 'Families', 'Scenery'], 'why': "The canal quarter at the west end of the island, with half-timbered houses, the covered bridges and the quietest markets (the Advent Village and small producers). Mid-range hotels ran about €100-200 a night outside the busiest dates (2024). Very crowded in the evenings, peaceful late at night.", 'creators': ['touristwalktou', 'travelspotter', 'wikipeaks', 'norosetravels']},
  {'area': 'Quartier Gare (by the station)', 'for': ['Arriving by train', 'Budget', 'Day trips'], 'why': "Modern hotels opposite the station, a flat 10-15 minute walk along pedestrian streets to the markets, and trains to Colmar every half hour. Best Western Plus Monopol Métropole was about $200 a night for two with breakfast (2025). Large luggage is checked on the walk into the old town during the market.", 'creators': ['withloahworld', 'travelwithnjst', 'sebbyfung', 'whereiskat']},
  {'area': 'Krutenau', 'for': ['Solo travellers', 'Young', 'Food'], 'why': "The student quarter just east of the island, with cafés, bars and cheaper eats, and the Marché OFF market nearby. A few minutes' walk to the cathedral.", 'creators': ['missmina', 'leroutin', 'sophienadeau']},
  {'area': 'Neustadt & the European quarter', 'for': ['Quiet nights', 'Families', 'Parks'], 'why': "The grand German-era boulevards north-east of the island, near the Palais du Rhin, Parc de l'Orangerie with its storks and the European Parliament. Quieter and often cheaper, 10-20 minutes' walk or a short tram ride to the markets.", 'creators': ['alicelucastrav', 'nomadflow', 'alpgaliptravel']},
  {'area': 'Further out on the tram', 'for': ['Budget', 'Driving'], 'why': "Alp Galip found a room for about €220 roughly ten minutes from the centre by tram when central hotels were €500-600 (2025). If you drive, the park-and-ride at Baggersee costs €4.20 a day including the tram for up to seven people.", 'creators': ['alpgaliptravel', 'travelingexpat']},
 ],
 'caution': [
  {'area': 'Cathedral square and the Grand Sapin crowds', 'when': 'Afternoons, evenings and weekends', 'note': "The busiest spots in the city at Christmas. A tour guide warned of pickpockets inside the cathedral and in Petite France (2025), and the UK Foreign Office says pickpockets in France work in gangs - one distracts you while another takes from your bag. Keep bags zipped and across your body, phones in front pockets, and agree a meeting point with children.", 'creators': ['ivandeguzman', 'marcusandchels', 'eceylmaz']},
  {'area': 'Bridge checkpoints onto the Grande Île', 'when': 'Market hours (11:30-21:00)', 'note': "Every bridge onto the island has a security check during the market, run by private guards with gendarmes. Large objects and very bulky bags are searched, so leave big bags at the hotel - creators had large luggage stopped on the walk from the station. Some bridges can be closed at short notice on the Prefect's orders, and in 2025 four tram stops on the island were not served during market hours.", 'creators': ['sebbyfung', 'grantteresa']},
  {'area': 'Petite France bridges in the evening', 'when': 'Evenings and weekends', 'note': "Some of the small bridges become almost impossible to cross at peak times. The riverside paths and wider streets give the same views with more space; go early in the morning or after 8-9pm.", 'creators': ['eceylmaz', 'traveltimedj0r', 'alpgaliptravel']},
  {'area': 'Cycle lanes and pedestrian streets', 'when': 'Always', 'note': "Strasbourg has France's biggest cycle network and bikes also use the pedestrian zones. Hold your line when you hear a bell and keep children close.", 'creators': ['woltersworld']},
  {'area': "Place Kléber and outer districts on New Year's Eve", 'when': '31 December night', 'note': "On New Year's Eve 2025/26 police cleared Place Kléber of people firing fireworks just after midnight, and press counted more than 100 cars burnt across the wider area, mostly in outer districts. Fireworks were banned in Bas-Rhin. The 2026/27 rules are not out yet.", 'creators': []},
 ],
 'scams': [
  {'title': 'Pickpockets in the market crowds', 'text': "The main risk. Keep valuables in separate pockets, bags across your body and phones in front. Colmar's crowded lanes have the same problem.", 'creators': ['ivandeguzman', 'globetrottingg']},
  {'title': 'Cup collectors', 'text': "Every drink comes in a cup with a €1 deposit. People may ask for your empty cups to cash in the deposits - you can give them away, return them, or drop them in a charity box.", 'creators': ['travelingexpat', 'floraandnote']},
  {'title': 'Tourist-trap stalls', 'text': "Some chalets sell mass-produced goods, and identical wooden items sell at different prices on different stalls. Look for named Alsatian makers - the small producers' market in Petite France is the safest bet - and compare before you buy.", 'creators': ['florianonair', 'sophienadeau', 'sebbyfung']},
  {'title': 'Card minimums and big notes', 'text': "Some stalls take cash only or set a €10 card minimum, and vendors refused a €100 note. Carry small notes and coins.", 'creators': ['seekingparadis', 'missmina', 'travelingexpat']},
 ],
 'transport': [
  {'title': 'Getting there', 'text': "From London, Eurostar to Paris then the TGV from Gare de l'Est: about 6 hours in all, and the TGV leg takes about 1h45-2h - book early, as December trains fill up. From Strasbourg-Entzheim airport a train runs to the station in 8 minutes (€3.20, 2026). From Basel-Mulhouse airport take the shuttle bus to Saint-Louis station, then the train.", 'creators': ['ninaderena', 'mandyroams', 'ourbucketlistj', 'lesfrenchies']},
  {'title': 'Trams and tickets', 'text': "A single is €1.90 on the CTS app or a contactless card (€2.50 bought on the bus), and the 24h Trio pass covers 1-3 people for €10.20 (2026), including the tram to Kehl in Germany. Under-4s ride free. Validate before you ride. During the market some island stops are skipped - use Gallia, Gare Centrale or République.", 'creators': ['seekingparadis', 'paulideviajesy', 'touristwalktou']},
  {'title': 'Walking the markets', 'text': "The station is a flat 10-15 minutes' walk from the first chalets, and the eight market areas on the island are all within 10 minutes of each other. Cobbles are uneven - creators walked 20,000 steps a day. A little tourist train runs for tired legs.", 'creators': ['sebbyfung', 'grantteresa', 'relaxwalkthewo', 'mandyroams']},
  {'title': 'Driving', 'text': "Cars are banned from the Grande Île during market hours. Use a park-and-ride: €4.20 a day including the tram for up to seven people; Baggersee to Place Kléber is about 15 minutes.", 'creators': ['travelingexpat']},
  {'title': 'Day trips by train', 'text': "Colmar is about 30 minutes by TER, with up to three trains an hour; a return for two cost about €64 in 2025. Obernai and Sélestat are 20-30 minutes, and Riquewihr is reached by train and bus. Bus 21 or tram D crosses into Kehl, Germany.", 'creators': ['globetrottingg', 'marcusandchels', 'travelwithnjst', 'nearfromhomesl', 'withloahworld']},
 ],
 'costs': costs,
 'top_intro': "Ranked by how often creators recommend them. Almost everything is on the Grande Île and walkable in a day; in December do the cathedral and Petite France early, before the market opens at 11:30.",
 'top': [
  {'name': 'Strasbourg Cathedral', 'area': 'Grande Île', 'why': "The rose-pink Gothic cathedral, 142 m tall and once the tallest building in the world. Entry is free (via the south door during the market, with a bag check). At Christmas it hangs 14 tapestries of the life of the Virgin and a large nativity. Note: the famous astronomical clock show is not held during the market. Closed to visitors on Christmas Day.", 'family': True, 'price': 'Free · platform climb €10, child €6', 'url': 'https://www.cathedrale-strasbourg.fr', 'creators': ['culturetrekkin', 'seekingparadis', 'dwtravel', 'growingglobalc', 'travelwithjosh', 'seniorsolotrav', 'dramaticallyex']},
  {'name': 'The cathedral platform', 'area': 'Grande Île', 'why': "330 steps (no lift) to a platform 66 m up, with views over the rooftops to the Black Forest. Queues are long around midday and at Christmas - go early or late afternoon. No big bags or luggage.", 'family': True, 'price': '€10 adult · €6 child (tourist office; another site says €8)', 'url': 'https://www.oeuvre-notre-dame.org', 'creators': ['grantteresa', 'ourbucketlistj', 'marcusandchels', 'klaravyletal', 'nospaceinmypas']},
  {'name': 'Petite France & the Ponts Couverts', 'area': 'Petite France', 'why': "The old tanners' and millers' quarter: half-timbered houses over the canals, a swing bridge and a lock, and the three medieval towers of the covered bridges. Best early in the morning or late in the day, when the crowds thin.", 'family': True, 'price': 'Free', 'url': maps('Petite France'), 'creators': ['dramaticallyex', 'projectgaia', 'viatravelers', 'traveltimedj0r', 'alpgaliptravel', 'missmina']},
  {'name': 'Barrage Vauban', 'area': 'Petite France', 'why': "A 17th-century dam with a free roof terrace looking back over the covered bridges and Petite France - the classic view, and quieter than the lanes. A small lift avoids most of the stairs. The terrace was being rebuilt in mid-2026, so check it has reopened.", 'family': True, 'price': 'Free', 'url': maps('Barrage Vauban'), 'creators': ['marcusandchels', 'exoticvacation', 'eceylmaz', 'culturetrekkin', 'aboutravel']},
  {'name': 'Batorama river cruise', 'area': 'Grande Île', 'why': "A heated, covered boat around the island, through a lock and Petite France to the European quarter - good in rain and with tired children. Creators say to book ahead at Christmas and sit on the right for Petite France.", 'family': True, 'price': '€16 adult · €8.90 age 4-12 (2025/26)', 'url': 'https://www.batorama.com', 'creators': ['ourbucketlistj', 'lesfrenchies', 'aboutravel', 'growingglobalc', 'seekingparadis']},
  {'name': 'Palais Rohan', 'area': 'Grande Île', 'why': "The bishops' baroque palace beside the cathedral, with three museums (fine arts, decorative arts, archaeology); the courtyard is free. At Christmas its riverside terrace hosts a gourmet market. Note: the Alsatian Museum is closed for works until 2028.", 'family': True, 'price': '€9 per museum · under 18 free (2026)', 'url': 'https://www.musees.strasbourg.eu', 'creators': ['marcusandchels', 'thetravelboss', 'exoticvacation', 'eceylmaz']},
  {'name': "Parc de l'Orangerie", 'area': 'Orangerie', 'why': "The city's oldest park, with a lake, a play area and a mini zoo and stork centre that young children love. Muted in winter, but a good run-around away from the crowds.", 'family': True, 'price': 'Free', 'url': maps("Parc de l'Orangerie"), 'creators': ['alicelucastrav', 'travelscout', 'viatravelers', 'growingglobalc', 'beforeyougo']},
  {'name': 'European Parliament', 'area': 'European quarter', 'why': "Free visits and an interactive exhibition of about an hour, with roof views; bring photo ID. Closed on Sundays and public holidays, and hours change when Parliament sits.", 'family': True, 'price': 'Free', 'url': 'https://visiting.europarl.europa.eu', 'creators': ['growingglobalc', 'klaravyletal']},
  {'name': 'Historic wine cellar of the Hospices', 'area': 'Grande Île', 'why': "Medieval wine cellars dating to 1395 under the old hospital, with a barrel from 1472 - free to visit and a warm escape.", 'family': True, 'price': 'Free', 'url': maps('Cave Historique des Hospices de Strasbourg'), 'creators': ['grantteresa']},
  {'name': 'Colmar (day trip)', 'area': '30 minutes by train', 'why': "A storybook Alsatian town with canals (Petite Venise), the Unterlinden Museum and its own Christmas markets, a Ferris wheel and a children's market. Very crowded at weekends - go on a weekday and book the boat. Creators found it easier and cheaper to stay in Strasbourg and visit.", 'family': True, 'price': 'Train about €8-12 each way · boat €9 (2025)', 'url': 'https://noel-colmar.com', 'creators': ['globetrottingg', 'walkingrelax', 'ourbucketlistj', 'seekingparadis', 'juliang', 'nomadflow']},
 ],
 'eat_label': 'Tarte flambée, choucroute and a bredele',
 'eat_intro': "Alsatian food is hearty and half German: tarte flambée (flammekueche, a thin crust with cream, onion and bacon), choucroute with several meats, spätzle, baeckeoffe, pretzels and kougelhopf. Eat in a winstub, and book: restaurants fill at Christmas and many kitchens close around 2pm and stop early in the evening. Prices carry the year.",
 'eat': [
  {'name': 'Maison Kammerzell', 'area': 'Cathedral square', 'type': 'Alsatian', 'price': '€€€', 'family': True, 'why': "The 15th-century carved house beside the cathedral. Touristy, but the choucroute with three fish is worth trying and portions are huge; book at Christmas.", 'creators': ['exoticvacation', 'mandyroams', 'missmina', 'yassoldat'], 'url': maps('Maison Kammerzell')},
  {'name': 'Maison des Tanneurs', 'area': 'Petite France', 'type': 'Alsatian', 'price': '€€€', 'family': True, 'why': "A famous riverside timbered house known for its choucroute.", 'creators': ['woltersworldea', 'wikipeaks'], 'url': maps('Maison des Tanneurs')},
  {'name': 'La Corde à Linge', 'area': 'Petite France', 'type': 'Alsatian', 'price': '€€', 'family': True, 'why': "Traditional choucroute with five meats and spätzle in mushroom sauce, on a pretty square.", 'creators': ['stufrtravelfoo'], 'url': maps('La Corde à Linge')},
  {'name': 'Le Chauvin Père et Fils', 'area': 'Petite France', 'type': 'Alsatian tapas', 'price': '€€', 'family': True, 'why': "Small plates of local specialities for lunch or dinner - a way to try several dishes.", 'creators': ['stufrtravelfoo'], 'url': maps('Le Chauvin Père et Fils')},
  {'name': 'Le Petit Mélie', 'area': 'North of the cathedral', 'type': 'Tarte flambée', 'price': '€', 'family': True, 'why': "A small family-run restaurant with house-made tarte flambée, an affordable dinner (2026).", 'creators': ['exoticvacation'], 'url': maps('Le Petit Mélie')},
  {'name': 'Au Crocodile', 'area': 'Rue de l\'Outre', 'type': 'Fine dining', 'price': '€€€€', 'family': False, 'why': "The Michelin-starred restaurant locals most often name as Strasbourg's best - expensive but excellent.", 'creators': ['yassoldat'], 'url': maps('Au Crocodile')},
  {'name': 'La Hache', 'area': 'Strasbourg', 'type': 'Bistro', 'price': '€€', 'family': True, 'why': "A local's pick for meat and beef tartare, with an affordable lunch menu that changes daily.", 'creators': ['yassoldat'], 'url': maps('La Hache')},
  {'name': 'Café Potager', 'area': 'Strasbourg', 'type': 'Café', 'price': '€', 'family': True, 'why': "Known for its carrot cake - a good warm-up stop.", 'creators': ['stufrtravelfoo'], 'url': maps('Café Potager')},
  {'name': 'Tonton Café Gâteau', 'area': 'Petite France', 'type': 'Café', 'price': '€', 'family': True, 'why': "Coffee and pastries in the canal quarter.", 'creators': ['stufrtravelfoo'], 'url': maps('Tonton Café Gâteau')},
  {'name': 'Au Coin du Grill', 'area': 'Strasbourg', 'type': 'Kebab', 'price': '€', 'family': True, 'why': "A well-known local kebab shop with house-made bread: veal €9, chicken €8 (2026). Strasbourg's kebab shops are a local institution.", 'creators': ['leroutin', 'isma'], 'url': maps('Au Coin du Grill')},
 ],
 'grown_ups': "For a grown-ups' evening: a vin chaud blanc (Alsace makes its mulled wine with white wine and honey) or a Christmas beer at the market, then a winstub for choucroute with a glass of Riesling or crémant, or a beer with a shot of Picon like the locals. The market closes at 9pm and the old town goes quiet soon after; Krutenau has the student bars. The drinking age is 18.",
 'hotels': [
  {'name': 'Maison Rouge Strasbourg Hotel & Spa', 'area': 'Place Kléber, Grande Île', 'for': 'Luxury', 'band': '€€€€', 'why': "Historic hotel with a spa in the pedestrian zone, five minutes from the cathedral; rooms a little small. About $370 a night for two with breakfast (2025).", 'url': book('Maison Rouge Strasbourg'), 'source': 'withloahworld'},
  {'name': 'Hôtel & Spa Le Bouclier d\'Or', 'area': 'Petite France', 'for': 'Couples', 'band': '€€€', 'why': "A 16th-century building in Petite France with a spa, antique-furnished rooms and a tea room.", 'url': book('Le Bouclier d\'Or'), 'source': 'travelspotter'},
  {'name': 'Hotel Leonor', 'area': 'Grande Île', 'for': 'Families & markets', 'band': '€€€', 'why': "About 100 m from the markets, with a courtyard and a good breakfast buffet (December 2025).", 'url': book('Hotel Leonor'), 'source': 'alliepiki'},
  {'name': 'Hôtel Tandem', 'area': 'Opposite the station', 'for': 'Arriving by train', 'band': '€€', 'why': "Boutique hotel with quiet, comfortable rooms and a good breakfast, 10-15 minutes' walk to the markets (2025).", 'url': book('Hôtel Tandem'), 'source': 'travelwithnjst'},
  {'name': 'Best Western Plus Monopol Métropole', 'area': 'By the station', 'for': 'Good value', 'band': '€€', 'why': "Three minutes from the station, clean and well soundproofed; about $200 a night for two with breakfast (2025).", 'url': book('Best Western Plus Monopol Métropole'), 'source': 'withloahworld'},
 ],
 'itinerary': {
  '1day': [
   ['08:30', 'Petite France before the crowds', 'The canals, the covered bridges and the Barrage Vauban terrace.'],
   ['10:00', 'Cathedral and platform', 'Inside for the tapestries and nativity, then the 330 steps (no big bags).'],
   ['11:30', 'Markets open', 'Christkindelsmärik on Place Broglie and the cathedral market while it is calmer.'],
   ['13:00', 'Lunch', 'Tarte flambée in a winstub - book, as kitchens close around 2pm.'],
   ['14:30', 'Boat or museum', 'Batorama cruise round the island, or Palais Rohan.'],
   ['16:30', 'Lights and the Grand Sapin', 'The tree lights up to music each hour after dark; walk Rue du Maroquin and Rue Mercière.'],
   ['18:30', 'Dinner', 'Choucroute at Maison Kammerzell or in Petite France.'],
  ],
  '3day': [
   ['Day 1 · The island', 'Cathedral and platform early.', 'Christkindelsmärik, cathedral and Kléber markets.', 'Grand Sapin light show and dinner in a winstub.'],
   ['Day 2 · Petite France & family', 'Petite France, Barrage Vauban and the boat.', 'Advent Village and the small producers\' market at Square Louise Weiss.', 'Place Benjamin Zix and Saint-Thomas markets; Marché OFF.'],
   ['Day 3 · Day trip', 'Train to Colmar (30 min) on a weekday.', 'Petite Venise, the Unterlinden Museum and the markets.', 'Back for a last vin chaud - or Obernai, or Baden-Baden in Germany instead.'],
  ],
 },
 'tips': [
  {'title': 'Book early', 'text': "Central hotels reach €400-600 a night at Christmas and sell out months ahead. Staying by the station or along the tram line is cheaper."},
  {'title': 'Go on weekdays, mornings or late', 'text': "The city says Mondays, Tuesdays and mornings are quietest; Wednesday afternoons, Friday evenings and weekends are packed. Stalls open at 11:30 - see the sights first."},
  {'title': 'Small notes and the cup deposit', 'text': "Some stalls are cash only or have a €10 card minimum. Every drink comes in a cup with a €1 deposit - keep it, return it to any stall, or donate it to charity."},
  {'title': 'Book dinner, eat earlier', 'text': "Many kitchens stop at about 2pm and again early in the evening, and restaurants fill at Christmas. Reserve, or eat at the market."},
  {'title': 'Leave big bags at the hotel', 'text': "Every bridge onto the island has a bag check during the market, and the cathedral platform has no left luggage."},
  {'title': 'Christmas Eve to 26 December', 'text': "Stalls close at 18:00 on 24 December. The cathedral and city museums are closed on Christmas Day, and 26 December is an extra public holiday in Alsace, so most shops are shut."},
 ],
 'tips_intro': "Every tip here was checked against an official or trusted source (the City of Strasbourg, CTS, the Préfecture, SNCF, gov.uk and others) on the date shown. Rules and prices change, so tap the link to double-check before you travel.",
 'christmas': {
  'intro': "Strasbourg's Christkindelsmärik dates back to 1570, which makes it one of the oldest Christmas markets in Europe, and the city now bills itself as the Capital of Christmas. Around 300 chalets fill eight market areas on the Grande Île, each with its own character, linked by streets decorated with lights, bears and stars. The 2026 market opens on Friday 27 November. It is very crowded - 3.4 million visitors in 2024 - and protected by a heavy security operation, with checkpoints on every bridge onto the island.",
  'markets': [
   {'name': 'Christkindelsmärik (Place Broglie)', 'area': 'Grande Île', 'when': 'From 27 Nov 2026 · 11:30-21:00 · 24 Dec to 18:00', 'why': "The historic market, on Place Broglie in front of the town hall since 1871. Food-focused, with more than 100 stalls, covered tables and benches, bredele biscuits, pretzels, tarte flambée on baguette, potato pancakes with Munster and curry sausages. Good for decorations and the annual mugs; some creators found the crafts mass-produced.", 'family': True, 'price': 'Free entry · vin chaud about €4-5 + €1 cup (2025)', 'crowds': "Busy, but several creators found it less crowded than Kléber and liked the covered eating area for warmth.", 'creators': ['sophienadeau', 'marcusandchels', 'ourbucketlistj', 'florianonair', 'dwtravel', 'paulideviajesy', 'seekingparadis'], 'url': 'https://noel.strasbourg.eu'},
   {'name': 'Around the Cathedral', 'area': 'Place de la Cathédrale & Place du Château', 'when': 'From 27 Nov 2026 · 11:30-21:00', 'why': "The prettiest and busiest market, under the floodlit cathedral: ornaments, miniature Alsatian houses, candles, crafts, a carousel and a chocolate fountain. The cathedral glows gold at sunset.", 'family': True, 'price': 'Free entry', 'crowds': "The most crowded market, shoulder to shoulder on evenings and weekends. Go in the morning on a weekday.", 'creators': ['andrewkait', 'grantteresa', 'mathersonthema', 'ninaderena', 'swisswalks4k', 'villagecitywal'], 'url': 'https://noel.strasbourg.eu'},
   {'name': 'Place Kléber & the Grand Sapin', 'area': 'Place Kléber', 'when': 'From 27 Nov 2026 · tree lit nightly', 'why': "The roughly 30-metre tree, decorated to a new theme each year, lights up to music every hour after dark (creators saw shows from 4pm to 9pm). Around it, the Village du Partage gathers about 90 charities, with the star soup that raises money for good causes, and a Santa post box. Traveling Expats found the best food stalls here: spätzle €10, pork knuckle €20 (2025).", 'family': True, 'price': 'Free', 'crowds': "Crowded in the evening, but space opens up about 15 metres from the tree. In 2025 the seating area here was closed at weekends to ease crowds.", 'creators': ['seekingparadis', 'floraandnote', 'ourbucketlistj', 'grantteresa', 'travelingexpat', 'sophienadeau', 'paulideviajesy'], 'url': 'https://noel.strasbourg.eu'},
   {'name': 'Petite France: Place Benjamin Zix & Place Saint-Thomas', 'area': 'Petite France', 'when': 'From 27 Nov 2026 · 11:30-21:00', 'why': "Two small markets in the canal quarter. Benjamin Zix has about a dozen stalls in a very pretty corner; Saint-Thomas, beside the church, was a family favourite for Nutella-banana crêpes and big shared portions.", 'family': True, 'price': 'Free entry', 'crowds': 'Smaller and calmer, though the lanes around them are packed in the evenings.', 'creators': ['sophienadeau', 'ourbucketlistj', 'seekingparadis', 'wonderjourneys'], 'url': 'https://noel.strasbourg.eu'},
   {'name': "Advent Village & Alsace's small producers (Square Louise Weiss)", 'area': 'Petite France', 'when': 'From 27 Nov 2026', 'why': "The calmest, cosiest corner: local organic wine, honey, jam, chocolate and bredele from Alsace producers, plus free daily storytelling, workshops, concerts and games for children. A heated baby-changing and feeding area is nearby.", 'family': True, 'price': 'Free', 'crowds': 'Quiet - lovely at night with the lights on the river.', 'creators': ['dwtravel', 'sophienadeau', 'paulideviajesy', 'prowalktours'], 'url': 'https://noel.strasbourg.eu'},
   {'name': 'The gourmet market (Terrasse Rohan & Place du Marché-aux-Poissons)', 'area': 'Riverside by Palais Rohan', 'when': 'From 27 Nov 2026', 'why': "A food-only market along the river under hundreds of hanging stars: biscuits, Alsace wine with tastings, local delicacies. The boat tours leave from here.", 'family': True, 'price': 'Free entry', 'crowds': 'One of the quieter markets.', 'creators': ['sophienadeau', 'alexandmehmet', 'paulideviajesy', 'ourbucketlistj'], 'url': 'https://noel.strasbourg.eu'},
   {'name': "Carré d'Or market (Place du Temple Neuf)", 'area': 'Grande Île', 'when': 'From 27 Nov 2026', 'why': "Part of the 'golden square' of streets dressed with the city's most elaborate decorations, including the teddy-bear house on Rue du Maroquin, best at dusk.", 'family': True, 'price': 'Free', 'crowds': 'The decorated streets are very busy in the evening; in 2025 several were made one-way at weekends.', 'creators': ['alpgaliptravel', 'wonderjourneys', 'floraandnote', 'ourbucketlistj'], 'url': 'https://noel.strasbourg.eu'},
   {'name': 'Marché OFF (Place Grimmeissen)', 'area': 'By Krutenau', 'when': 'From 27 Nov 2026', 'why': "An alternative market in shipping containers: social and solidarity enterprises, second-hand and upcycled goods, organic food and a stage. The place for vegan hot chocolate.", 'family': True, 'price': 'Free', 'crowds': 'One of the quietest markets.', 'creators': ['dwtravel', 'sophienadeau', 'paulideviajesy'], 'url': 'https://noel.strasbourg.eu'},
  ],
  'sights': [
   {'name': 'The cathedral at Christmas', 'area': 'Grande Île', 'when': 'Mon-Sat 08:30-17:45 during the market · closed to visitors 25 Dec', 'why': "Free, with 14 tapestries shown only from Advent to Epiphany and a large nativity. Enter by the south door from Place du Château, with a bag check. The astronomical clock show does not run during the market.", 'family': True, 'price': 'Free', 'crowds': 'Long queues at Christmas, especially on Christmas Eve afternoon.', 'creators': ['bucketlisturba', 'sophienadeau', 'tamiltravelmak', 'floraandnote'], 'url': 'https://www.cathedrale-strasbourg.fr'},
   {'name': 'Christmas cruise on the Ill', 'area': 'From Palais Rohan', 'when': 'Latest year: 28 Nov - 3 Jan, daily 10:00-17:45', 'why': "A heated, covered boat of about 70 minutes past Petite France and the European quarter. Book ahead - afternoons sell out.", 'family': True, 'price': '€16 adult · €8.90 age 4-12 (2025/26)', 'crowds': 'Book in advance at Christmas.', 'creators': ['ourbucketlistj', 'lesfrenchies', 'seekingparadis'], 'url': 'https://www.batorama.com'},
   {'name': 'Colmar Christmas markets', 'area': 'Day trip, 30 minutes by train', 'when': '23 Nov - 29 Dec 2026 · 24 Dec to 17:00', 'why': "Several small themed markets scattered through the old town, a Ferris wheel, a carousel and a children's market; children sail paper boats on the canals. Charming but very crowded at weekends.", 'family': True, 'price': 'Free entry', 'crowds': "Packed on Friday evenings and weekends; the Petite Venise boat queue was about an hour.", 'creators': ['walkingrelax', 'gezginbirchef', 'seekingparadis', 'ourbucketlistj'], 'url': 'https://noel-colmar.com'},
   {'name': 'Obernai, Riquewihr & Kaysersberg', 'area': 'Wine villages, day trip', 'when': 'Obernai 27 Nov - 31 Dec · Riquewihr 27 Nov - 20 Dec · Kaysersberg Advent weekends only', 'why': "Smaller, quieter village markets. Obernai is 30 minutes by train; Riquewihr is train plus bus; Kaysersberg opens Friday to Sunday only. Traffic and parking in Riquewihr were very bad on a December Saturday.", 'family': True, 'price': 'Free entry', 'crowds': 'Avoid weekends for the villages.', 'creators': ['marcusandchels', 'gezginbirchef', 'ourbucketlistj'], 'url': 'https://www.visit.alsace'},
   {'name': 'Baden-Baden & Gengenbach (Germany)', 'area': 'Across the Rhine', 'when': 'Baden-Baden 26 Nov 2026 - 6 Jan 2027 · Gengenbach Advent calendar from 27 Nov', 'why': "Baden-Baden's market sparkles around the Kurhaus; in Gengenbach the town hall becomes a giant Advent calendar, with a window opened at 6pm each evening.", 'family': True, 'price': 'Free entry', 'crowds': 'Evenings are busiest.', 'creators': ['silentcitywalk'], 'url': 'https://www.baden-baden.com'},
  ],
  'safety': [
   {'title': 'Crowds and timing', 'text': "The city says Mondays, Tuesdays and mornings are quietest and that Wednesday afternoons, Friday evenings and weekends are very crowded; creators found 10am-4pm hectic and after 8-9pm calmer. The first weekend and the last two weekends before Christmas are the busiest.", 'creators': ['sebbyfung', 'wonderjourneys', 'florianonair']},
   {'title': 'Security on the bridges', 'text': "In 2025 more than 1,000 people a day worked on market security - police, gendarmes, Sentinelle soldiers, private guards and drone monitoring - with checks at every bridge onto the island, bulky bags searched, and cars banned during market hours. Creators found the armed patrols intense-looking but reassuring. The 2026 plan is usually announced in mid-November.", 'creators': ['touristwalktou', 'sebbyfung', 'grantteresa']},
   {'title': 'Remembering 2018', 'text': "On 11 December 2018 a gunman killed five people at the Christmas market. A memorial stele stands at the foot of the Palais du Rhin on Place de la République. The UK Foreign Office says terrorists are very likely to try to attack in France; stay alert and follow police instructions.", 'creators': []},
   {'title': 'Pickpockets', 'text': "A tour guide warned of pickpockets in the cathedral and Petite France. The Foreign Office says gangs work by distraction. Keep valuables in separate inner pockets and bags across your body.", 'creators': ['ivandeguzman']},
   {'title': 'Cups, cash and food', 'text': "Every drink comes in a cup with a €1 deposit (keep it, return it, or donate it to charity). Vin chaud was about €4-5 in 2025, most hot dishes €7-12, a pork knuckle €20. Carry small notes - some stalls are cash only or have a €10 card minimum. In 2022 the city asked stalls to sell regional food and set up standing areas behind the chalets for eating.", 'creators': ['grantteresa', 'travelingexpat', 'mandyroams', 'florianonair', 'poopiblh']},
   {'title': 'Have a lost-child plan', 'text': "Before you go in, agree a meeting point everyone can find - the information booth on Place Kléber works well. A Wiley Fox QR wristband on each child means anyone who finds them can reach you straight away.", 'creators': []},
   {'title': "New Year's Eve", 'text': "In 2025/26 fireworks were banned across Bas-Rhin, under-16s on their own had a curfew, and police cleared Place Kléber of fireworks just after midnight; cars were burnt in outer districts. With children, see the new year in at your hotel or a restaurant. 2026/27 rules are not out yet.", 'creators': []},
  ],
  'plan': "In 2026 the market opens on Friday 27 November (from 14:00), then runs 11:30-21:00 daily, closing at 18:00 on Christmas Eve; the 2026 end date is not yet published (2025 ended on 24 December). The cathedral and city museums are closed on 25 December, and 26 December is an extra public holiday in Alsace. Colmar runs to 29 December and Obernai to 31 December. Book hotels, restaurants and the boat early.",
 },
 'map_intro': "France doesn't publish street-level crime data, so this map shows the markets and sights in this guide, plus the busiest crowd spots and the places named in official or press reports.",
 'map_pins': [
  {'n': 'Christkindelsmärik (Place Broglie)', 'lat': 48.5853, 'lng': 7.7495, 'kind': 'market', 'note': 'The historic market, from 27 Nov 2026.'},
  {'n': 'Cathedral market', 'lat': 48.5818, 'lng': 7.7506, 'kind': 'market', 'note': 'Prettiest and busiest.'},
  {'n': 'Place Kléber & Grand Sapin', 'lat': 48.5834, 'lng': 7.7457, 'kind': 'market', 'note': 'Tree light show every hour after dark.'},
  {'n': 'Place Benjamin Zix', 'lat': 48.5806, 'lng': 7.7413, 'kind': 'market', 'note': 'Tiny and pretty.'},
  {'n': 'Place Saint-Thomas', 'lat': 48.5797, 'lng': 7.7449, 'kind': 'market', 'note': 'Family favourite for crêpes.'},
  {'n': 'Advent Village (Square Louise Weiss)', 'lat': 48.5799, 'lng': 7.7399, 'kind': 'market', 'note': 'Free children\'s activities; small producers.'},
  {'n': "Carré d'Or (Place du Temple Neuf)", 'lat': 48.5828, 'lng': 7.7478, 'kind': 'market', 'note': 'Decorated streets and the teddy-bear house.'},
  {'n': 'Gourmet market (Terrasse Rohan)', 'lat': 48.5808, 'lng': 7.7524, 'kind': 'market', 'note': 'Food market by the river; boats leave here.'},
  {'n': 'Marché OFF (Place Grimmeissen)', 'lat': 48.5799, 'lng': 7.7545, 'kind': 'market', 'note': 'Alternative market in containers.'},
  {'n': 'Barrage Vauban', 'lat': 48.5793, 'lng': 7.7385, 'kind': 'sight', 'note': 'Free terrace view over Petite France.'},
  {'n': 'Ponts Couverts', 'lat': 48.5796, 'lng': 7.7398, 'kind': 'sight', 'note': 'Medieval towers and bridges.'},
  {'n': 'Palais Rohan', 'lat': 48.5811, 'lng': 7.7519, 'kind': 'sight', 'note': 'Three museums; €9 each, under 18 free.'},
  {'n': 'Gare Centrale', 'lat': 48.5850, 'lng': 7.7349, 'kind': 'sight', 'note': '10-15 minutes\' walk to the markets; bag checks on the way in.'},
  {'n': "Parc de l'Orangerie", 'lat': 48.5907, 'lng': 7.7741, 'kind': 'sight', 'note': 'Storks and a mini zoo.'},
  {'n': '2018 attack memorial (Place de la République)', 'lat': 48.5875, 'lng': 7.7535, 'kind': 'sight', 'note': 'Memorial stele at the foot of the Palais du Rhin.'},
  {'n': 'Cathedral square crowds', 'lat': 48.5815, 'lng': 7.7512, 'kind': 'caution', 'note': 'Busiest spot; pickpocket warnings from a tour guide (2025).'},
  {'n': "Place Kléber on New Year's Eve", 'lat': 48.5838, 'lng': 7.7462, 'kind': 'caution', 'note': 'Police cleared fireworks here just after midnight on 1 Jan 2026.'},
 ],
 'map': {'center': [7.748, 48.582], 'zoom': 14.3},
 'compare': {
  'title': 'How Strasbourg compares with other French cities',
  'intro': "Offences recorded by police in 2025 per 100,000 residents (burglary per 100,000 homes), from the French Interior Ministry's commune data. Strasbourg is well below Paris, Lyon and Bordeaux for theft, but above the regional and national averages - as every big tourist city is, because visitors are counted as victims but not as residents.",
  'cols': ['Theft without violence', 'Violent theft', 'Assault', 'Home burglary'], 'unit': 'per 100,000 residents (burglary per 100,000 homes), 2025',
  'rows': [
   {'name': 'Colmar', 'vals': [1760, 43, 536, 371], 'me': False},
   {'name': 'Toulouse', 'vals': [2050, 205, 496, 639], 'me': False},
   {'name': 'Marseille', 'vals': [1932, 288, 503, 932], 'me': False},
   {'name': 'Strasbourg', 'vals': [2581, 128, 491, 427], 'me': True},
   {'name': 'Lille', 'vals': [3054, 350, 655, 896], 'me': False},
   {'name': 'Bordeaux', 'vals': [3906, 383, 509, 688], 'me': False},
   {'name': 'Lyon', 'vals': [3932, 610, 531, 688], 'me': False},
   {'name': 'Paris', 'vals': [4512, 345, 527, 505], 'me': False},
   {'name': 'France average', 'vals': [922, 71, 307, 566], 'avg': True},
  ],
  'note': "France average is Wiley Fox's calculation from the department data. Violent theft means theft with force but no weapon. Compare within France only: other countries record crime differently. Lyon's violent-theft figure nearly doubled between 2024 and 2025 and may reflect a recording change.",
  'source': {'name': 'SSMSI, Ministère de l\'Intérieur - bases communales de la délinquance enregistrée, 2025', 'url': 'https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales'}},
 'creators': creators,
 'sources': sources,
}
# sanity: every creator key referenced exists
refs = set()
def walk(x):
    if isinstance(x, dict):
        for k, v in x.items():
            if k == 'creators' and isinstance(v, list): refs.update(v)
            elif k == 'source' and isinstance(v, str) and v.islower(): refs.add(v)
            else: walk(v)
    elif isinstance(x, list): [walk(i) for i in x]
walk({k: v for k, v in G.items() if k != 'creators'})
missing = sorted(r for r in refs if r not in creators)
print('creators', NC, 'videos', NV, 'missing keys:', missing)
json.dump(G, open(f'{D}/guide.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'tips': tips}, open(f'{D}/tips.json', 'w'), ensure_ascii=False, indent=1)
