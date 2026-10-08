# Builds stra/guide.json for the Vienna Christmas 2026 guide from researched content + creator DB export.
import json, re, collections, urllib.parse
D = '/home/claude/cityguide/vie'
api = json.load(open(f'{D}/api.json'))
tips = json.load(open(f'{D}/tips.json'))['tips']
costs = json.load(open(f'{D}/costs.json'))
key = lambda n: re.sub(r'[^a-z0-9]', '', n.lower())[:14]
maps = lambda q: 'https://www.google.com/maps/search/?api=1&query=' + urllib.parse.quote(q + " Wien")
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__)))); import affiliate
book = lambda q: affiliate.wrap('https://www.booking.com/searchresults.html?ss=' + urllib.parse.quote(q + " Wien"), "Vienna")

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

# Research tips that carry no usable advice are dropped (they only say a price or rule could not be found).
DROP = ('Where can I buy Käsekrainer', 'Can I smoke at the markets', 'Do tram ticket machines take cards')
tips = [t for t in tips if not t['worry'].startswith(DROP)]

G = {
 'city': 'Vienna', 'slug': 'vienna', 'country': 'Austria', 'edition': 'Christmas 2026 edition', 'updated': '2026-10-08',
 'status': "Draft for Barry's approval", 'audience': 'Families and solo travellers',
 'tagline': 'The Wiley Fox guide to Vienna for families and solo travellers',
 'cover_blurb': f"What {NC} travel creators actually say about Vienna at Christmas, checked against Austria's 2025 police figures - more than 20 Advent markets, which ones suit children, where to stay, what to eat, and the 2026 transport changes that catch visitors out.",
 'banner_text': 'Official travel advice for 200+ countries, community reports, one-tap SOS, and QR wristbands so lost children and lost bags find their way back.',
 'safety': {
  'wf_rating': 4, 'wf_label': 'Low',
  'wf_summary': "Vienna is one of Europe's calmer capitals, and creators - solo women and families included - felt safe day and night. The risk visitors are most likely to meet is theft in crowds. Austrian police recorded 5,448 pickpocketing and trick-theft cases in Vienna in 2025, down 8% on 2024: about 267 per 100,000 residents, compared with about 99 for Austria as a whole, and Vienna has six in ten of the country's cases. All reported crime was about 9,530 per 100,000 residents, flat on 2024 - above Munich (5,798) and well below Berlin (13,642), though Austria and Germany count slightly differently. Rates are per resident and do not count the millions of visitors. A few small areas have weapon-ban zones because of drug-related trouble - Praterstern, around Reumannplatz in Favoriten and Yppenplatz - none of them on the usual market route. The UK Foreign Office says terrorists are likely to try to attack in Austria and that police presence is higher; four people were killed in a shooting in central Vienna in November 2020. This rating is for the city as a whole: Austria does not publish street-level crime data.",
  'creator_feeling': 5, 'creator_feeling_label': 'Very safe and calm - crowded at the big markets',
  'creator_summary': "Creators call Vienna one of the safest cities they have visited. Expats who walk home alone late at night say they have always felt safe and see plenty of police, and families found it easy with children. The complaints are crowds at Rathausplatz and Stephansplatz on weekend evenings - one called the Rathausplatz market a public-health hazard on a Saturday - cash-only stalls, costumed sellers pushing overpriced concerts, steep fines on public transport, and a few places that feel rougher after dark: Praterstern, and Reumannplatz and Keplerplatz in Favoriten.",
  'data_note': "Figures are from the Bundeskriminalamt (Austria's federal criminal police office) report on offences reported to police in 2025, published on 31 March 2026. Vienna is both a city and a federal state, so these are city figures. Rates per 100,000 are Wiley Fox's calculations using Statistik Austria's provisional population for 1 January 2026 (Vienna 2,042,036). 2025 in Vienna: all reported offences 194,625 (-0.2%), pickpocketing and trick theft 5,448 (-7.8%), robbery 1,369 (-1.8%), violent offences 31,430 (+1.4%, a broad category that includes domestic violence). The report does not give Vienna figures for assault on its own or for home burglary, and Austria publishes no district or street-level crime data, so this guide's map shows the markets, sights and the police zones named in official orders. On New Year's Eve 2025/26 about 550,000 people joined the Silvesterpfad; organisers closed the area shortly before midnight because it was full, and police reported no notable incidents.",
  'data_months': ['2025-12', '2025-01'],
 },
 'official_crime': [
  {'number': '-8%', 'label': 'Pickpocketing and trick theft (2025)', 'desc': '5,448 cases in Vienna, about 267 per 100,000 residents; Austria about 99. Falling since 2016 (Bundeskriminalamt).'},
  {'number': '9,530', 'label': 'All reported offences per 100,000 residents (2025)', 'desc': 'Flat on 2024. Munich 5,798, Berlin 13,642 (own reports); counting rules differ slightly.'},
  {'number': '550,000', 'label': "People at the 2025 New Year's Eve trail", 'desc': 'Police reported no notable incidents; the area was closed shortly before midnight when full (City of Vienna).'},
 ],
 'crime_source': {'name': 'Bundeskriminalamt - Kriminalpolizeiliche Anzeigenstatistik 2025', 'citation': "Federal criminal police report on offences reported in 2025 (published 31 March 2026), Statistik Austria provisional population 1 January 2026, Landespolizeidirektion Wien weapon-ban orders (2026), Interior Ministry and police statements on the Advent markets (November 2025), press reports of the New Year's Eve 2025/26 trail, and FCDO Austria advice (11 August 2026). Rates are per resident, not adjusted for visitors; no street-level data is published."},
 'credit_fallback': 'Source: Austrian police / official sources',
 'app_ctas': [
  {'where': 'before_booking', 'text': "Austria doesn't publish street-level crime data, so before you book, check your hotel's street on the Wiley Fox map and in community reports - especially if a deal is near Praterstern, Westbahnhof or Reumannplatz.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'families', 'text': 'Clip a Wiley Fox QR wristband on each child. If you get separated in the crowd at Rathausplatz or on the U-Bahn, anyone who scans it can contact you straight away - no app needed on their side.', 'url': 'https://www.thewileyfox.com'},
  {'where': 'night', 'text': "Most markets close at 9 or 10pm and the U-Bahn runs all night at weekends. Save your hotel on Wiley Fox and keep SOS one tap away on the way back.", 'url': 'https://www.thewileyfox.com'},
  {'where': 'community', 'text': 'Found a cash-only stall, a lift out of order or a street that felt wrong? Drop a community report on the map - it helps the next family.', 'url': 'https://www.thewileyfox.com'},
 ],
 'stats': [
  {'number': '13 Nov', 'label': 'Rathausplatz market opens', 'desc': 'To 26 December 2026, 10:00-22:00 (24 Dec to 18:30). Schönbrunn and Stephansplatz open on 6 November.'},
  {'number': '20+', 'label': 'Official Advent markets', 'desc': 'Most close on 23 December; Schönbrunn and the Prater winter market run to 6 January 2027.'},
  {'number': str(NC), 'label': f'Creators · {NV} videos', 'desc': 'Paraphrased and credited, cross-checked with official sources.'},
 ],
 'overview': [
  "Vienna's historic centre, the Innere Stadt (1st district), sits inside the Ringstraße, the grand boulevard that replaced the city walls. Inside or on the Ring are St Stephen's Cathedral, the Hofburg palace, the State Opera, the City Hall and the big museums; Schönbrunn Palace, the Belvedere and the Prater amusement park are a short U-Bahn or tram ride out. The city is flat, clean and easy on public transport, and the 23 districts are numbered, which makes addresses simple. Creators suggest three or four days.",
  "At Christmas Vienna has more than 20 official Advent markets, each with its own character. The Christkindlmarkt in front of the City Hall is the famous one, with an ice-skating trail through the trees and a children's world in the park; Schönbrunn is the family favourite; Art Advent at Karlsplatz has a hay pit, farm animals and a hand-turned carousel; Spittelberg, Am Hof and Freyung are where locals go. The shopping streets are hung with giant chandeliers, and coffee houses, cake and Christmas concerts fill the gaps between markets.",
  "For solo travellers Vienna feels safe and relaxed, and transport runs all night at weekends. Plan for heavy crowds at the big markets on weekend evenings, stalls that want cash, shops closed on Sundays and on 25 and 26 December, cold, grey weather, and 2026 changes to tickets and airport trains (see Getting around).",
 ],
 'facts': {
  'Currency': 'Euro (EUR) - cards work in most shops, but many market stalls, cafés and toilets want cash or coins; avoid Euronet cash machines, which charge high fees',
  'Language': 'German (Austrian) - English is widely spoken in the centre',
  'Time zone': 'Central European Time (UTC+1) - one hour ahead of the UK',
  'Plug': 'Type C and F, 230V - UK plugs need an adaptor',
  'Emergency': '112 all services · 133 police · 144 ambulance · 122 fire',
  'Entry': 'UK passport issued less than 10 years before arrival and valid 3+ months after you leave the Schengen area; up to 90 days in any 180. EES fingerprint and photo checks at the border since October 2025 (gov.uk)',
  'Tipping': "About 5-10%, by rounding up: tell the waiter the total you want to pay rather than leaving coins on the table",
  'Best time': 'The Advent markets from mid-November, on weekday afternoons; most close on 23 December',
 },
 'stay': [
  {'area': 'Innere Stadt (1st district)', 'for': ['First-timers', 'Christmas markets', 'Walking'], 'why': "Inside the Ring, walkable to the cathedral, Hofburg, Opera and five of the markets, so you can drop back to the hotel between them. Creators found it safe and convenient but the priciest area: doubles about €200-300 a night against €120-150 a few districts out (2024).", 'creators': ['traveltipsgrou', 'alpgaliptravel', 'khyatipuria', 'tripxtreme', 'theultimatetra']},
  {'area': 'Neubau & Spittelberg (7th)', 'for': ['Couples', 'Solo travellers', 'Food'], 'why': "The creative district behind the MuseumsQuartier, with independent shops, cafés and the cobbled lanes of the Spittelberg market. Cheaper than the 1st district, with the U2 and U3 and a short walk to Maria-Theresien-Platz.", 'creators': ['traveltipsgrou', 'tripxtreme', 'khyatipuria', 'exoticvacation']},
  {'area': 'Josefstadt & Alsergrund (8th and 9th)', 'for': ['Quiet nights', 'Families', 'Coffee houses'], 'why': "Calm, elegant streets about ten minutes' walk from the centre, with traditional coffee houses and the student Christmas market in the Altes AKH courtyard.", 'creators': ['khyatipuria', 'cityzen']},
  {'area': 'Leopoldstadt (2nd)', 'for': ['Families', 'Budget', 'Parks'], 'why': "Ranked the best family district by one couple who live there: the Prater, the Augarten and the Riesenrad winter market, with the U1 and U2. Mid-range hotels about $150-220 a night (2026). Most of it is green and quiet, but the small zone around Praterstern station feels rougher at night and is a police weapon-ban zone - pick a hotel away from the station square.", 'creators': ['khyatipuria', 'cityzen', 'tripxtreme', 'theultimatetra', 'thetravelersat']},
  {'area': 'Wieden & Landstraße (4th and 3rd)', 'for': ['Good value', 'Arriving by train', 'Families'], 'why': "Just south and east of the Ring: Karlsplatz, the Belvedere and the Hauptbahnhof, with mid-range hotels about $120-180 a night near the station (2026). Quiet and residential, and the Belvedere gardens are free to walk.", 'creators': ['seniortravelwo', 'thetravelersat', 'theultimatetra', 'cityzen']},
  {'area': 'Near any U-Bahn station further out', 'for': ['Budget', 'Long stays'], 'why': "Hotels near a U-Bahn station a few stops out were about €100-130 a night and 15-20 minutes from the centre (2024). Check for station works before you book: some lifts and the central S-Bahn are closed this winter.", 'creators': ['khyatipuria', 'travelingbutle', 'creativetravel']},
 ],
 'caution': [
  {'area': 'Rathausplatz, Stephansplatz and the Graben', 'when': 'Weekend afternoons and evenings', 'note': "The most crowded places in the city at Christmas. Police warned in November 2025 that Advent is the high season for pickpockets, especially in crowds, at stalls and in queues, using bumping, spilt drinks and cards or flyers as distractions. Keep bags zipped and in front, carry little cash, and agree a meeting point with children.", 'creators': ['pursuingmounta', 'khyatipuria', 'sophienadeau', 'happytowander']},
  {'area': 'Praterstern station square', 'when': 'Evenings and night', 'note': "The square in front of the station feels rough at night, creators say. It is a police weapon-ban zone (current order to 7 December 2026) and alcohol is banned there; 95 weapons were seized in 2024. Fine by day and for the Prater and Riesenrad - just don't linger at night.", 'creators': ['khyatipuria', 'cityzen', 'travelingbutle']},
  {'area': 'Reumannplatz and Keplerplatz (Favoriten)', 'when': 'After dark', 'note': "Lively by day, with the Viktor-Adler-Markt and good food, but creators describe drug and alcohol activity after dark. Parts are a police weapon-ban zone. Not on the tourist route; the Hauptbahnhof a few hundred metres away feels quite different.", 'creators': ['khyatipuria', 'cityzen']},
  {'area': 'Westbahnhof and Gumpendorfer Straße', 'when': 'Evenings', 'note': "Police set up an alcohol ban and protection zone around Fritz-Imhoff-Park by the U6 in May 2026 and run regular checks at the station. Fine for a train or the hotels in the station complex; stay on the main streets at night.", 'creators': []},
  {'area': 'Ticket inspections on the U-Bahn, trams and buses', 'when': 'Always', 'note': "There are no barriers, but plain-clothes inspectors check often, and an unvalidated paper ticket counts as no ticket. The penalty is about €130-135 on the spot. App tickets need no validating.", 'creators': ['carolmax', 'woltersworld', 'gretetheaustri', 'riasw', 'borjalleg']},
 ],
 'scams': [
  {'title': 'Costumed concert sellers', 'text': "People in Mozart-era costume sell tickets for tourist concerts, often in small rooms, around Stephansplatz and the State Opera. One creator says the city banned them from those squares from July 2026. Buy from the venue's own website instead.", 'creators': ['viennacallingt', 'borjalleg', 'carolmax']},
  {'title': 'Petition and charity collectors', 'text': "On the Graben near the cathedral, collectors ask for your name and email and then press for a donation. Walk on.", 'creators': ['borjalleg']},
  {'title': 'Helpers at ticket machines and street games', 'text': "Politely refuse strangers offering to help at station ticket machines - use the staffed counter. Three-card games have been seen near the Naschmarkt; stay clear.", 'creators': ['woltersworld']},
  {'title': 'Fee-heavy cash machines', 'text': "Euronet and other independent cash machines charge high fees and dynamic currency conversion. Use a bank's machine and always pay in euros.", 'creators': ['viennacallingt', 'sophienadeau', 'borjalleg']},
  {'title': 'Bills on a night out', 'text': "In clubs and bars, watch the card terminal and check the amount before you tap - a creator saw terminals turned away from customers.", 'creators': ['borjalleg']},
 ],
 'transport': [
  {'title': 'From the airport (changed for 2026-27)', 'text': "Rail works run until about the end of October 2027. The cheap option is the REX7 train to the Hauptbahnhof (about 20 minutes, €5.50 adult, €2.80 age 6-14). The S7 currently stops at St. Marx, where you change to tram 18 or 71. The CAT is now a non-stop coach to Wien Mitte (€14.90, under-15s free). A fixed-price taxi was about €42 for up to four people (2025).", 'creators': ['happytowandert', 'carolmax', 'khyatipuria', 'theultimatetra']},
  {'title': 'Tickets in 2026', 'text': "A single is €3.20 on paper or €3.00 in the WienMobil app (age 6-15: €1.60). A 24-hour ticket is €10.20 (€9.70 digital) and a 7-day ticket €28.90 (€25.20 digital). The 48- and 72-hour tickets were scrapped on 1 January 2026, so older videos are out of date. Validate paper tickets before you travel.", 'creators': ['travelingexpat', 'gretetheaustri', 'carolmax']},
  {'title': 'Children travel free more often than you think', 'text': "Under-6s always ride free. Under-15s ride free on Sundays, public holidays and during Vienna's school holidays - carry photo ID. The Vienna City Card (from €19) also lets one child under 15 travel free with the holder.", 'creators': ['gretetheaustri']},
  {'title': 'Getting around', 'text': "Five U-Bahn lines and about 20 tram lines, with trains every few minutes; the U-Bahn runs all night on Fridays, Saturdays and before holidays. The U4 goes straight to Schönbrunn, the U2 to the Rathaus and MuseumsQuartier, the U1 from Stephansplatz to the Hauptbahnhof. Trams 1 and 2 circle the Ring past the main sights for the price of a ticket. Eating on board is banned. The central S-Bahn (Praterstern to Hauptbahnhof) is closed this winter.", 'creators': ['khyatipuria', 'thetravelersat', 'versed', 'gretetheaustri']},
  {'title': 'Pushchairs and lifts', 'text': "Every U-Bahn station is step-free and pushchairs use the marked doors; they are not allowed on escalators. Some lifts are being replaced this winter (Westbahnhof to 14 December, Keplerplatz to mid-December) - check Betriebsinfo in the app on the day.", 'creators': []},
 ],
 'costs': costs,
 'top_intro': "Ranked by how often creators recommend them. Book the palaces and Café Central ahead - Schönbrunn and the Hofburg use timed entry and sell out in December.",
 'top': [
  {'name': "St Stephen's Cathedral (Stephansdom)", 'area': 'Stephansplatz', 'why': "The Gothic heart of the city, with its patterned tile roof. You can step into the back for free; a guided sightseeing visit costs extra. The North Tower has a lift to the big Pummerin bell; the South Tower is 343 narrow steps. The catacombs tour includes rooms of bones that may upset young children. Sightseeing stops during services and is restricted at Christmas.", 'family': True, 'price': 'Back of the nave free · visit €8, child €3 · All-inclusive €29 (cathedral site)', 'url': 'https://www.stephanskirche.at', 'creators': ['khyatipuria', 'ultimatebucket', 'gretetheaustri', 'lifestylehal', 'noahtravelguid', 'theultimatetra', 'woltersworld']},
  {'name': 'Schönbrunn Palace & gardens', 'area': 'Hietzing', 'why': "The Habsburg summer palace, with the Christmas market in its courtyard. The gardens are free and the walk up to the Gloriette gives the classic view. Book a timed palace ticket online - the short State Apartments tour is very brief, so creators suggest a longer one. There is a children's museum with dress-up.", 'family': True, 'price': 'Gardens free · palace from €30 adult, €20 child (2026 summer prices)', 'url': 'https://www.schoenbrunn.at', 'creators': ['khyatipuria', 'carolmax', 'woltersworld', 'happytowandert', 'thetravelersat', 'exoticvacation', 'soniamotasimpl']},
  {'name': 'Tiergarten Schönbrunn (the zoo)', 'area': 'Hietzing', 'why': "One of the oldest zoos in the world, in the palace grounds, with pandas and more than 700 species - a hit with children and open all year.", 'family': True, 'price': 'About €27 adult (2025)', 'url': 'https://www.zoovienna.at', 'creators': ['islandhoppertv', 'noahtravelguid', 'woltersworld', 'khyatipuria']},
  {'name': 'Belvedere', 'area': 'Landstraße', 'why': "Baroque palaces with free gardens and Klimt's The Kiss in the Upper Belvedere. Timed tickets sell out, so book online; lockers for bags. The small Christmas market sits in front of the Upper Belvedere, and the palace reflected in the pond at sunset is a favourite photo.", 'family': True, 'price': 'Gardens free · Upper Belvedere about €22 (2026)', 'url': 'https://www.belvedere.at', 'creators': ['khyatipuria', 'carolmax', 'theultimatetra', 'islandhoppertv', 'riasw', 'thetravelersat']},
  {'name': 'Prater & the Riesenrad', 'area': 'Leopoldstadt', 'why': "The 1897 giant Ferris wheel, 65 m high, best at sunset, and an amusement park that is free to enter - you pay per ride, often in cash. In winter the Riesenradplatz hosts a family-friendly market until 6 January, and the Prater Hauptallee is a 4 km car-free walk.", 'family': True, 'price': 'Riesenrad from €14.50 online (2026) · park free', 'url': 'https://www.wienerriesenrad.com', 'creators': ['khyatipuria', 'gretetheaustri', 'islandhoppertv', 'noahtravelguid', 'happytowandert', 'theultimatetra']},
  {'name': 'Natural History Museum', 'area': 'Maria-Theresien-Platz', 'why': "Dinosaurs, interactive displays and a digital planetarium - creators call it very entertaining for children, and it faces the Christmas market. Under-19s go free at many Vienna museums; bring ID.", 'family': True, 'price': 'Under 19 free', 'url': 'https://www.nhm.at', 'creators': ['ultimatebucket', 'lifestylehal', 'carolmax']},
  {'name': 'Haus des Meeres', 'area': 'Mariahilf', 'why': "Austria's largest aquarium, inside a wartime flak tower, with sharks, a 10 m tunnel and a rooftop terrace on the 11th floor - a good warm, indoor morning with children.", 'family': True, 'price': 'Check the site', 'url': 'https://www.haus-des-meeres.at', 'creators': ['noahtravelguid']},
  {'name': 'Hofburg, Spanish Riding School & the Ring', 'area': 'Innere Stadt', 'why': "The imperial palace complex. The Lipizzaner horses' morning exercise is the cheap way in; full performances sell out weeks ahead, and under-3s are not admitted. Then walk or take tram 1 round the Ringstraße past the Opera, Parliament and City Hall.", 'family': True, 'price': 'Morning exercise from €17 · performances from €26', 'url': 'https://www.srs.at', 'creators': ['theultimatetra', 'gretetheaustri', 'khyatipuria']},
  {'name': 'State Opera standing tickets', 'area': 'Opernring', 'why': "Standing places for the State Opera are sold on the day, about 80 minutes before the performance, for around €13-18 - the cheapest way to see a show. Buy seated tickets only from the official site, never from street sellers.", 'family': False, 'price': 'Standing about €13-18 (2023)', 'url': 'https://www.wiener-staatsoper.at', 'creators': ['viennacallingt', 'khyatipuria', 'gretetheaustri', 'ultimatebucket']},
  {'name': 'Albertina', 'area': 'Albertinaplatz', 'why': "Creators' best-value museum, with state rooms and a terrace view over the Opera. Under-19s free.", 'family': True, 'price': 'Under 19 free', 'url': 'https://www.albertina.at', 'creators': ['happytowandert']},
 ],
 'eat_label': 'Schnitzel, Käsekrainer and Kaiserschmarrn',
 'eat_intro': "Vienna eats hearty: Wiener schnitzel with potato salad, Tafelspitz (boiled beef), goulash, and sweet things such as Kaiserschmarrn (torn pancake with plum sauce), Sachertorte and strudel. Sausage stands (Würstelstände) sell Käsekrainer - a cheese-filled sausage that squirts when you bite it - for a few euros. Famous places queue, so book or go early. Prices carry the year.",
 'eat': [
  {'name': 'Café Central', 'area': 'Herrengasse', 'type': 'Coffee house', 'price': '€€', 'family': True, 'why': "The grand coffee house everyone wants: the queue wraps round the building by mid-morning. Book the 8:00 slot online or arrive at opening; the café in Passage Ferstel next door is a calmer fallback.", 'creators': ['goanniewhere', 'sophienadeau', 'jessellis', 'khyatipuria', 'findingginamar'], 'url': maps('Café Central')},
  {'name': 'Café Demel', 'area': 'Kohlmarkt', 'type': 'Café & cake', 'price': '€€', 'family': True, 'why': "Kaiserschmarrn and coffee near the Hofburg. Queues can be an hour; the takeaway counter is a quick way to get a portion.", 'creators': ['travelingexpat', 'khyatipuria', 'carolmax'], 'url': maps('Demel')},
  {'name': 'Café Sacher', 'area': 'By the State Opera', 'type': 'Café & cake', 'price': '€€€', 'family': True, 'why': "The original Sachertorte, €10.50 a slice with cream (2025). Creators found the queue long and the cake overrated - Café Mozart nearby serves it with fewer tourists.", 'creators': ['borjalleg', 'woltersworld', 'worthytravels', 'chalkcheesetra'], 'url': maps('Café Sacher')},
  {'name': 'Bitzinger Würstelstand', 'area': 'By the Albertina', 'type': 'Sausage stand', 'price': '€', 'family': True, 'why': "The most famous sausage stand in town, opposite the Opera - Käsekrainer, bratwurst and Leberkäse late into the night. A Käsekrainer, frankfurter and bread for two came to just over €17 (2026).", 'creators': ['khyatipuria', 'carolmax', 'woltersworld'], 'url': maps('Bitzinger Würstelstand Albertina')},
  {'name': 'Plachutta', 'area': 'Wollzeile', 'type': 'Viennese', 'price': '€€€', 'family': True, 'why': "Popular with locals and visitors for Tafelspitz and schnitzel; book ahead.", 'creators': ['khyatipuria'], 'url': maps('Plachutta Wollzeile')},
  {'name': 'Zum Schwarzen Kameel', 'area': 'Bognergasse', 'type': 'Viennese deli', 'price': '€€', 'family': True, 'why': "A chef's daily lunch spot: open sandwiches, ham with horseradish and finger-food schnitzel in a classic setting.", 'creators': ['condnasttravel', 'soniamotasimpl'], 'url': maps('Zum Schwarzen Kameel')},
  {'name': 'Naschmarkt', 'area': 'Wieden / Mariahilf', 'type': 'Food market', 'price': '€-€€', 'family': True, 'why': "More than 100 stalls for a casual lunch; touristy and pricey for groceries, busier after midday. Locals prefer Brunnenmarkt (tram 2) for value.", 'creators': ['carolmax', 'jessellis', 'khyatipuria', 'viennacallingt', 'thetravelersat'], 'url': maps('Naschmarkt')},
  {'name': 'Hotel Imperial café', 'area': 'Kärntner Ring', 'type': 'Café & cake', 'price': '€€€', 'family': True, 'why': "The Imperial Torte (€11 in 2024) in a hotel dressed for Christmas.", 'creators': ['luxurytravelqu', 'soniamotasimpl'], 'url': maps('Café Imperial Wien')},
  {'name': 'Duna Kebab', 'area': 'Reumannplatz', 'type': 'Kebab', 'price': '€', 'family': True, 'why': "A famous kebab with a long takeaway queue and a shorter one inside for eating in - go by day.", 'creators': ['khyatipuria'], 'url': maps('Duna Kebab Reumannplatz')},
  {'name': 'Lange Gasse, Josefstadt', 'area': 'Josefstadt', 'type': 'Street of small food shops', 'price': '€', 'family': True, 'why': "Melted-cheese rolls (€5.80), a lunchtime-only pizza window (€5) and the Knödel Manufaktur for filled dumplings (€8.90 for two) - all 2024 prices.", 'creators': ['khyatipuria'], 'url': maps('Lange Gasse Josefstadt')},
 ],
 'grown_ups': "For a grown-ups' evening: Glühwein or a fruit Punsch at Spittelberg after work with the locals, curling with a hot drink at the Altes AKH campus market, standing tickets at the Opera, or a Heuriger wine tavern on the city's own vineyards. Spittelberg and the campus market stay open latest. The drinking age is 16 for beer and wine and 18 for spirits; drinking in public is allowed except on public transport and in small zones such as Praterstern.",
 'hotels': [
  {'name': 'Hotel Sacher Wien', 'area': 'By the State Opera', 'for': 'Luxury with children', 'band': '€€€€', 'why': "Next to the Opera and Albertina. The breakfast buffet has a children's stand with treats and colouring books, and the hotel runs a Christmas Sachertorte decorating demonstration (2024).", 'url': book('Hotel Sacher Wien'), 'source': 'soniamotasimpl'},
  {'name': 'Hotel Imperial', 'area': 'Kärntner Ring', 'for': 'Luxury', 'band': '€€€€', 'why': "A 150-year-old palace hotel on the Ring, decorated throughout for Christmas, with its own torte (2024).", 'url': book('Hotel Imperial Vienna'), 'source': 'luxurytravelqu'},
  {'name': 'Vienna Marriott Hotel', 'area': 'Parkring, opposite the Stadtpark', 'for': 'Families', 'band': '€€€', 'why': "On the Ring, 5-10 minutes' walk from the cathedral and Kärntner Straße, with an indoor pool for wet afternoons; from about $311 a night (2023).", 'url': book('Vienna Marriott Hotel'), 'source': 'tiptoptravelti'},
  {'name': 'Arcotel Wimberger', 'area': 'Neubau, by Burggasse-Stadthalle U6', 'for': 'Good value', 'band': '€€', 'why': "By the U6 and trams, a short walk from Mariahilfer Straße, with a spa; from about $169 a night (2023).", 'url': book('Arcotel Wimberger'), 'source': 'tiptoptravelti'},
  {'name': 'Hampton by Hilton Vienna Messe', 'area': 'Leopoldstadt, by the Prater', 'for': 'Families on a budget', 'band': '€€', 'why': "Near the Messe and the Prater on the U2, with a gluten-free breakfast option; from about $148 a night (2023).", 'url': book('Hampton by Hilton Vienna Messe'), 'source': 'tiptoptravelti'},
  {'name': 'Motel One Wien-Westbahnhof', 'area': 'Inside Westbahnhof', 'for': 'Arriving by train', 'band': '€', 'why': "A design budget hotel inside the station, on the U3 and U6, about 10 minutes from the centre; from about $118 a night (2023). Busy station area at night - use the main entrances.", 'url': book('Motel One Wien-Westbahnhof'), 'source': 'tiptoptravelti'},
 ],
 'itinerary': {
  '1day': [
   ['08:00', 'Café Central at opening', 'Breakfast before the queue, then the Hofburg courtyards.'],
   ['09:30', "St Stephen's Cathedral", 'Inside, then the North Tower lift - before the crowds and services.'],
   ['11:00', 'Am Hof and Freyung markets', 'The calmer old-town markets, five minutes apart.'],
   ['12:30', 'Lunch', 'Schnitzel or a Würstelstand Käsekrainer.'],
   ['14:00', 'Natural History Museum', 'Dinosaurs for the children, then Maria-Theresien-Platz market outside.'],
   ['16:00', 'Rathausplatz at dusk', 'The skating trail, the children\'s world in the park and the flying-heart show - weekday if you can.'],
   ['18:30', 'Spittelberg', 'Dinner at the stalls in the lanes, then tram or U-Bahn home.'],
  ],
  '3day': [
   ['Day 1 · The old town', 'Café Central, cathedral and Hofburg.', 'Am Hof, Freyung and Stephansplatz markets; the Graben chandeliers.', 'Rathausplatz and Spittelberg in the evening.'],
   ['Day 2 · Palaces', 'Schönbrunn Palace (timed ticket) and the zoo.', 'Schönbrunn Christmas market and the Gloriette walk.', 'Belvedere market and The Kiss.'],
   ['Day 3 · Families and the Prater', 'Art Advent at Karlsplatz (opens noon) or Haus des Meeres.', 'Prater, the Riesenrad and the winter market.', 'Last Punsch at the Altes AKH campus or Türkenschanzpark.'],
  ],
 },
 'tips': [
  {'title': 'Go on weekday afternoons', 'text': "Rathausplatz and Stephansplatz are packed on weekend evenings. Go at opening or an hour before closing on a weekday, and use the smaller markets for the rest of the time."},
  {'title': 'Carry cash and coins', 'text': "Many stalls, cafés, Prater rides and toilets want cash or coins, some places set a €10-15 card minimum, and the mug deposit is about €3-5. Use a bank cash machine, not Euronet."},
  {'title': 'Keep the mug - or get the deposit back', 'text': "Every market has its own mug (Häferl) with a deposit. Return it to any stall of the same market for the refund, or keep it as a souvenir. Plates may carry a €1 deposit too."},
  {'title': 'Book palaces and cafés', 'text': "Schönbrunn, the Hofburg, the Belvedere and Café Central use timed tickets or queue for an hour in December. Book online a few days ahead."},
  {'title': 'Plan for Sunday and the holidays', 'text': "Most shops close on Sundays and on 25 and 26 December; on 24 December general shops shut at 14:00. Supermarkets in the big stations stay open but get crowded. 8 December is a holiday but many shops open 10:00-18:00."},
  {'title': '24 December onwards', 'text': "Spittelberg, Am Hof, Freyung, Karlsplatz and Türkenschanzpark end on 23 December. Rathausplatz closes at 18:30 on Christmas Eve and runs on to 26 December; Schönbrunn and the Prater winter market run to 6 January."},
 ],
 'tips_intro': "Every tip here was checked against an official or trusted source (Wiener Linien, the City of Vienna, the market organisers, the Austrian police, gov.uk and others) on the date shown. Rules and prices change, so tap the link to double-check before you travel.",
 'christmas': {
  'intro': "Vienna has more than 20 official Advent markets, from the famous Christkindlmarkt in front of the City Hall to small ones in parks, lanes and university courtyards. Each serves Punsch and Glühwein in its own mug, and many have rides, workshops or animals for children. The first open on 6 November 2026; most close on 23 December, and a few run into January. Police step up uniformed and plain-clothes patrols every Advent.",
  'markets': [
   {'name': 'Wiener Christkindlmarkt (Rathausplatz)', 'area': 'Innere Stadt', 'when': '13 Nov - 26 Dec 2026 · 10:00-22:00 · 24 Dec to 18:30', 'why': "The big one: about 100 stalls in front of the floodlit City Hall, a winding ice-skating trail through the park (to 6 January, closed 31 December), a two-tier carousel, a reindeer train, a nativity trail and a flying-heart light show over the trees every half hour after dark. Food includes Käsekrainer, langos, potato pancakes and Kaiserschmarrn in a cone. Lockers and toilets on site.", 'family': True, 'price': 'Free entry · Glühwein averaged about €6.25 + mug deposit (2024)', 'crowds': "The most crowded market in Vienna - creators found it hard to move on a Saturday. Go at opening or an hour before closing on a weekday; the back sections are calmer.", 'creators': ['happytowander', 'sophienadeau', 'travelingexpat', 'pursuingmounta', 'davemani', 'bonvoyagebrend', 'theendlessadve', 'frostysummer', 'khyatipuria'], 'url': 'https://www.christkindlmarkt.at/en/'},
   {'name': 'Schönbrunn Palace', 'area': 'Hietzing', 'when': '6 Nov 2026 - 6 Jan 2027 · 10:00-21:00 · 24 Dec to 16:00 · from 25 Dec 10:00-19:00', 'why': "Creators' favourite for families: more than 90 stalls in the palace courtyard, a big tree, a small ice rink that is free for children, curling, a carousel, a Ferris wheel and a children's train, with concerts on the stage. Raclette is the dish - pay first, then queue for it. It runs on as a New Year market.", 'family': True, 'price': 'Free entry · Glühwein a little cheaper than in the centre (2023)', 'crowds': 'Busy but manageable; school groups on weekday mornings, calmest in the evening when day-trippers leave. U4 to Schönbrunn.', 'creators': ['travelingexpat', 'soniamotasimpl', 'pursuingmounta', 'happytowander', 'sophienadeau', 'probablylost', 'frostysummer', 'khyatipuria'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Art Advent (Karlsplatz)', 'area': 'Wieden', 'when': '13 Nov - 23 Dec 2026 · 12:00-20:00 (food to 21:00)', 'why': "Handmade-only crafts chosen by a jury, in front of the Karlskirche, with organic food. The best children's area in the city, creators say: a hay pit, a pedal-powered train, a hand-turned carousel and farm animals to stroke, plus craft workshops.", 'family': True, 'price': 'Free entry · mug deposit about €4 (2024)', 'crowds': 'Busy at weekends, but more local than the Rathaus.', 'creators': ['pursuingmounta', 'travelingexpat', 'worthytravels', 'happytowander', 'frostysummer', 'sophienadeau', 'khyatipuria'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Spittelberg', 'area': 'Neubau', 'when': '13 Nov - 23 Dec 2026 · Mon-Fri 14:00-21:30 · weekends 11:00-21:30', 'why': "More than 100 stalls through narrow cobbled lanes and courtyards behind the MuseumsQuartier: crafts, raclette, wild-boar sausage and many Punsch flavours. The market locals use after work - youthful and a bit adult in the evening.", 'family': False, 'price': 'Punsch about €4.50 · mug deposit about €3 (2024)', 'crowds': 'Busy after work and at weekends; opens only at 2pm on weekdays.', 'creators': ['travelingexpat', 'frostysummer', 'khyatipuria', 'pursuingmounta', 'jessellis', 'viennacallingt', 'sophienadeau', 'bonvoyagebrend'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Am Hof', 'area': 'Innere Stadt', 'when': '13 Nov - 23 Dec 2026 · Mon-Thu 11:00-21:00 · Fri-Sun 10:00-21:00', 'why': "A market has been held on this square since 1762. Crafts on one side and food on the other - raclette potatoes (€13 in 2025), soup in a bread bowl, Käsespätzle - with a lit canopy and a champagne bar.", 'family': True, 'price': 'Free entry', 'crowds': 'Calmer than the big three.', 'creators': ['frostysummer', 'alexmarktravel', 'probablylost', 'happytowander', 'sophienadeau', 'viennacallingt'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Altwiener Christkindlmarkt (Freyung)', 'area': 'Innere Stadt', 'when': '14 Nov - 23 Dec 2026 · 10:00-21:00', 'why': "A small, old-style market of about 60 stalls with wooden toys, ornaments, a large nativity and live music, two minutes from Am Hof. Kaiserschmarrn from about €8 (2025).", 'family': True, 'price': 'Free entry', 'crowds': 'Quiet and peaceful - much calmer than the Rathaus.', 'creators': ['frostysummer', 'happytowander', 'probablylost', 'alexmarktravel', 'vienna', 'worthytravels'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Maria-Theresien-Platz', 'area': 'Innere Stadt', 'when': '20 Nov - 26 Dec 2026 · Mon-Fri 11:00-21:00 · weekends 10:00-21:00', 'why': "About 70 stalls between the Natural History and Art History museums, with drinks in boot-shaped mugs and good handmade gifts. Lovely at sunset; pair it with the dinosaurs next door.", 'family': True, 'price': 'Free entry · potato fritters about €7 (2024)', 'crowds': 'Very busy at weekends; calmer on weekday daytimes.', 'creators': ['sophienadeau', 'happytowander', 'travelingexpat', 'goanniewhere', 'probablylost', 'bonvoyagebrend'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Belvedere', 'area': 'Landstraße', 'when': '20 Nov - 31 Dec 2026 · Mon-Fri 11:00-21:00 · weekends 10:00-21:00 · 24 & 31 Dec to 17:00', 'why': "Up to 35 stalls in front of the Upper Belvedere, reflected in the pond - one of the prettiest settings and quieter because it is a little out. Kaiserschmarrn was about €11 (2024).", 'family': True, 'price': 'Free entry', 'crowds': 'Not very crowded; peaceful at night.', 'creators': ['travelingexpat', 'frostysummer', 'sophienadeau', 'davemani', 'bonvoyagebrend'], 'url': 'https://www.kkweihnachtsmarkt.at/'},
   {'name': 'Stephansplatz', 'area': 'Innere Stadt', 'when': '6 Nov - 26 Dec 2026 · 11:00-21:00 · 24 Dec to 16:00 · 25-26 Dec to 19:00', 'why': "About 40 stalls at the foot of the cathedral - soup in bread and boot mugs, and the cathedral to warm up in. Creators found it pretty but small and pricey.", 'family': False, 'price': 'Free entry', 'crowds': 'Hardly room to move on a Saturday night; quiet on Sunday.', 'creators': ['sophienadeau', 'pursuingmounta', 'goanniewhere', 'bonvoyagebrend', 'frostysummer'], 'url': 'https://www.wien.info/en/now-on/events/christmas-village-stephansplatz-1133668'},
   {'name': 'Altes AKH university campus', 'area': 'Alsergrund', 'when': '13 Nov - 23 Dec 2026 · weekdays from 14:00, Sat from 11:00 · to 22:00-23:00', 'why': "In the courtyard of the old general hospital, now the university: students and locals, curling lanes, children's entertainment and often cheaper drinks. Open latest - a good place to end the evening.", 'family': True, 'price': 'Free entry', 'crowds': 'Much less crowded than the centre.', 'creators': ['frostysummer', 'happytowander', 'khyatipuria', 'pursuingmounta', 'viennacallingt'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Türkenschanzpark', 'area': 'Währing', 'when': '14 Nov - 23 Dec 2026 · Mon-Fri 15:00-22:00 · weekends 12:00-22:00', 'why': "A small market hidden in a park, beautifully lit, with a children's craft workshop at weekends. Germknödel (yeast dumpling with poppy seed) is the dish.", 'family': True, 'price': 'Free entry', 'crowds': 'Quiet - off the tourist trail.', 'creators': ['khyatipuria'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
   {'name': 'Prater winter market (Riesenradplatz)', 'area': 'Leopoldstadt', 'when': '20 Nov 2026 - 6 Jan 2027 · from 12:00 weekdays, 11:00 weekends, to 22:00', 'why': "Stalls round the giant Ferris wheel with langos and Buchteln, fairground rides and live music in the evening. Good for families; the Prater's free Krampus parade in early December gets very crowded.", 'family': True, 'price': 'Free entry · rides extra', 'crowds': 'Quieter by day.', 'creators': ['alpgaliptravel', 'frostysummer', 'khyatipuria', 'happytowander'], 'url': 'https://www.wien.info/en/now-on/christmas/christmas-markets-342664'},
  ],
  'sights': [
   {'name': 'The Graben and Kohlmarkt lights', 'area': 'Innere Stadt', 'when': 'From mid-November, after dark', 'why': "Giant chandeliers of 250,000 LEDs hang over the Graben, with a huge red bow on Kohlmarkt. Mariahilfer Straße and the Ring are lit too. Go late in the evening when the shopping crowds thin.", 'family': True, 'price': 'Free', 'crowds': 'Very busy early evening.', 'creators': ['sophienadeau', 'frostysummer', 'happytowander', 'khyatipuria'], 'url': 'https://www.wien.info'},
   {'name': 'Vienna Boys\' Choir at the Hofburg Chapel', 'area': 'Hofburg', 'when': 'Sundays in Advent and 25 Dec 2026, 09:15', 'why': "The choir sings Sunday Mass in the Hofburgkapelle. It is a church service with limited seats - book ahead for a seat or arrive early for standing room.", 'family': True, 'price': 'Check the site', 'crowds': 'Limited places.', 'creators': [], 'url': 'https://www.wien.info'},
   {'name': 'Skating', 'area': 'Rathausplatz & Schönbrunn', 'when': 'Rathausplatz rink 13 Nov - 6 Jan · closed 31 Dec', 'why': "The skating trail at the Christkindlmarkt winds between the trees of the Rathauspark; tickets from machines on site. Schönbrunn's rink is free for children. The bigger Wiener Eistraum on the same square only opens on 22 January 2027.", 'family': True, 'price': 'Pay at the machines', 'crowds': 'Busiest at weekends.', 'creators': ['walkingrelax', 'davemani', 'khyatipuria', 'vienna'], 'url': 'https://www.christkindlmarkt.at/en/'},
   {'name': "New Year's Eve trail (Silvesterpfad)", 'area': 'Innere Stadt & Prater', 'when': '31 Dec 2026, 14:00 - 02:00', 'why': "A free party along eight squares from the Rathaus to Stephansplatz and the Prater, with the Pummerin bell and the Blue Danube waltz at midnight. Rockets and bangers are banned in Vienna. In 2025 pushchairs and dogs were kept out of the busiest areas and Stephansplatz U-Bahn closed from 21:00.", 'family': True, 'price': 'Free', 'crowds': 'About 550,000 people in 2025; areas close when full.', 'creators': ['khyatipuria'], 'url': 'https://www.wien.info/de/aktuell/weihnachten/silvester-358870'},
  ],
  'safety': [
   {'title': 'Crowds and timing', 'text': "Creators advise avoiding the big markets on weekends. Weekday afternoons, opening time and the last hour are calmest. Rathausplatz and Stephansplatz are the pinch points; Freyung, Am Hof, Belvedere and the campus market are relaxed.", 'creators': ['pursuingmounta', 'khyatipuria', 'travelingexpat']},
   {'title': 'Police at the markets', 'text': "In November 2025 the Interior Minister said police would again show increased presence at the Advent markets, with uniformed and plain-clothes officers and specialist units, and that there was no sign of a specific threat. The UK Foreign Office says terrorists are likely to try to attack in Austria. The 2026 plan is usually announced in November.", 'creators': []},
   {'title': 'Pickpockets', 'text': "Police call Advent the high season for pickpockets. Thieves bump into you, spill a drink or wave a card or flyer to distract you. Keep valuables in a zipped inner pocket, carry little cash, and block your cards straight away if anything goes.", 'creators': ['woltersworld', 'theultimatetra']},
   {'title': 'Mugs, cash and food prices', 'text': "Drinks come in a mug with a deposit of about €3-5. In 2024 Punsch cost €4.50-10.50 and Glühwein €4.80-7.50; market food is mostly €5-15. Many stalls are cash only, and market toilets cost about 50 cents.", 'creators': ['alexmarktravel', 'travelingexpat', 'theendlessadve', 'alpgaliptravel', 'bonvoyagebrend']},
   {'title': 'Have a lost-child plan', 'text': "Before you go in, agree a meeting point everyone can find - the carousel at Rathausplatz or the big tree at Schönbrunn. A Wiley Fox QR wristband on each child means anyone who finds them can reach you straight away.", 'creators': []},
   {'title': 'Cold and slippery', 'text': "December evenings are around 0°C with an icy wind, and the old-town cobbles get slippery. Waterproof shoes with grip, gloves and a hat; take warm drinks slowly with children.", 'creators': ['khyatipuria', 'mayafitzherber']},
  ],
  'plan': "In 2026 Schönbrunn and Stephansplatz open on 6 November and the Rathausplatz Christkindlmarkt on 13 November. Most markets close on 23 December; Rathausplatz, Stephansplatz and Maria-Theresien-Platz run to 26 December, the Belvedere to 31 December, and Schönbrunn and the Prater winter market to 6 January. On 24 December the markets that stay open close early, and general shops shut at 14:00; shops are closed on 25 and 26 December. Book palaces, cafés and Christmas concerts early.",
 },
 'map_intro': "Austria doesn't publish street-level crime data, so this map shows the markets and sights in this guide, the busiest crowd spots and the police zones named in official orders.",
 'map_pins': [
  {'n': 'Christkindlmarkt (Rathausplatz)', 'lat': 48.2106, 'lng': 16.3587, 'kind': 'market', 'note': '13 Nov - 26 Dec; skating trail and children\'s world.'},
  {'n': 'Schönbrunn Palace market', 'lat': 48.1850, 'lng': 16.3116, 'kind': 'market', 'note': 'Family favourite, to 6 Jan.'},
  {'n': 'Art Advent (Karlsplatz)', 'lat': 48.1984, 'lng': 16.3714, 'kind': 'market', 'note': 'Hay pit, farm animals, handmade crafts.'},
  {'n': 'Spittelberg', 'lat': 48.2036, 'lng': 16.3551, 'kind': 'market', 'note': 'Lanes market locals use; from 2pm on weekdays.'},
  {'n': 'Am Hof', 'lat': 48.2111, 'lng': 16.3677, 'kind': 'market', 'note': 'Crafts and food, since 1762.'},
  {'n': 'Freyung (Altwiener Christkindlmarkt)', 'lat': 48.2116, 'lng': 16.3652, 'kind': 'market', 'note': 'Small, old-style and quiet.'},
  {'n': 'Maria-Theresien-Platz', 'lat': 48.2045, 'lng': 16.3609, 'kind': 'market', 'note': 'Between the two big museums.'},
  {'n': 'Belvedere', 'lat': 48.1915, 'lng': 16.3809, 'kind': 'market', 'note': 'Pretty and quiet, to 31 Dec.'},
  {'n': 'Stephansplatz', 'lat': 48.2085, 'lng': 16.3720, 'kind': 'market', 'note': 'Small and very crowded at weekends.'},
  {'n': 'Altes AKH campus', 'lat': 48.2165, 'lng': 16.3537, 'kind': 'market', 'note': 'Students, curling, open late.'},
  {'n': 'Türkenschanzpark', 'lat': 48.2355, 'lng': 16.3338, 'kind': 'market', 'note': 'Hidden park market.'},
  {'n': 'Prater winter market (Riesenradplatz)', 'lat': 48.2172, 'lng': 16.3960, 'kind': 'market', 'note': 'By the Ferris wheel, to 6 Jan.'},
  {'n': 'Graben chandeliers', 'lat': 48.2084, 'lng': 16.3702, 'kind': 'sight', 'note': 'Christmas lights; go late evening.'},
  {'n': 'Natural History Museum', 'lat': 48.2053, 'lng': 16.3598, 'kind': 'sight', 'note': 'Dinosaurs; under-19s free.'},
  {'n': 'Haus des Meeres', 'lat': 48.1976, 'lng': 16.3530, 'kind': 'sight', 'note': 'Aquarium in a flak tower.'},
  {'n': 'Spanish Riding School', 'lat': 48.2073, 'lng': 16.3667, 'kind': 'sight', 'note': 'Morning exercise from €17.'},
  {'n': 'Tiergarten Schönbrunn', 'lat': 48.1817, 'lng': 16.3048, 'kind': 'sight', 'note': 'The zoo.'},
  {'n': 'Wien Mitte (CAT coach)', 'lat': 48.2056, 'lng': 16.3842, 'kind': 'sight', 'note': 'CAT airport coach stop to Oct 2027.'},
  {'n': 'Hauptbahnhof (REX7 from the airport)', 'lat': 48.1850, 'lng': 16.3779, 'kind': 'sight', 'note': 'Main station; cheap airport train.'},
  {'n': 'Rathausplatz crowds', 'lat': 48.2112, 'lng': 16.3595, 'kind': 'caution', 'note': 'Pickpocket season; weekends packed.'},
  {'n': 'Praterstern', 'lat': 48.2198, 'lng': 16.3931, 'kind': 'caution', 'note': 'Weapon-ban zone to 7 Dec 2026; rough at night.'},
  {'n': 'Reumannplatz & Keplerplatz', 'lat': 48.1772, 'lng': 16.3770, 'kind': 'caution', 'note': 'Weapon-ban zone; avoid after dark.'},
  {'n': 'Westbahnhof & Fritz-Imhoff-Park', 'lat': 48.1894, 'lng': 16.3393, 'kind': 'caution', 'note': 'Alcohol ban and protection zone from May 2026.'},
 ],
 'map': {'center': [16.362, 48.204], 'zoom': 12.6},
 'compare': {
  'title': 'How Vienna compares with the rest of Austria',
  'intro': "Offences reported to police in 2025 per 100,000 residents. Austria publishes these figures by federal state, and Vienna is the only state that is a single city - so the other rows include their cities (Graz, Linz, Salzburg, Innsbruck) and the countryside around them. Vienna is higher on both lines, as capital cities are, because visitors and commuters are counted as victims but not as residents.",
  'cols': ['All reported offences', 'Pickpocketing & trick theft'], 'unit': 'per 100,000 residents, 2025 (Wiley Fox calculation)',
  'rows': [
   {'name': 'Upper Austria (incl. Linz)', 'vals': [4343, 46], 'me': False},
   {'name': 'Styria (incl. Graz)', 'vals': [4824, 58], 'me': False},
   {'name': 'Tyrol (incl. Innsbruck)', 'vals': [5501, 39], 'me': False},
   {'name': 'Salzburg state (incl. city)', 'vals': [5701, 55], 'me': False},
   {'name': 'Vienna', 'vals': [9531, 267], 'me': True},
   {'name': 'Austria average', 'vals': [5843, 99], 'avg': True},
  ],
  'note': "Rates are Wiley Fox's calculations from the Bundeskriminalamt counts and Statistik Austria's provisional population for 1 January 2026; the report's own rates use a slightly different population base. City-only figures for Graz, Linz, Salzburg and Innsbruck are not published in the report. For a German comparison: Munich recorded 5,798 and Berlin 13,642 offences per 100,000 residents in 2025, but the two countries count slightly differently.",
  'source': {'name': 'Bundeskriminalamt - Kriminalpolizeiliche Anzeigenstatistik 2025', 'url': 'https://www.bundeskriminalamt.at/501/files/kriminalpolizeiliche_anzeigenstatistik_2025_bf.pdf'}},
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
