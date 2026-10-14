# Builds prg/guide.json for the Prague Christmas 2026 guide from researched content + creator DB export.
import json, re, collections, urllib.parse
D = '/home/claude/cityguide/prg'
api = json.load(open(f'{D}/api.json'))
tips = json.load(open(f'{D}/tips.json'))['tips']
costs = json.load(open(f'{D}/costs.json'))
key = lambda n: re.sub(r'[^a-z0-9]', '', n.lower())[:14]
maps = lambda q: 'https://www.google.com/maps/search/?api=1&query=' + urllib.parse.quote(q + " Praha")
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__)))); import affiliate
book = lambda q: affiliate.wrap('https://www.booking.com/searchresults.html?ss=' + urllib.parse.quote(q + " Praha"), "Prague")

# creators + sources from the DB export (only videos that yielded facts)
# No channels excluded.
EXCLUDE = set()
for k in list(api['facts']):
    api['facts'][k] = [f for f in api['facts'][k] if key(f['creator']) not in EXCLUDE]
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

# Research tips that carry no usable advice are dropped (they only say a fact could not be found).
DROP = ('What about bus 119', 'Will transport run normally on 24 December', 'Are there good playgrounds nearby', 'Is there a deposit on the mug')
tips = [t for t in tips if not t['worry'].startswith(DROP)]
# Two facts were filed under a tip category as their kind; fold them into 'tip'.
api['facts'].setdefault('tip', []).extend(api['facts'].pop('money_tipping', []))

G = {
 'city': 'Prague', 'slug': 'prague', 'country': 'Czechia', 'edition': 'Christmas 2026 edition', 'updated': '2026-10-14',
 'status': "Draft for Barry's approval", 'audience': 'Families and solo travellers',
 'tagline': 'The Wiley Fox guide to Prague for families and solo travellers',
 'cover_blurb': f"What {NC} travel creators actually say about Prague at Christmas, checked against Czech police figures for 2025 - the markets worth your time, where to stay, what to eat, and the money and taxi traps that catch visitors out.",
 'banner_text': 'Official travel advice for 200+ countries, community reports, one-tap SOS, and QR wristbands so lost children and lost bags find their way back.',
 'safety': {
  'wf_rating': 4, 'wf_label': 'Low',
  'wf_summary': "Prague is a calm city for visitors: creators - solo women and families included - felt safe day and night, and local guides say there are no no-go areas. The risks are pickpocketing in crowds and losing money to traps rather than to crime. Czech police registered 34,853 crimes in Prague in 2025, down 9% on 2024: 2,492 per 100,000 residents, about 1.6 times the Czech average, which the statistics office puts down partly to tourists and commuters being counted as victims but not as residents. Violent crime (115 per 100,000) is level with the regions around Brno and Plzeň and below Ostrava's. Pickpocketing makes up about 9% of Prague's property crime - a far bigger share than elsewhere in the country - and the UK Foreign Office warns of it on airport transport, the trams to the castle and in busy tourist areas. The other danger creators stress is the trams: heavy, fast and with right of way. This rating is for the city as a whole: Czechia does not publish street-level crime data.",
  'creator_feeling': 4, 'creator_feeling_label': 'Safe and friendly - watch your money and the crowds',
  'creator_summary': "Creators repeatedly call Prague one of the safest cities in Europe, and several solo women walked home late at night without worry. Local guides say genuine scams are now rare and the topic is overblown; what does happen is street money-changers handing over worthless notes, exchange offices with terrible rates, overpriced street taxis, food sold by weight and restaurants that add a service charge. In December the Old Town, Charles Bridge and the castle are packed, especially at weekends. A few places get rowdy after dark - the bottom of Wenceslas Square, the park by the main station, Dlouhá Street and around Anděl.",
  'data_note': "Figures are from the Czech Statistical Office's crime publication (June 2026), which republishes Czech Police data for 2025, cross-checked against the police's own regional table. Prague is both a city and a region, so these are city figures. Rates are the statistics office's own, per 100,000 residents at mid-year. 2025 in Prague: all registered crime 34,853 (-9.3%), property crime 23,270 (-9.4%), violent crime 1,609 (+0.8%), robbery 204 (+12.7%), home burglary 724 (-1.0%). Czech law counts many small thefts as minor offences rather than crimes, and the police clear only 27% of Prague cases (the lowest of 14 regions, because most are anonymous property crimes), so compare Prague only with other Czech regions, not with other countries. Czechia publishes no street-level data, so this guide's map shows the markets and sights and the places creators and police name. On New Year's Eve 2025/26 Prague 1 reported no serious incidents; police logged 269 reports in the district, 54 of them about fireworks.",
  'data_months': ['2025-12', '2025-01'],
 },
 'official_crime': [
  {'number': '-9%', 'label': 'Registered crime in Prague (2025)', 'desc': '34,853 crimes, the biggest fall of any Czech region; 2,492 per 100,000 residents against 1,561 nationally (ČSÚ).'},
  {'number': '115', 'label': 'Violent crimes per 100,000 residents (2025)', 'desc': 'Level with South Moravia (112) and Plzeň (121), below Moravia-Silesia (150).'},
  {'number': '9%', 'label': "Pickpocketing's share of Prague property crime", 'desc': 'Against about 1-2% in smaller regions - the clearest sign of where the risk is (ČSÚ 2025).'},
 ],
 'crime_source': {'name': 'Czech Statistical Office / Police of the Czech Republic - registered crime 2025', 'citation': "ČSÚ 'Kriminalita 2015-2025' (published 23 June 2026) and its tables, the Police ČR 2025 regional summary, Prague 1 New Year's Eve report (February 2026), Police ČR Advent measures (2024, latest found), Prague's fireworks rules, and FCDO Czechia advice (checked 14 October 2026). Rates are per resident, not adjusted for visitors; no street-level data is published."},
 'credit_fallback': 'Source: Czech police / official sources',
 'app_ctas': [
  {'where': 'before_booking', 'text': "Czechia doesn't publish street-level crime data, so before you book, check your hotel's street on the Wiley Fox map and in community reports. Creators steer families away from Dlouhá Street, the top of Wenceslas Square and the streets around the main station.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'families', 'text': 'Clip a Wiley Fox QR wristband on each child. If you get separated in the crowd on Charles Bridge or at the Old Town tree, anyone who scans it can contact you straight away - no app needed on their side.', 'url': 'https://www.thewileyfox.com'},
  {'where': 'night', 'text': "The big markets close at 10pm and trams thin out late. Save your hotel on Wiley Fox, use an app taxi rather than a street one, and keep SOS one tap away on the walk back.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'community', 'text': 'Found a bad exchange rate, a cash-only stall or a street that felt wrong? Drop a community report on the map - it helps the next family.', 'url': 'https://www.thewileyfox.com'},
 ],
 'stats': [
  {'number': '28 Nov', 'label': 'Old Town & Wenceslas markets open', 'desc': 'To 6 January 2027, 10:00-22:00 (organiser). Náměstí Míru opens on 20 November.'},
  {'number': '-9%', 'label': 'Crime in Prague, 2025', 'desc': 'The biggest fall of any Czech region (Czech Statistical Office).'},
  {'number': str(NC), 'label': f'Creators · {NV} videos', 'desc': 'Paraphrased and credited, cross-checked with official sources.'},
 ],
 'overview': [
  "Prague's historic centre straddles the Vltava. On the east bank are the Old Town (Staré Město), with the Old Town Square and the Astronomical Clock, the Jewish Quarter (Josefov) and the New Town (Nové Město) around Wenceslas Square; Charles Bridge crosses to the Lesser Town (Malá Strana) and up the hill to Prague Castle. The centre is compact and walkable but cobbled and hilly on the castle side, and trams and three metro lines cover the rest. Creators suggest three or four days.",
  "At Christmas the two big markets on the Old Town Square and Wenceslas Square run from the last Saturday of November into January, and the Old Town tree lights up to music every hour after dark. Smaller, cheaper markets fill local squares - Náměstí Míru in Vinohrady is the locals' favourite. A lamplighter lights the gas lamps on Charles Bridge in the weeks before Christmas, and there are rinks, concerts and a free children's programme at the main market.",
  "For solo travellers Prague feels safe and friendly, and English is widely spoken. Plan for packed streets in December (especially weekends), dark afternoons from about 4pm, icy cobbles, and the money traps: pay by card in koruna, never change money on the street, and use a ride app instead of a street taxi. Large shops close at noon on 24 December and all day on 25 and 26 December.",
 ],
 'facts': {
  'Currency': 'Czech koruna (CZK) - about 24.4 to the euro (Czech National Bank, Oct 2026). Pay by card in koruna; euros are taken in some tourist places at poor rates',
  'Language': 'Czech - English is widely spoken in the centre',
  'Time zone': 'Central European Time (UTC+1) - one hour ahead of the UK',
  'Plug': 'Type E, 230V - UK plugs need an adaptor',
  'Emergency': '112 all services · 158 police · 155 ambulance · 150 fire · 156 city police',
  'Entry': 'UK passport issued less than 10 years before arrival and valid 3+ months after you leave the Schengen area; up to 90 days in any 180. EES fingerprint and photo checks at the border - creators report long Christmas queues at the airport',
  'Tipping': "About 10% for good service, or round up - check first whether a service charge is already on the bill",
  'Best time': 'Weekdays from 28 November, early mornings and evenings; avoid Advent weekends in the Old Town',
 },
 'stay': [
  {'area': 'Staré Město (Old Town)', 'for': ['First-timers', 'Christmas markets', 'Walking'], 'why': "Everything is on the doorstep, and creators suggest it for winter because daylight is short and the hilly Lesser Town gets slippery. It is the priciest and noisiest area: pick a calm street or a courtyard room, and avoid Karlova, Kaprova and the party street Dlouhá. Mid-range hotels from about $80-150 a night outside peak dates (2026).", 'creators': ['realpragueguid', 'nashtereza', 'destinationwel', 'theultimatetra', 'corrtraveleuro']},
  {'area': 'Malá Strana (Lesser Town)', 'for': ['Couples', 'Families', 'Quiet nights'], 'why': "Baroque streets under the castle, over Charles Bridge. Very quiet at night - embassies, no clubs - and a family with a toddler loved it in January. The catch is hills and cobbles, which are hard with a pushchair or in snow; choose a hotel near a tram stop.", 'creators': ['destinationwel', 'realpragueguid', 'nashtereza', 'walshystravels', 'viatravelers']},
  {'area': 'Nové Město (New Town)', 'for': ['Families', 'Good value', 'Transport'], 'why': "The best mid-range choice, 20-30% cheaper than the Old Town and a short walk from it, with metro and trams everywhere: about $55-100 a night (2026). Quieter pockets are around Charles Square, the Dancing House and the Powder Tower; avoid the hotels on Wenceslas Square itself, which stay loud late.", 'creators': ['theultimatetra', 'multicitytrips', 'destinationwel', 'realpragueguid', 'nashtereza']},
  {'area': 'Vinohrady', 'for': ['Families', 'Solo travellers', 'Local life'], 'why': "Leafy, residential and a few metro stops from the centre, with the locals' Christmas markets at Náměstí Míru and Jiřího z Poděbrad, parks and good cafés. Mostly apartments and guesthouses, about $45-120 a night (2025-26).", 'creators': ['thetravelersat', 'viatravelers', 'exoticvacation', 'theultimatetra', 'carolmax']},
  {'area': 'Holešovice', 'for': ['Families', 'Budget', 'Museums'], 'why': "A former industrial district five to ten minutes from the centre by tram, with Letná and Stromovka parks and the National Technical Museum for children. International trains from Berlin stop here.", 'creators': ['nashtereza', 'multicitytrips', 'viatravelers', 'realpragueguid']},
  {'area': 'Dejvice (Prague 6)', 'for': ['Quiet nights', 'Families', 'Early flights'], 'why': "Residential, calm and cheaper, on metro line A and handy for the airport bus. If you stay further out, creators say pick somewhere on the metro rather than relying on buses.", 'creators': ['nashtereza', 'realpragueguid']},
 ],
 'caution': [
  {'area': 'Astronomical Clock, Old Town Square and Charles Bridge', 'when': 'December afternoons, evenings and weekends', 'note': "The crowd hotspots, and where creators and the UK Foreign Office warn of pickpockets - also on tram 22 to the castle and on airport transport. Most phones and wallets go when they are left on café and restaurant tables. Keep bags zipped and in front, and agree a meeting point with children.", 'creators': ['realpragueguid', 'woltersworld', 'destinationwel', 'honestguide']},
  {'area': 'Trams and road crossings', 'when': 'Always', 'note': "Trams have right of way, often don't stop at crossings without lights and need several metres to brake. Local guides say this is the real physical danger in Prague. Hold children's hands at tram tracks, and don't dash across the six-lane road at the main station.", 'creators': ['honestguide', 'realpragueguid']},
  {'area': 'Wenceslas Square, Dlouhá Street and Anděl at night', 'when': 'Late evenings and weekends', 'note': "Clubs, drunk crowds and touts at the bottom of Wenceslas Square, where a local guide links some bars to overcharging and, rarely, spiked drinks; rowdy bars around Dlouhá; and crowds around Anděl station. Don't follow touts, check prices, and use an app taxi home.", 'creators': ['realpragueguid', 'destinationwel']},
  {'area': 'The park by the main station (Vrchlického sady)', 'when': 'After dark', 'note': "Creators say phones and wallets go missing here after dark, though it is cleaner than it was. Use the station's main entrances and the lifts rather than cutting through.", 'creators': ['realpragueguid']},
  {'area': 'Ticket inspections', 'when': 'Always', 'note': "No barriers, but plain-clothes inspectors check often, especially at the Petřín funicular. An unvalidated ticket counts as none: the fine is CZK 1,200 on the spot or CZK 1,500-2,000 later (2026). Activate app tickets before you board - there's no signal underground.", 'creators': ['realpragueguid', 'happytowandert', 'nashtereza', 'carolmax', 'honestguide']},
 ],
 'scams': [
  {'title': 'Street money-changers', 'text': "People outside exchange offices, by cash machines, at ticket machines (some in orange vests) and even at the airport bus stop offer a 'good rate' and hand over worthless foreign or old notes. Never change money on the street - pay by card.", 'creators': ['honestguide', 'realpragueguid', 'destinationwel']},
  {'title': "'0% commission' exchange offices", 'text': "Commission is banned by law, so the sign means nothing: the cost is in the rate. Creators saw 17 to 25 koruna per euro on the same street. You can cancel an exchange within 3 hours at the same office (Czech National Bank).", 'creators': ['honestguide', 'realpragueguid', 'woltersworld']},
  {'title': 'Cash machines and card terminals', 'text': "Avoid Euronet and other independent cash machines in the Old Town, and always choose koruna when a machine offers your home currency - one creator saw a €175 fee on a withdrawal.", 'creators': ['honestguide', 'carolmax', 'woltersworld']},
  {'title': 'Street taxis', 'text': "Taxis waiting at the main station, the airport rank and in the Old Town have overcharged - one hidden-camera ride cost 750 CZK against 231. Use Bolt, Uber or Liftago for an upfront price. The airport's own fare guide is about CZK 800 to the centre.", 'creators': ['honestguide', 'toughest', 'nashtereza', 'realpragueguid', 'carolmax']},
  {'title': 'Food sold by weight', 'text': "Prague ham and other market dishes are priced per 100 g and weighed after cutting - 300 g came to 387 CZK. Ask for a weight (say 150 g) and the total before they cut.", 'creators': ['realpragueguid', 'nevertwofull', 'nateandkatrina']},
  {'title': 'Tourist-trap restaurants', 'text': "Tented restaurants on the Old Town Square and some on Wenceslas Square charge about four times local prices, add 12-15% service, serve a 'large beer' as a litre, and charge for bread. Check the menu and the bill; a daily lunch menu a street away costs half.", 'creators': ['nashtereza', 'honestguide', 'woltersworld', 'realpragueguid']},
  {'title': 'Fake police', 'text': "The UK Foreign Office warns of fake plain-clothes police asking to see your money and passport. Real officers can't demand to see your cash - offer to go to a police station or call 112.", 'creators': []},
 ],
 'transport': [
  {'title': 'From the airport', 'text': "There's no metro to the airport. Take trolleybus 59 to Nádraží Veleslavín (metro A) or bus 100 to Zličín (metro B) on a 90-minute ticket - CZK 46 in the app (2026) - about 30-40 minutes to the centre. The Airport Express to the main station is CZK 200 and only every 30 minutes. Fixed taxi fares ended on 1 October 2026; the airport puts a typical trip at about CZK 800, and app rides showed CZK 450-550.", 'creators': ['honestguide', 'happytowandert', 'carolmax', 'corrtraveleuro', 'brogantate']},
  {'title': 'Tickets in 2026', 'text': "Tickets are by time, valid on metro, trams, buses and ferries: 30 minutes CZK 36, 90 minutes CZK 46, 24 hours CZK 140, 72 hours CZK 340 in the PID Lítačka app (paper costs a little more). Validate paper tickets once; activate app tickets before boarding. A big suitcase may need its own ticket.", 'creators': ['carolmax', 'happytowandert', 'likealocal', 'realpragueguid']},
  {'title': 'Children and grandparents ride free', 'text': "In Prague under-10s travel free, 10-15s free with proof of age, and over-65s free with ID - so a family usually needs only the adults' tickets.", 'creators': ['likealocal', 'creativetravel']},
  {'title': 'Trams and metro', 'text': "Trams are the easiest way round - tram 22 runs past the National Theatre and Malá Strana almost to the castle gate. Several lines share each stop, so check the number. Metro runs about 5am to midnight; night trams every 30 minutes after that. Lifts serve most but not all metro stations - check before you go with a pushchair.", 'creators': ['thetravelersat', 'abbyandlogantr', 'corrtraveleuro', 'chrisrodriguez']},
  {'title': 'Petřín funicular', 'text': "The funicular up Petřín hill reopened after renovation; it runs every 10 minutes and is free for under-15s and over-65s. Short PID tickets didn't cover it before the works - check your ticket, and validate once only: inspectors wait at the top.", 'creators': ['realpragueguid', 'honestguide']},
 ],
 'costs': costs,
 'top_intro': "Ranked by how often creators recommend them. Go early: Charles Bridge and the castle are packed by mid-morning in December, and the castle's visitor buildings close at 4-5pm in winter and all day on 24 December.",
 'top': [
  {'name': 'Charles Bridge', 'area': 'Staré Město / Malá Strana', 'why': "The 14th-century stone bridge lined with statues, with the castle above. In December it is chaotic by day and impassable on weekend evenings; creators go at sunrise or 7am. Before Christmas a lamplighter lights the gas lamps by hand around 4pm.", 'family': True, 'price': 'Free', 'url': maps('Karlův most'), 'creators': ['realpragueguid', 'kristinastrave', 'walshystravels', 'nateandkatrina', 'saragoeslocal', 'goneagain']},
  {'name': 'Prague Castle & St Vitus Cathedral', 'area': 'Hradčany', 'why': "The world's largest castle complex. The courtyards are free, with the changing of the guard at noon; the main circuit covers the cathedral, the Old Royal Palace and Golden Lane. Go before 9:30, buy on site rather than from resellers, and know the gardens are shut in winter and the buildings close on 24 December.", 'family': True, 'price': 'Grounds free · circuit CZK 450, child CZK 300, family CZK 950', 'url': 'https://www.hrad.cz', 'creators': ['nashtereza', 'realpragueguid', 'sharingtheroad', 'kristinastrave', 'jessellis', 'sheajordan', 'restynehavlogs']},
  {'name': 'Old Town Hall tower & Astronomical Clock', 'area': 'Old Town Square', 'why': "The medieval clock's apostles parade on the hour - it lasts under a minute, so stand facing it and don't plan your day round it. The tower has a lift and the best view of the market and tree; tickets were half price in the first hour of opening.", 'family': True, 'price': 'Tower CZK 350, child CZK 230 (2026)', 'url': 'https://prague.eu', 'creators': ['toucantravelle', 'jessellis', 'sheajordan', 'honestguide', 'happytowandert', 'postcardandapi']},
  {'name': 'Petřín hill', 'area': 'Malá Strana', 'why': "A green hill above the Lesser Town with a funicular, a mini Eiffel Tower of 299 steps, a mirror maze and gardens - a good escape from the crowds with tired children.", 'family': True, 'price': 'Tower CZK 250, child CZK 170 · funicular free for under-15s', 'url': 'https://prague.eu', 'creators': ['corrtraveleuro', 'noahtravelguid', 'creativetravel', 'martijnaroundt']},
  {'name': 'Vyšehrad', 'area': 'Vyšehrad', 'why': "The quieter castle: free to enter, with ramparts, river views, a famous cemetery and few tourists, reached by metro or tram.", 'family': True, 'price': 'Free', 'url': maps('Vyšehrad'), 'creators': ['toucantravelle', 'camdendavid', 'happytowandert', 'jenixtravelvlo']},
  {'name': 'Kampa, the Lennon Wall & Vojanovy sady', 'area': 'Malá Strana', 'why': "A small island park under Charles Bridge with David Černý's giant crawling babies, swans and river nutria (don't touch - they bite), the graffiti Lennon Wall nearby, and a free walled garden with peacocks.", 'family': True, 'price': 'Free', 'url': maps('Kampa'), 'creators': ['nashtereza', 'martijnaroundt', 'jumpingplaces', 'aniagregsadven', 'happytowandert']},
  {'name': 'Prague Zoo', 'area': 'Troja', 'why': "One of Europe's best zoos, with a chairlift and children's zoo. Short winter hours (9:00-16:00) and ticket offices close early on 24 December. Cheaper online.", 'family': True, 'price': 'Online CZK 300 adult, CZK 200 child, family CZK 850', 'url': 'https://www.zoopraha.cz', 'creators': ['noahtravelguid', 'realpragueguid']},
  {'name': 'National Technical Museum', 'area': 'Holešovice', 'why': "Trains, cars and planes in a huge hall - a creators' pick for children on a cold day, near Letná Park.", 'family': True, 'price': 'Check the site', 'url': 'https://www.ntm.cz', 'creators': ['nashtereza']},
  {'name': 'Jewish Quarter (Josefov)', 'area': 'Josefov', 'why': "Synagogues and the Old Jewish Cemetery on one combined ticket; they close early, so go in the early afternoon and allow a few hours.", 'family': False, 'price': 'About $16 combined (2025)', 'url': 'https://www.jewishmuseum.cz', 'creators': ['thetravelersat', 'creativetravel', 'exoticvacation']},
  {'name': 'Letná Park', 'area': 'Holešovice', 'why': "The best view of the bridges stepping down the river, with a beer garden (quieter in winter) and a giant metronome. Sunset favourite.", 'family': True, 'price': 'Free', 'url': maps('Letenské sady'), 'creators': ['birtahlin', 'vishakhandelwa', 'exoticvacation', 'realpragueguid']},
 ],
 'eat_label': 'Goulash, svíčková and Christmas carp',
 'eat_intro': "Czech food is hearty: goulash with bread dumplings, svíčková (beef in a creamy vegetable sauce with cranberries), roast pork knuckle, fried cheese, and open sandwiches (chlebíčky) at Christmas. The traditional Christmas Eve dinner is fried carp with potato salad. Trdelník is a tourist invention - try a koláč from a bakery instead. Most proper meals are under CZK 300; prices carry the year.",
 'eat': [
  {'name': 'Lokál', 'area': 'Staré Město & Malá Strana', 'type': 'Czech pub', 'price': '€€', 'family': True, 'why': "The pub group that revived Czech pub food, with tank Pilsner and classics like pork with dumplings at non-tourist prices; a toddler happily ate the beef broth.", 'creators': ['walshystravels', 'goneagain', 'maxnomad'], 'url': maps('Lokál Dlouhá')},
  {'name': 'Havelská Koruna', 'area': 'Staré Město', 'type': 'Self-service canteen', 'price': '€', 'family': True, 'why': "About 25 Czech dishes a day; a soup, main and salad came to just under €12 (2026). Queue for about 20 minutes at lunch.", 'creators': ['goprague', 'realpragueguid'], 'url': maps('Havelská Koruna')},
  {'name': 'Kantýna', 'area': 'Nové Město', 'type': 'Butcher canteen', 'price': '€€', 'family': True, 'why': "A self-service meat canteen in a former bank: you collect stamps on a card and pay on the way out. About CZK 750 for two (2025).", 'creators': ['kristinastrave'], 'url': maps('Kantýna Politických vězňů')},
  {'name': 'Česká kuchyně', 'area': 'Nové Město', 'type': 'Canteen', 'price': '€', 'family': True, 'why': "Old-school canteen popular with locals; arrive by 11:00-11:30 on weekdays before the queue.", 'creators': ['davemani', 'abroadandhungr'], 'url': maps('Česká kuchyně Praha')},
  {'name': 'Parašutista', 'area': 'Near the Dancing House', 'type': 'Czech', 'price': '€€', 'family': True, 'why': "Affordable traditional food in big portions.", 'creators': ['saragoeslocal'], 'url': maps('Parašutista restaurace')},
  {'name': 'U Dvou slunců', 'area': 'Nerudova, below the castle', 'type': 'Czech', 'price': '€€', 'family': True, 'why': "Roast duck with dumplings and cabbage, or fried cheese, on the climb to the castle - under CZK 300 a meal (2022).", 'creators': ['realpragueguid'], 'url': maps('U Dvou slunců')},
  {'name': 'Mlýnec', 'area': 'By Charles Bridge', 'type': 'Fine dining', 'price': '€€€€', 'family': False, 'why': "Michelin-recommended with excellent service; lunch for two was under €80 (2026), more in the evening.", 'creators': ['realpragueguid'], 'url': maps('Mlýnec')},
  {'name': 'Bistro u Býka', 'area': 'By the Powder Tower', 'type': 'Butcher bistro', 'price': '€', 'family': True, 'why': "A Czech hot dog (párek v rohlíku) for CZK 69 (2025) - the budget lunch in the centre.", 'creators': ['realpragueguid'], 'url': maps('Bistro u Býka')},
  {'name': 'Cukrář Skála', 'area': 'Nové Město', 'type': 'Cake shop', 'price': '€', 'family': True, 'why': "Retro Czech cakes such as větrník and indiánek - local guides call them the best in town.", 'creators': ['realpragueguid'], 'url': maps('Cukrář Skála')},
  {'name': 'Manifesto Market', 'area': 'Smíchov', 'type': 'Food hall', 'price': '€€', 'family': True, 'why': "Food from around the world under one roof - good when the family can't agree. Card only.", 'creators': ['happytowandert', 'realpragueguid', 'martijnaroundt'], 'url': maps('Manifesto Market Anděl')},
 ],
 'grown_ups': "For a grown-ups' evening: a hot honey wine (medovina) or svařák at a local market, a half-litre of Pilsner in a Lokál pub, or last-minute opera tickets at the National Theatre - The Nutcracker sells out months ahead. Organised pub crawls are banned, and drinking in the street is illegal in much of the centre despite how it looks. Avoid touts at the bottom of Wenceslas Square. The drinking age is 18.",
 'hotels': [
  {'name': 'Augustine, a Luxury Collection Hotel', 'area': 'Malá Strana', 'for': 'Luxury with children', 'band': '€€€€', 'why': "A 13th-century monastery on a quiet street a short walk from Charles Bridge. A family stayed three nights with a two-year-old in January and loved the breakfast and the calm (2026).", 'url': book('Augustine Prague'), 'source': 'walshystravels'},
  {'name': 'Hotel Cube Prague', 'area': 'Nové Město', 'for': 'Families', 'band': '€€€', 'why': "Modern hotel on a quiet street with spacious rooms, 10 minutes' walk to the Old Town; about $130-170 a night (2025).", 'url': book('Hotel Cube Prague'), 'source': 'lovehardtravel'},
  {'name': 'Pytloun Garden Hotel', 'area': 'Kampa, Malá Strana', 'for': 'Couples', 'band': '€€€', 'why': "Quiet hotel on Kampa island with river or castle views, steps from Charles Bridge; about $130-170 a night (2025).", 'url': book('Pytloun Garden Hotel'), 'source': 'lovehardtravel'},
  {'name': 'Hotel Residence Agnes', 'area': 'Staré Město', 'for': 'Close to the markets', 'band': '€€€', 'why': "Boutique hotel with attentive service on a calmer Old Town street, walking distance to the Astronomical Clock; from about $150 a night (2026).", 'url': book('Hotel Residence Agnes'), 'source': 'happytravelcor'},
  {'name': 'Mosaic House Design Hotel', 'area': 'Nové Město, by the National Theatre', 'for': 'Solo travellers', 'band': '€€', 'why': "Eco design hotel a block from the tram; a solo traveller found the staff friendly and the rooms simple but comfortable; about $100-140 a night (2025).", 'url': book('Mosaic House Prague'), 'source': 'chelseazeferin'},
  {'name': 'Mama Shelter Prague', 'area': 'Holešovice', 'for': 'Good value', 'band': '€€', 'why': "Fun modern hotel with a direct tram into the centre in about 15 minutes; about $80-110 a night (2025).", 'url': book('Mama Shelter Prague'), 'source': 'lovehardtravel'},
 ],
 'itinerary': {
  '1day': [
   ['07:30', 'Charles Bridge before the crowds', 'Then up through Malá Strana, or tram 22 to the castle.'],
   ['09:00', 'Prague Castle', 'Free courtyards, St Vitus and the noon changing of the guard.'],
   ['12:30', 'Lunch', 'Lokál or a canteen - book or arrive early.'],
   ['14:00', 'Old Town Hall tower', 'Views over the market, then the clock on the hour.'],
   ['15:30', 'Charles Bridge lamplighter', 'Around 4pm in the weeks before Christmas.'],
   ['16:30', 'Old Town Square tree', 'The light show every hour after dark; eat at the stalls or a side street.'],
   ['18:30', 'Wenceslas Square or Náměstí Míru', 'More space, cheaper mulled wine - take the metro to Náměstí Míru.'],
  ],
  '3day': [
   ['Day 1 · Old Town', 'Astronomical Clock and tower early.', 'Jewish Quarter and the Old Town markets.', 'Tree light show and Wenceslas Square market.'],
   ['Day 2 · Castle & Lesser Town', 'Charles Bridge at sunrise, then the castle.', 'Kampa, the peacock garden and Petřín.', 'Dinner in Malá Strana.'],
   ['Day 3 · Like a local', 'Vyšehrad or the zoo.', 'Letná Park and the National Technical Museum.', 'Náměstí Míru and Jiřího z Poděbrad markets in Vinohrady.'],
  ],
 },
 'tips': [
  {'title': 'Pay by card, in koruna', 'text': "Cards work almost everywhere. Always choose koruna when asked, avoid Euronet machines, and never change money on the street. Keep a few coins for toilets and the smaller markets, some of which are cash only."},
  {'title': 'Go early, and on weekdays', 'text': "December is high season. Charles Bridge, the clock and the castle are calm at 7-8am and packed by mid-morning; the Old Town market is easier on a weeknight than at the weekend."},
  {'title': 'Use an app taxi', 'text': "Bolt, Uber or Liftago show the price up front. Avoid street taxis at the main station, the airport rank and in the Old Town."},
  {'title': 'Ask the weight before they cut', 'text': "Ham and other market food is sold per 100 g. Ask for a weight and the total, and check restaurant bills for service charges and extras."},
  {'title': 'Book dinners and concerts', 'text': "Restaurants fill in December - book three or four days ahead - and The Nutcracker and other Christmas shows sell out months in advance. Buy from the venue's own site."},
  {'title': '24 to 26 December', 'text': "Large shops close at noon on 24 December and all day on 25 and 26 December, and many restaurants and sights close too; the castle buildings are shut on the 24th. The Old Town and Wenceslas Square markets stay open with shorter hours. Stock up by the 23rd if you're in an apartment."},
 ],
 'tips_intro': "Every tip here was checked against an official or trusted source (Prague public transport, the airport, the Czech National Bank, Prague City Tourism, gov.uk and others) on the date shown. Rules and prices change, so tap the link to double-check before you travel.",
 'christmas': {
  'intro': "Prague's two big Christmas markets, on the Old Town Square and Wenceslas Square, open on Saturday 28 November 2026 and run to 6 January 2027. They are pretty, food-heavy and very crowded, and both are run by the same company. The smaller markets in local squares - Náměstí Míru, Republic Square, Tylovo náměstí - are cheaper, more local and mostly close on 24 December. Prague also does the Christmas traditions well: a lamplighter on Charles Bridge, carol singers on church steps and fried carp on Christmas Eve.",
  'markets': [
   {'name': 'Old Town Square (Staroměstské náměstí)', 'area': 'Staré Město', 'when': '28 Nov 2026 - 6 Jan 2027 · 10:00-22:00', 'why': "The famous one, framed by the Týn Church and the Astronomical Clock, with a big real tree that lights up to music every hour from 16:30 to 21:30, a stage, a raised viewing walkway and children's craft workshops at weekends (latest year). Almost all food and drink: sausages, Prague ham, potato pancakes, garlic-cheese dumplings, honey wine. Stalls take cards.", 'family': True, 'price': 'Free entry · mulled wine about CZK 100, sausage CZK 160 (2024-25)', 'crowds': "The most crowded market - creators found it hard to move on opening weekend and on Saturdays. Go on a weeknight or by day, or watch the tree from a restaurant at the edge of the square.", 'creators': ['davemani', 'prowalktours', 'heresgood', 'postcardandapi', 'abbyandlogantr', 'realpragueguid', 'nateandkatrina', 'brniceachillet', 'jumpingplaces'], 'url': 'https://trhypraha.cz'},
   {'name': 'Wenceslas Square (Václavské náměstí)', 'area': 'Nové Město', 'when': '28 Nov 2026 - 6 Jan 2027 · 10:00-22:00', 'why': "Five to eight minutes from the Old Town, along the lower end of the boulevard towards Můstek (tram works have shortened it), with a big tree, an ice rink and more room to walk. Food-focused: corn and Pilsner, potato pancakes, chimney cakes.", 'family': True, 'price': 'Free entry · potato pancake CZK 130 (2025)', 'crowds': 'Busy but more laid-back than the Old Town, with shorter queues. The paving gets icy at night.', 'creators': ['heresgood', 'nateandkatrina', 'postcardandapi', 'nevertwofull', 'nashtereza', 'realpragueguid', 'brniceachillet'], 'url': 'https://trhypraha.cz'},
   {'name': 'Náměstí Míru', 'area': 'Vinohrady', 'when': '20 Nov - 24 Dec 2026 · closes after lunch on 24 Dec', 'why': "The locals' favourite, in front of St Ludmila church: trees decorated by schools, traditional Czech Christmas biscuits, handmade gifts, langoš, and carol singers on the church steps in the evening. Two metro stops from the centre on line A.", 'family': True, 'price': 'Free entry · mulled wine about CZK 80 (2024) · some stalls cash only', 'crowds': 'Busy after work, but mostly locals.', 'creators': ['realpragueguid', 'postcardandapi', 'nevertwofull', 'nashtereza', 'brniceachillet', 'tohltime'], 'url': 'https://prague.eu'},
   {'name': 'Republic Square (Náměstí Republiky)', 'area': 'Nové Město', 'when': '25 Nov - 24 Dec 2026', 'why': "Two small markets of about 20 stalls each, by the Palladium shopping centre and the Municipal House, five minutes from the Old Town. Street-food-heavy and cheaper: mulled wine about CZK 60-65, goulash in a bread bowl.", 'family': True, 'price': 'Free entry', 'crowds': 'Calmer than the big two.', 'creators': ['thetravelingza', 'realpragueguid', 'postcardandapi', 'wonderjourneys', 'nashtereza'], 'url': 'https://prague.eu'},
   {'name': 'Tylovo náměstí', 'area': 'Vinohrady / Nové Město', 'when': '26 Nov - 24 Dec 2026', 'why': "A small, overlooked market with good prices on Christmas biscuits - a quick hot-drink stop near I. P. Pavlova.", 'family': True, 'price': 'Free entry', 'crowds': 'Quiet.', 'creators': ['realpragueguid', 'saragoeslocal'], 'url': 'https://prague.eu'},
   {'name': 'Jiřího z Poděbrad', 'area': 'Vinohrady / Žižkov', 'when': 'Usually late November to just before Christmas (2026 dates not yet published)', 'why': "A small, relaxed market under the striking church, with pastries, gifts and cheap mulled wine, plus the regular farmers' market.", 'family': True, 'price': 'Free entry', 'crowds': 'Local and relaxed.', 'creators': ['realpragueguid', 'nashtereza'], 'url': 'https://prague.eu'},
   {'name': 'Na Kampě & Malá Strana', 'area': 'Malá Strana', 'when': 'December (2026 dates not yet published)', 'why': "A tiny food-only market down the steps at the end of Charles Bridge, with a small tree, a wooden nativity, more seating and lots of non-alcoholic drinks. Paper cups, no mugs.", 'family': True, 'price': 'Free entry', 'crowds': 'Quiet - a rest from the bridge.', 'creators': ['thetravelingza', 'brniceachillet', 'tohltime'], 'url': 'https://prague.eu'},
   {'name': 'Havelské tržiště & Mariánské náměstí', 'area': 'Staré Město', 'when': 'Daily, with Christmas stalls in December', 'why': "The year-round street market between the Old Town and Wenceslas Square adds ornaments, gingerbread and mulled wine at about half the big-market price (CZK 65 in 2024), and a small craft market sits at Mariánské náměstí by the Klementinum.", 'family': True, 'price': 'Free entry', 'crowds': 'Much less crowded than the square five minutes away.', 'creators': ['tohltime', 'thetravelingza', 'brniceachillet'], 'url': 'https://prague.eu'},
   {'name': 'Anděl', 'area': 'Smíchov', 'when': 'December (2026 dates not yet published)', 'why': "A lively, hectic local market with live music and lots of meat, by the Anděl shopping area. No tree. Trams 10 or 16, or metro B.", 'family': False, 'price': 'Free entry', 'crowds': 'Busy with locals after work; the area gets rowdy late.', 'creators': ['realpragueguid'], 'url': 'https://prague.eu'},
  ],
  'sights': [
   {'name': 'The Charles Bridge lamplighter', 'area': 'Charles Bridge', 'when': 'Daily in December to 23 Dec, around 4pm (creators, 2024-25)', 'why': "A costumed lamplighter lights the bridge's gas lamps one by one at dusk. Big crowds gather, so arrive a little early - and check your tram number so you don't miss it.", 'family': True, 'price': 'Free', 'crowds': 'Crowded at dusk.', 'creators': ['saragoeslocal', 'nashtereza', 'jenixtravelvlo', 'nateandkatrina', 'abbyandlogantr'], 'url': 'https://prague.eu'},
   {'name': 'Advent at Prague Castle', 'area': 'Hradčany', 'when': 'Late November to early January (2025 programme; 2026 not yet published)', 'why': "A tree by St Vitus and an Advent programme with special openings. Creators say the castle has had no proper Christmas market in recent years. The buildings close on 24 December.", 'family': True, 'price': 'Grounds free', 'crowds': 'Very busy; long queues at Golden Lane.', 'creators': ['nateandkatrina', 'postcardandapi', 'nashtereza'], 'url': 'https://www.hrad.cz'},
   {'name': 'Ice skating', 'area': 'Wenceslas Square & the riverbank', 'when': 'Wenceslas Square rink 1 Dec - 15 Feb (2025/26)', 'why': "A rink on Wenceslas Square and others around the city, including one on a boat at Náplavka by the Dancing House (about €6 plus €6 skate hire in 2024). Helpers are on hand for beginners at some rinks.", 'family': True, 'price': 'About CZK 200 for 2 hours (2023)', 'crowds': 'Busiest at weekends.', 'creators': ['nashtereza', 'realpragueguid', 'jumpingplaces'], 'url': 'https://prague.eu/en/akce/skating-rink-wenceslas-square'},
   {'name': "New Year's Eve", 'area': 'Old Town & the river', 'when': '31 Dec 2026', 'why': "There is no official city fireworks display, and fireworks are banned in the historic centre, near the river and in parks (on-the-spot fines up to CZK 10,000) - but people set them off anyway around Wenceslas Square, the Old Town Square and Charles Bridge. With young children, see the new year in from a hotel or restaurant.", 'family': False, 'price': 'Free', 'crowds': 'Very crowded around midnight; the walkway in the Old Town Square closes 22:00-09:00.', 'creators': ['jenixtravelvlo', 'sharingtheroad'], 'url': 'https://prague.eu'},
  ],
  'safety': [
   {'title': 'Crowds and timing', 'text': "December is Prague's busiest month - over 600,000 visitors, creators say. The Old Town market fills up towards the weekend; weeknights and daytimes are calmer, and the smaller squares stay manageable all month.", 'creators': ['prowalktours', 'heresgood', 'postcardandapi', 'davemani']},
   {'title': 'Police and barriers', 'text': "Police step up uniformed and armed patrols at the markets every Advent, and concrete barriers protect the Old Town, Wenceslas Square and Republic Square markets (2024, latest year published). The UK Foreign Office says terrorist attacks in Czechia can't be ruled out.", 'creators': []},
   {'title': 'Pickpockets', 'text': "Watch bags in the queues and on the viewing walkway, at the clock on the hour, and on tram 22. Don't leave phones on café tables. Report a theft at a police station within 24 hours for insurance - the one at Jungmannovo náměstí 9 is open 24 hours with interpreters.", 'creators': ['realpragueguid', 'honestguide', 'woltersworld']},
   {'title': 'Prices and payment', 'text': "Mulled wine was about CZK 100 at the big markets and CZK 60-80 at the smaller ones (2024-25); sweet waffles about CZK 120-180. The big markets take cards; Náměstí Míru stalls were cash only. Food is often priced per 100 g.", 'creators': ['heresgood', 'thetravelingza', 'realpragueguid', 'tohltime']},
   {'title': 'Have a lost-child plan', 'text': "Agree a meeting point everyone can find - the tree on the Old Town Square or the statue of St Wenceslas at the top of the square. A Wiley Fox QR wristband on each child means anyone who finds them can reach you straight away.", 'creators': []},
   {'title': 'Cold, dark and icy', 'text': "Highs around 4°C, nights below freezing, dark by 4:30pm, and slippery cobbles. Waterproof boots with grip, gloves and a hat; plan sights for the morning.", 'creators': ['nashtereza', 'letsgotravelti', 'chrisrodriguez']},
  ],
  'plan': "In 2026 the Náměstí Míru market opens on 20 November and the Old Town and Wenceslas Square markets on Saturday 28 November, running to 6 January 2027 (10:00-22:00). The smaller markets close on 24 December. Large shops close at noon on 24 December and all day on 25 and 26 December, the castle buildings are shut on 24 December, and public transport runs a reduced holiday timetable. Book hotels, restaurants and concerts early.",
 },
 'map_intro': "Czechia doesn't publish street-level crime data, so this map shows the markets and sights in this guide, the busiest crowd spots and the places creators and police name.",
 'map_pins': [
  {'n': 'Old Town Square market', 'lat': 50.0875, 'lng': 14.4213, 'kind': 'market', 'note': '28 Nov - 6 Jan; tree show hourly from 16:30.'},
  {'n': 'Wenceslas Square market', 'lat': 50.0829, 'lng': 14.4254, 'kind': 'market', 'note': 'More room; ice rink.'},
  {'n': 'Náměstí Míru', 'lat': 50.0753, 'lng': 14.4391, 'kind': 'market', 'note': "Locals' favourite, from 20 Nov."},
  {'n': 'Republic Square', 'lat': 50.0888, 'lng': 14.4306, 'kind': 'market', 'note': 'Two small, cheaper markets.'},
  {'n': 'Tylovo náměstí', 'lat': 50.0747, 'lng': 14.4324, 'kind': 'market', 'note': 'Small and quiet.'},
  {'n': 'Jiřího z Poděbrad', 'lat': 50.0780, 'lng': 14.4503, 'kind': 'market', 'note': 'Relaxed local market.'},
  {'n': 'Na Kampě', 'lat': 50.0856, 'lng': 14.4086, 'kind': 'market', 'note': 'Tiny food market under Charles Bridge.'},
  {'n': 'Havelské tržiště', 'lat': 50.0848, 'lng': 14.4209, 'kind': 'market', 'note': 'Year-round market; cheaper mulled wine.'},
  {'n': 'Anděl', 'lat': 50.0702, 'lng': 14.4039, 'kind': 'market', 'note': 'Lively local market.'},
  {'n': 'Charles Bridge', 'lat': 50.0865, 'lng': 14.4114, 'kind': 'sight', 'note': 'Lamplighter around 4pm before Christmas.'},
  {'n': 'Prague Castle & St Vitus', 'lat': 50.0909, 'lng': 14.4006, 'kind': 'sight', 'note': 'Grounds free; buildings shut 24 Dec.'},
  {'n': 'Old Town Hall tower', 'lat': 50.0870, 'lng': 14.4207, 'kind': 'sight', 'note': 'Lift; best view of the tree.'},
  {'n': 'Petřín funicular (Újezd)', 'lat': 50.0810, 'lng': 14.4049, 'kind': 'sight', 'note': 'Free for under-15s.'},
  {'n': 'Petřín tower', 'lat': 50.0835, 'lng': 14.3951, 'kind': 'sight', 'note': '299 steps; mirror maze nearby.'},
  {'n': 'Vyšehrad', 'lat': 50.0642, 'lng': 14.4194, 'kind': 'sight', 'note': 'The quieter castle.'},
  {'n': 'Prague Zoo', 'lat': 50.1166, 'lng': 14.4058, 'kind': 'sight', 'note': 'Winter 9:00-16:00.'},
  {'n': 'National Technical Museum', 'lat': 50.0976, 'lng': 14.4248, 'kind': 'sight', 'note': 'Trains and planes for children.'},
  {'n': 'Nádraží Veleslavín (airport bus 59)', 'lat': 50.0959, 'lng': 14.3485, 'kind': 'sight', 'note': 'Change to metro A.'},
  {'n': 'Astronomical Clock crowds', 'lat': 50.0869, 'lng': 14.4204, 'kind': 'caution', 'note': 'Pickpockets on the hour.'},
  {'n': 'Karlova Street', 'lat': 50.0863, 'lng': 14.4190, 'kind': 'caution', 'note': 'Street money-changers by exchange offices.'},
  {'n': 'Bottom of Wenceslas Square at night', 'lat': 50.0840, 'lng': 14.4240, 'kind': 'caution', 'note': 'Bar touts; check prices.'},
  {'n': 'Vrchlického sady (main station park)', 'lat': 50.0836, 'lng': 14.4333, 'kind': 'caution', 'note': 'Thefts after dark; taxis here overcharge.'},
  {'n': 'Dlouhá Street', 'lat': 50.0897, 'lng': 14.4233, 'kind': 'caution', 'note': 'Party street; rowdy at night.'},
 ],
 'map': {'center': [14.418, 50.084], 'zoom': 13.6},
 'compare': {
  'title': 'How Prague compares with the rest of Czechia',
  'intro': "Crimes registered by police in 2025 per 100,000 residents. Prague is both a city and a region; the other rows are regions, so they include Brno, Ostrava and Plzeň plus the countryside around them. Prague's overall rate is the highest in the country - mostly property crime, and inflated by visitors who are counted as victims but not as residents - while its violent-crime rate is close to the national average.",
  'cols': ['All registered crime', 'Violent crime', 'Robbery'], 'unit': 'per 100,000 residents, 2025',
  'rows': [
   {'name': 'South Moravia (incl. Brno)', 'vals': [1443, 112, 11.3], 'me': False},
   {'name': 'Plzeň region', 'vals': [1512, 121, 12.4], 'me': False},
   {'name': 'Moravia-Silesia (incl. Ostrava)', 'vals': [1803, 150, 18.6], 'me': False},
   {'name': 'Prague', 'vals': [2492, 115, 14.6], 'me': True},
   {'name': 'Czechia average', 'vals': [1561, 126, 12.3], 'avg': True},
  ],
  'note': "All-crime rates are the Czech Statistical Office's own; violent crime and robbery rates are Wiley Fox's calculations from the office's counts and its population base. Czech law treats many small thefts as minor offences rather than crimes, so these rates are not comparable with other countries' figures.",
  'source': {'name': 'Czech Statistical Office - Kriminalita 2015-2025 (Police ČR data)', 'url': 'https://csu.gov.cz/aktualni-produkt/392026'}},
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
