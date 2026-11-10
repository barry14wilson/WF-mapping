# Changelog

All notable changes to the WF-mapping repo. Newest first. Dates are commit dates (UTC). Design and architecture notes live in `Wiley-Fox-Dev-Handoff-v1.md` (§20 covers September 2026).

## 2026-11-10 (Batch 6: Australia, Canada, more Japan, US cities by area; monthly refresh)

### Maps (`/new` and `/new/phase2`)
- **feat:** **Australia, click-anywhere by suburb:** Sydney, Melbourne and Adelaide (counts for every suburb), Brisbane, Gold Coast and Cairns (counts for every police division). Each area's count is spread across the area, and the card says so.
- **feat:** **Canada:** Vancouver (every incident at its 100-block, last 12 months; offences against a person have no published location, so the card says "partial") and Ottawa (every offence at the nearest intersection, 2025).
- **feat:** **Japan:** Saitama and Chiba get street-block layers; new cities **Sapporo, Sendai, Hiroshima** (street-block layers) and **Naha** (city-level). As with Osaka, these are seven street crimes only, so the rating stays on the city's global baseline and the card shows a "Partial data" note.
- **feat:** **US by area:** Austin (census block groups, serious "Part I" offences only), Phoenix (ZIP codes, 2025), Louisville (ZIP codes, last 12 months), Milwaukee (every offence at its address, last 12 months).
- **fix:** Japanese address matching now reads Sapporo's grid addresses (北３条西４丁目) and districts given without a block number; Hokkaido placement 44% → 99.4%. Other prefectures rebuilt with the same script (no material change).
- **feat:** partial-data notes now say what is missing per city (`partialNote`), not always "street crimes only".
- **ops:** `scripts/refresh/refresh_layers.py` rebuilds the 11 layers that update monthly or quarterly (Australia ×4, Vancouver, Ottawa, Austin, Louisville, Phoenix, Milwaukee, Netherlands); a monthly scheduled task runs it, deploys and adds a CHANGELOG entry.

### Data sources added
| Place | Source | Granularity | Period |
|---|---|---|---|
| Sydney | [BOCSAR — recorded criminal incidents by suburb (SuburbData.zip)](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html) | suburb, monthly | Jul 2025 – Jun 2026 |
| Melbourne | [Crime Statistics Agency Victoria — LGA data tables, Table 03 (suburb)](https://discover.data.vic.gov.au/dataset/data-tables-recorded-offences) | suburb | year ending Jun 2026 |
| Adelaide | [SA Police crime statistics (data.sa.gov.au)](https://data.sa.gov.au/data/dataset/crime-statistics) | suburb, daily | Jul 2025 – Jun 2026 |
| Brisbane, Gold Coast, Cairns | [QPS offence numbers by police division](https://www.data.qld.gov.au/dataset/offence-numbers-police-divisions-monthly-from-july-2001) + [QPS division boundaries](https://www.data.qld.gov.au/dataset/qps-divisions) | police division, monthly | Nov 2025 – Oct 2026 |
| Australia (shapes) | [ABS ASGS 2021 Suburbs and Localities](https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0) | — | 2021 |
| Vancouver | [VPD GeoDASH crime data](https://geodash.vpd.ca/opendata/) | 100-block | Nov 2025 – Oct 2026 |
| Ottawa | [Ottawa Police criminal offences](https://open.ottawa.ca/datasets/ottawa::criminal-offences-open-data) | intersection | 2025 |
| Saitama | [Saitama Prefectural Police 犯罪オープンデータ 令和7年](https://www.police.pref.saitama.lg.jp/c0011/kurashi/0pendata2019/opendata2025.html) | street block, 7 street crimes | 2025 |
| Chiba | [Chiba Prefectural Police crime open data](https://www.police.pref.chiba.jp/seisoka/safe-life_publicspace-statistics_00002.html) | street block, 7 street crimes | 2025 |
| Sapporo | [Hokkaido Police 2025 犯罪オープンデータ (Hokkaido open data portal)](https://www.harp.lg.jp/opendata/dataset/2258.html) | street block, 7 street crimes | 2025 |
| Sendai | [Miyagi Prefectural Police crime open data](https://www.police.pref.miyagi.jp/seian/opendata.html) | street block, 7 street crimes | 2025 |
| Hiroshima | [Hiroshima Prefectural Police 犯罪発生情報 (Hiroshima open data portal)](https://hiroshima-opendata.dataeye.jp/datasets?keyword=%E7%8A%AF%E7%BD%AA) | street block, 7 street crimes | 2025 |
| Japan (block centres) | [MLIT 位置参照情報](https://nlftp.mlit.go.jp/isj/) (prefectures 01, 04, 11, 12, 34) | — | 2024 points |
| Austin | [Austin PD crime reports](https://data.austintexas.gov/Public-Safety/Crime-Reports/fdj4-gpfu) + [Census TIGERweb block groups](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10) | census block group, Part I | Nov 2025 – Oct 2026 |
| Phoenix | [Phoenix PD crime data](https://www.phoenixopendata.com/dataset/crime-data) + [Census ZCTAs](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2) | ZIP code | 2025 |
| Louisville | [LMPD crime data 2026](https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/crime_data_2026/FeatureServer/0) + [2025](https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/crime_data_2025/FeatureServer/0) | ZIP code | Nov 2025 – Oct 2026 |
| Milwaukee | [Milwaukee PD WIBR crime data](https://data.milwaukee.gov/dataset/wibr) | address | Nov 2025 – Oct 2026 |

- **checked, not added:** Perth ([WA Police](https://www.wa.gov.au/organisation/western-australia-police-force/crime-statistics) publish suburbs only in a Power BI dashboard; the download is by district) · Canberra, Hobart, Darwin (no suburb-level download) · Calgary ([open data](https://data.calgary.ca/) has social-disorder statistics only) · Edmonton, Winnipeg (dashboards, no download) · Naha ([Okinawa Police open data](https://www.police.pref.okinawa.jp/docs/2021053100019/) stops at 2020) · Portland ([Tableau download](https://www.portland.gov/police/open-data/reported-crime-data) no longer available) · San Antonio and the other US city-level cities (no open file with a usable location).

## 2026-11-09 (Batch 5: Berlin district regions; Osaka, Kyoto, Kobe, Nagoya, Fukuoka street crime)

### Maps (`/new` and `/new/phase2`)
- **feat:** **Berlin** now uses Polizei Berlin's Kriminalitätsatlas 2025 (143 district regions, 322,031 offences in mapped categories) instead of the Eurostat area card. Each region's count is spread across its planning areas by area (labelled on the card). Click anywhere in Berlin (e.g. "Kreuzberg, Berlin": 68/100).
- **feat:** **Osaka, Kyoto, Kobe, Nagoya, Fukuoka** get street-block layers from each prefectural police force's 2025 open data (seven street crimes: bag snatching, car break-ins, car-part theft, vending-machine theft, car theft, motorbike theft, bike theft); about 76,000 incidents, 94–99.5% placed. Because these are theft-type crimes only, the card shows a "Partial data" note and the **rating stays on the city's global baseline** (new `baselineOnly` option) rather than looking artificially safe.
- **feat:** new cards for Fukuoka, Nagoya and Kobe; Nara city-level card (keeps Osaka's data from being used in Nara).
- **note:** Mexico City is still city-level: its open-data portal (datos.cdmx.gob.mx) refused connections from both our build environment and Barry's Mac on 9 Nov 2026. Kanagawa (Yokohama) doesn't publish the seven-crime files as downloads, so Yokohama stays city-level.

### Data sources added
| Place | Source | Granularity | Period |
|---|---|---|---|
| Berlin | [Polizei Berlin — Kriminalitätsatlas (xlsx)](https://daten.berlin.de/datensaetze/kriminalitatsatlas-berlin) + [Geoportal Berlin LOR 2021 WFS](https://gdi.berlin.de/services/wfs/lor_2021?service=WFS&request=GetCapabilities) | 143 district regions (Bezirksregionen), 8 crime groups | 2025 |
| Osaka | [Osaka Prefectural Police 犯罪オープンデータ 令和7年](https://www.police.pref.osaka.lg.jp/seikatsu/24614.html) | Street block, 7 street crimes | 2025 |
| Kyoto | [Kyoto Prefectural Police 犯罪発生情報 令和7年 (BODIK)](https://data.bodik.jp/organization/260002) | Street block, 7 street crimes | 2025 |
| Kobe | [Hyogo Prefectural Police crime open data](https://web.pref.hyogo.lg.jp/kk26/johoseisaku/opendata.html) | Street block, 7 street crimes | 2025 |
| Nagoya | [Aichi Prefectural Police crime open data](https://www.pref.aichi.jp/police/anzen/toukei/opendata/seian-s/crimeopendata.html) | Street block, 7 street crimes | 2025 |
| Fukuoka | [Fukuoka Prefectural Police 犯罪オープンデータ 令和7年 (BODIK)](https://data.bodik.jp/organization/400009) | Street block, 7 street crimes | 2025 |
| Japan (all) | [MLIT 位置参照情報 block centre points](https://nlftp.mlit.go.jp/isj/) · [NPA index of prefectural crime open data](https://www.npa.go.jp/toukei/seianki/hanzaiopendatalink.html) | — | 2024 points |

- **checked, not added:** Mexico City ([open data portal](https://datos.cdmx.gob.mx/) unreachable, connection refused) · Kanagawa/Yokohama ([police statistics page](https://www.police.pref.kanagawa.jp/tokei/hanzai_tokei/mesd0145.html) has no downloadable files).

## 2026-11-09 (Batch 4: Tokyo street blocks, Dutch neighbourhoods, 43 more European cities, 24 Asian city cards)

### Maps (`/new` and `/new/phase2`)
- **feat:** **Tokyo** now has near-street-level detail: Tokyo Metropolitan Police recorded offences for every street block (町丁目), 36 crime types, Jan–Sep 2026 (80,789 offences, 99.6% placed), shown as a monthly average at each block's centre. Click anywhere in Tokyo (e.g. "Shibuya, Tokyo"). Tokyo's score moves from 86 to 95 now that its own police data counts (centre is low-crime).
- **feat:** **Amsterdam, Rotterdam, The Hague, Utrecht** get neighbourhood-level layers from Dutch police monthly counts per *buurt* (Jul–Sep 2026 average, 12,867 crimes/month placed). Amsterdam switches from the Eurostat area card to this finer data.
- **feat:** **43 more European cities** with official area-level data (Eurostat police-recorded offences vs national average): Madrid, Seville, Valencia, Málaga, Palma, Granada, Bilbao, Porto, Prague, Budapest, Warsaw, Kraków, Copenhagen, Stockholm, Oslo, Helsinki, Brussels, Antwerp, Bruges, Hamburg, Frankfurt, Dresden, Zürich, Geneva, Bratislava, Ljubljana, Zagreb, Split, Dubrovnik, Riga, Tallinn, Vilnius, Valletta, Reykjavík, Bucharest, Sofia, Salzburg, Innsbruck, Bologna, Turin, Palermo, Verona, Pisa. `OFFICIAL_AREA` now holds 70 places (the 27 existing entries are unchanged).
- **feat:** **city-level cards** for Osaka, Kyoto, Yokohama, Kawasaki, Saitama, Chiba, Seoul, Busan, Hong Kong, Taipei, Kuala Lumpur, Hanoi, Ho Chi Minh City, Phuket, Chiang Mai, Manila, Jakarta, Abu Dhabi, Doha, Delhi, Mumbai, Shanghai, Beijing and Athens.
- **feat:** new `loadAggregateCity()` for police data published as counts per small area; `US_CITY_APIS` entries can set `radius` so a feed is only used within its coverage (Tokyo 0.45°, Dutch cities 0.08–0.12°). Yokohama/Kawasaki/Saitama/Chiba cards stop Tokyo's data being used outside Tokyo.
- **fix:** Numbeo name matching for Palma, Kraków, The Hague, Hong Kong and Washington DC; Czechia now matches Numbeo's "Czech Republic". Macau dropped (no Numbeo or homicide data, so no honest rating).
- **fix:** the source credit no longer shows the previous city's source on city-level cards.

### Data sources added
| Place | Source | Granularity | Period |
|---|---|---|---|
| Tokyo | [Tokyo Metropolitan Police — 区市町村の町丁別、罪種別及び手口別認知件数 (`R8.csv`)](https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html) + [MLIT 位置参照情報 block centres](https://nlftp.mlit.go.jp/isj/) | Street block (町丁目), 36 crime types | Jan–Sep 2026 (updated 15 Oct 2026) |
| Amsterdam, Rotterdam, The Hague, Utrecht | [Politie / CBS 47022NED registered crimes by neighbourhood, monthly](https://data.politie.nl/#/Politie/nl/dataset/47022NED) + [PDOK Wijk- en Buurtkaart 2025](https://service.pdok.nl/cbs/wijkenbuurten/2025/wfs/v1_0?service=WFS&request=GetCapabilities) | Neighbourhood (buurt), 25 offence types kept | Jul–Sep 2026 (final) |
| 43 European cities | [Eurostat `crim_gen_reg`](https://ec.europa.eu/eurostat/databrowser/view/crim_gen_reg/default/table) (already in `scripts/official-area/data/eu_by_year.json`) | NUTS 3 region vs national | 2024 (2023 where 2024 not yet published: Rotterdam, The Hague, Utrecht, Riga, Bologna, Verona, Pisa) |

- **checked, not added (with reasons):** Osaka (2025 annual data for 7 street crimes sits on a separate prefectural open-data site that blocked automated access; [notes page](https://www.police.pref.osaka.lg.jp/seikatsu/24615.html)) · Kyoto (PDF statistics only) · Taipei ([burglary points](https://data.gov.tw/dataset/130312) are address ranges, ~30 a month; would need mass geocoding) · Singapore ([data.gov.sg](https://data.gov.sg/datasets/d_5767147db6e5b4c4cfa874db132fef39/view): annual counts by police division only) · Athens (Greece reports Attica only to Eurostat) · Mexico City (open data portal unreachable from our build environment; to retry from the Mac) · Berlin district-level atlas (yearly; candidate for the next batch) · Seoul, Hong Kong, Bangkok, Dubai and other Asian cities (no open local data found).

## 2026-11-09 (Batch 3: 23 more street-level cities, 41 city-level cards — US, Canada, Australia)

### Maps (`/new` and `/new/phase2`)
- **feat:** street-level dots, hexes, global score and click-anywhere for **20 more US cities** (Nashville, Fort Worth, Columbus, Charlotte, Omaha, Raleigh, Long Beach, Minneapolis, Tampa, Wichita, Detroit, Cleveland, Baltimore, Kansas City, Oakland, Mesa, Baton Rouge, Buffalo, New Orleans, Boise) and **3 Canadian cities** (Toronto, Montréal, Halifax). Street-level coverage is now 36 cities outside the UK/Ireland.
- **feat:** **city-level cards** (global score from Numbeo + homicide rate, FCDO/US advice, guide links; labelled "city-level") for 26 US cities without open street-level data (Austin, Orlando, Atlanta, Pittsburgh, Phoenix, San Antonio, San Jose, Jacksonville, Indianapolis, Portland, Memphis, Honolulu, Salt Lake City, St. Louis, Cincinnati, Milwaukee, Louisville, Sacramento, Tucson, Albuquerque, El Paso, Oklahoma City, Anchorage, Savannah, Charleston, Richmond), 6 Canadian (Vancouver, Calgary, Edmonton, Winnipeg, Ottawa, Québec City) and 9 Australian (Melbourne, Brisbane, Perth, Adelaide, Gold Coast, Canberra, Hobart, Darwin, Cairns).
- **feat:** readers extended: Socrata `point` columns and numeric lat/lng, a CKAN "newest rows" reader (Montréal), per-city `include` / `exclude` category filters and `catMap` (French SPVM categories).
- **fix:** a click now snaps to the nearest city overall and only loads street data if *that* city has a feed (a Phoenix click no longer loads Mesa's feed and shows falsely low crime).
- **fix:** non-crime records filtered out: Wichita (traffic, found property, mental-health and "misc report" categories; central 1-mile count 1,974 → 818) and Columbus (missing persons, aid and transport, lost property, DOA, etc.).
- **fix:** global city cards with no city homicide rate now say "national homicide rate used" instead of "null".
- **fix:** the FCDO panel on live-data cards uses the city's own country (Canada now uses this path).
- **note:** labelled "partial public data": Tampa (public extract only) and New Orleans (NOPD calls for service filtered to crime types; NOLA publishes no geocoded incident file). Detroit's feed is one layer per year (`RMS_Crime_Incidents_2026`): switch the URL each January. Halifax's layer holds about a week, so counts are scaled to a month.

### Data sources added
| City | Source | Records used | Newest record (9 Nov) |
|---|---|---|---|
| Nashville | [MNPD Incidents (ArcGIS view)](https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Metro_Nashville_Police_Department_Incidents_view/FeatureServer/0) | All | 8 Nov 2026 |
| Fort Worth | [FWPD Crime Data Points (ArcGIS)](https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Crime_Data/MapServer/0) | All | 8 Nov 2026 |
| Columbus | [Columbus Police Incident Reports (ArcGIS)](https://services1.arcgis.com/9yy6msODkIBzkUXU/arcgis/rest/services/Police_Incident_Reports/FeatureServer/0) | Non-crime subjects excluded | 6 Nov 2026 |
| Charlotte | [CMPD Incidents (ArcGIS)](https://gis.charlottenc.gov/arcgis/rest/services/CMPD/CMPDIncidents/MapServer/0) | All | 7 Nov 2026 |
| Omaha | [Omaha Police Incident Data (ArcGIS view)](https://services1.arcgis.com/tIBLyYZX96jUntYm/arcgis/rest/services/Omaha_Police_Incident_Data_(View)/FeatureServer/0) | All (block-level points) | 9 Nov 2026 |
| Raleigh | [Raleigh Police Incidents NIBRS (ArcGIS)](https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Police_Incidents/FeatureServer/0) | Excl. `MISCELLANEOUS` | 9 Nov 2026 |
| Long Beach | [LBPD Police Crime Mapping (ArcGIS)](https://services6.arcgis.com/yCArG7wGXGyWLqav/arcgis/rest/services/Police_Crime_Mapping/FeatureServer/0) | All | 7 Oct 2026 |
| Minneapolis | [MPD Crime Data (ArcGIS)](https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Crime_Data/FeatureServer/0) | Excl. "Additional Crime Metrics" duplicates | 6 Nov 2026 |
| Tampa | [TPD crimes_public_365days (ArcGIS)](https://services1.arcgis.com/IbNXlmt2RVVRCZ6M/arcgis/rest/services/crimes_public_365days/FeatureServer/0) | Group A; partial extract | 8 Nov 2026 |
| Wichita | [WPD Crime Incidents 90 days (ArcGIS)](https://gismaps.wichita.gov/ageweb/rest/services/OpenData/Crime/MapServer/0) | Non-crime categories excluded | 8 Nov 2026 |
| Detroit | [DPD RMS Crime Incidents 2026 (ArcGIS)](https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/RMS_Crime_Incidents_2026/FeatureServer/0) | All | 9 Nov 2026 |
| Cleveland | [CDP Crime Incidents P1RMS (ArcGIS)](https://services3.arcgis.com/dty2kHktVXHrqO8i/arcgis/rest/services/Crime_Incidents_P1RMS/FeatureServer/0) | All | 9 Nov 2026 |
| Baltimore | [BPD NIBRS Group A Crime Data (ArcGIS)](https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/NIBRS_GroupA_Crime_Data/FeatureServer/0) | Group A (replaces the legacy file that ended Dec 2024) | 3 Nov 2026 |
| Boise | [BPD Crimes Public (ArcGIS)](https://services1.arcgis.com/WHM6qC35aMtyAAlN/arcgis/rest/services/BPD_Crimes_Public/FeatureServer/0) | Charge category A | 29 Oct 2026 |
| Kansas City | [KCPD Crime Data 2026 (Socrata `f7wj-ckmw`)](https://data.kcmo.org/resource/f7wj-ckmw.json) | All | 9 Nov 2026 |
| Oakland | [OPD CrimeWatch Data (Socrata `ppgh-7dqv`)](https://data.oaklandca.gov/resource/ppgh-7dqv.json) | All | 8 Nov 2026 |
| Mesa | [Mesa PD Criminal Offenses (Socrata `t445-fism`)](https://citydata.mesaaz.gov/resource/t445-fism.json) | Offense group A | 7 Nov 2026 |
| Baton Rouge | [BRPD Crime Incidents (Socrata `pbin-pcm7`)](https://data.brla.gov/resource/pbin-pcm7.json) | All | 5 Oct 2026 |
| Buffalo | [BPD Crime Incidents (Socrata `d6g9-xbgu`)](https://data.buffalony.gov/resource/d6g9-xbgu.json) | All | 8 Nov 2026 |
| New Orleans | [NOPD Calls for Service 2026 (Socrata `es9j-6y5d`)](https://data.nola.gov/resource/es9j-6y5d.json) | Crime call types only; partial | 8 Nov 2026 |
| Toronto | [TPS YTD_CRIME_WM (ArcGIS)](https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/YTD_CRIME_WM/FeatureServer/0) | Major crime indicators; withheld locations (0,0) dropped | 8 Nov 2026 |
| Montréal | [SPVM Actes criminels (CKAN datastore)](https://donnees.montreal.ca/dataset/actes-criminels) | All; points snapped to intersections by SPVM | 6 Nov 2026 |
| Halifax | [HRP Crime (ArcGIS)](https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/Crime/FeatureServer/0) | All (about one week held) | 8 Nov 2026 |

- **data (homicide inputs):** US street-level and city-level cities use the **FBI UCR 2024** murder rate per 100k (Table 8, as compiled in [Wikipedia: List of US cities by crime rate](https://en.wikipedia.org/wiki/List_of_United_States_cities_by_crime_rate)), except where FBI 2024 has no row: Atlanta 18.8 (98 homicides in 2025, [CBS News](https://www.cbsnews.com/atlanta/news/atlanta-records-lowest-homicide-total-since-2018-officials-say)), Orlando 3.0 (10 in 2025, [Spectrum News](https://spectrumlocalnews.com/orlando/news/2026/02/14/orlando-crime-homicides-decrease)), Jacksonville 7.8 (79 murders in 2025, [News4JAX](https://www.news4jax.com/news/local/2026/01/02/jacksonvilles-2025-homicide-data-reveals-spikes-in-certain-areas-but-only-1-gang-related-death-a-7-year-olds-murder)), New Orleans 29.8 (108 murders in 2025, [GNO Inc.](https://gnoinc.org/news/gno-inc-sunday-night-highlight-a-historic-year-for-lower-crime-in-new-orleans/), cross-checked by [Louisiana Data News](https://ladatanews.com/?p=14733)), Baton Rouge 23.5 (52 murder incidents in BRPD's own 2025 feed). Populations from [US Census Vintage 2024](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv). Canada: [Statistics Canada 2024 homicide rates by CMA](https://www150.statcan.gc.ca/n1/daily-quotidien/251202/t003a-eng.htm) (Toronto updated 1.8 → 1.9). Australia: national rate (no city rate used).
- **checked, not added as street-level:** Ottawa ([open data](https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Criminal_Offences_Open_Data/FeatureServer/0) is released yearly; newest record 31 Dec 2025) · Pittsburgh ([WPRDC 30-day blotter](https://data.wprdc.org/api/3/action/datastore_search?resource_id=1797ead8-8262-41cc-9099-cbc8a161924b&limit=1) has no 2026 rows) · Vancouver (VPD GeoDASH is a file download only) · Australia (state police publish counts by suburb/LGA, not points) · Austin ([no coordinates](https://data.austintexas.gov/resource/fdj4-gpfu.json)) · Phoenix, San Antonio, San Jose, Jacksonville, Indianapolis, Portland, Memphis, Honolulu, Salt Lake City, St. Louis, Cincinnati, Milwaukee, Louisville, Sacramento, Tucson, Albuquerque, El Paso, Oklahoma City, Orlando, Miami, Atlanta (no open, current, geocoded incident feed found on Socrata, ArcGIS or CKAN on 9 Nov 2026). All have city-level cards.

## 2026-11-09 (Eight more US cities)

### Maps (`/new` and `/new/phase2`)
- **feat:** Washington DC, Seattle, Philadelphia, Boston, Denver, Dallas, San Diego and Las Vegas added, with live street-level dots, hexes, the global score and click-anywhere by neighbourhood (e.g. "Georgetown, Washington DC", "Back Bay, Boston", "Lower Downtown, Denver"). US coverage goes from 5 to 13 cities.
- **feat:** new `WF_US_READERS` (ArcGIS, Socrata with location/text coordinates, CARTO SQL, CKAN SQL) and `loadReaderUSCity()`; a city is now a config row in `US_CITY_APIS` with `type:`. Readers anchor the 30-day window to each portal's newest record (never future-dated rows) and filter on lat/lng columns where they exist (Denver: 1.8 s instead of ~60 s).
- **fix:** `mapUSCategory` now catches shoplifting / retail theft before generic theft, and maps "mischief" / "destruction" to criminal damage.
- **note:** Las Vegas is labelled "partial public data" on the card: LVMPD only publishes a subset of offences.

### Data sources added
| City | Source | Records used | Freshness (9 Nov) |
|---|---|---|---|
| Washington DC | [DC MPD "Crime Incidents – Last 30 Days" (ArcGIS layer 39)](https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/MPD/MapServer/39) | All | 9 Nov 2026 |
| Seattle | [SPD Crime Data (Socrata `tazs-3rd5`)](https://data.seattle.gov/resource/tazs-3rd5.json) | NIBRS Group A | 7 Nov 2026 |
| Philadelphia | [PPD incidents, CARTO table `incidents_part1_part2`](https://phl.carto.com/api/v2/sql?q=select%20max(dispatch_date)%20from%20incidents_part1_part2) | Part I + II | 9 Nov 2026 |
| Boston | [BPD Crime Incident Reports (CKAN resource `b973d8cb-eeb2-4e7e-99da-c92938efc9c0`)](https://data.boston.gov/api/3/action/datastore_search?resource_id=b973d8cb-eeb2-4e7e-99da-c92938efc9c0&limit=1) | Non-crime service codes excluded; ~76% of rows have coordinates | 4 Nov 2026 |
| Denver | [Denver crime offenses (ArcGIS `ODC_CRIME_OFFENSES_P/FeatureServer/324`)](https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_CRIME_OFFENSES_P/FeatureServer/324) | `IS_CRIME=1` | 5 Nov 2026 |
| Dallas | [DPD Police Incidents (Socrata `qv6i-rri7`)](https://www.dallasopendata.com/resource/qv6i-rri7.json) | NIBRS Group A, geocoded rows | 8 Nov 2026 |
| San Diego | [SDPD NIBRS offenses (ArcGIS)](https://webmaps.sandiego.gov/arcgis/rest/services/SDPD/SDPD_NIBRS_Crime_Offenses_Geo/FeatureServer/0) | Group A | Oct–Nov 2026 |
| Las Vegas | [LVMPD Reported NIBRS Crimes YTD (ArcGIS)](https://services.arcgis.com/jjSk6t82vIntwDbs/arcgis/rest/services/LVMPD_Reported_NIBRS_Crimes_YTD/FeatureServer/0) | Group A, partial extract | 1 Nov 2026 |

- **data:** homicide inputs for the global score = 2025 murders ÷ US Census Vintage 2024 city population (`sub-est2024.csv`): DC 127 → 18.1 per 100k; Seattle 32 → 4.1; Philadelphia 222 → 14.1; Boston 24 → 3.6; Denver 39 → 5.3; San Diego 41 → 2.9 (all counted from each city's own feed; Seattle and Denver match their police departments' published year-on-year falls). Dallas ≈ 120 → 9.0, **estimated** from DPD's reported 2025 fall (42 fewer homicides, −26%) because the open-data feed holds only 58 murder incidents. Las Vegas uses the US national rate: LVMPD's jurisdiction is wider than the city and its feed is partial.
- **references** (homicide inputs): [US Census Vintage 2024 city population, `sub-est2024.csv`](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv) · Dallas: [Spectrum News, 6 Feb 2026](https://spectrumlocalnews.com/tx/south-texas-el-paso/news/2026/02/06/dallas-sees-drop-in-violent-crime) (−26%, 42 fewer), cross-checked with [FOX 4](https://www.fox4news.com/news/dallas-murder-rate-drops-12-2025) · Seattle: [KIRO 7](https://www.kiro7.com/news/local/seattle-pd-report-crime-rates-fell-by-18-homicides-fell-by-36-last-year/CGQSO5WYUVFEVBXWSTWBNUPOOM) (−36%) · Denver: [CBS News](https://www.cbsnews.com/colorado/news/denver-homicides-fall-48-percent-in-2025) (−48%).
- **checked, not added (links):** [Austin crime reports](https://data.austintexas.gov/resource/fdj4-gpfu.json) (no coordinates) · Nashville MNPD incidents (ArcGIS feed now returns "Token Required") · [Baltimore Part 1 (Legacy)](https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/Part1_Crime_Beta/FeatureServer) (ends Dec 2024) · Orlando, Miami, Atlanta, New Orleans (no public incident feed with coordinates found; [Atlanta PD crime maps](https://atlantapd.org/community/crime-statistics/crime-maps)).

## 2026-11-09 (Click anywhere in US cities)

- **fix:** clicking anywhere in New York, Chicago, San Francisco, Los Angeles or Houston now loads crime data and the rating for that spot, named by neighbourhood (e.g. "Lincoln Park, Chicago", "Uptown, Houston"), like the UK. Previously any non-UK click snapped back to the nearest city centre. New `wfUSCityNear()` / `wfLoadUSPoint()`; Houston's Super Neighborhood card follows the clicked spot.
- **feat:** hex popups (UK and US) have a "Check safety here" link that loads that spot.
- **fix:** crime hexes, place pins and the country colouring waited for the map's one-off `load` event; if tiles were still streaming (e.g. mid fly-to) they never drew. They now wait for `idle`.
- **fix:** only the newest US load may render (a slow earlier request could overwrite a later click). City portal requests time out after 20 s and retry once; if a portal is down the card says "street-level data temporarily unavailable" instead of silently showing the city-wide card.

## 2026-11-08 (Houston added)

- **feat:** Houston on `/new` and `/new/phase2`. Dots, hexes and the rating come from HPD's monthly NIBRS file (latest complete month, Group A only), pre-built into `new/data/houston/hpd_latest.json` by `scripts/houston/build_hpd.py` because HPD offers files, not an API. New `loadStaticUSCity()` handles any city fed this way.
- **feat:** Houston city card adds a live "Super Neighborhood" panel (City of Houston / HPD ArcGIS, 2024 counts vs the median of 88 areas, outlined on the map) and a "Reporting a concern in Houston" panel (911, Crime Stoppers 713-222-TIPS, Stop Houston Gangs, HPD data).
- **feat:** pipeline connector `connectors/us-houston-hpd.js` (`npm run connector:houston`), `categoriseNIBRS()` in `lib/normalise.js`, monthly scheduled function `scheduled-us-houston` (20th, 06:00 UTC), tests in `test/houston-hpd.test.js`.
- **data:** Houston homicide input 11.4 per 100k (272 murders in HPD 2025 ÷ 2,390,125, Census 2024). Global score 29/100, band 2. Details in `scripts/houston/README.md`.
- **sources:** [HPD Monthly Crime Data by Street and Police Beat](https://houstontx.gov/police/cs/Monthly_Crime_Data_by_Street_and_Police_Beat.htm) (`NIBRSPublicView<YEAR>.csv`) · [City of Houston / HPD Crime Summary by Super Neighborhood (ArcGIS)](https://services.arcgis.com/NummVBqZSIJKUeVR/ArcGIS/rest/services/HPD_Crime_Summary/FeatureServer) · [Crime Stoppers of Houston](https://crime-stoppers.org/crime-stoppers-anonymous-tips) · [Stop Houston Gangs](http://stophoustongangs.org/) · population: [US Census Vintage 2024](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv).

## 2026-11-06 (One global safety scale)

- **fix:** every city now uses one 0–100 Wiley Fox global score: 50% Numbeo safety index + 50% homicide sub-score, with live police / official area data moving it by at most ±10. London 54 (band 3), Tokyo 86 (5), Paris 56 (3). The circle always shows the 1–5 band; the score is explained underneath with benchmarks.
- **fix:** the UK Numbeo panel was never cleared, so London's 55.3 / 44.7 appeared (often twice) on every city opened afterwards.
- **feat:** gov.uk FCDO advice on every city card; Numbeo panel shows global rank; Numbeo lookup normalises USA/UAE country names.

## 2026-11-04 (Homepage v2 reverted)

- **revert:** Barry preferred the light version, so `newhomepage/index.html` is restored from e7b80ae (cream, Fraunces + Inter, Medical ID section, 8-product grid). The console redesign remains in history at b203307.

## 2026-11-04 (Homepage v2: console redesign)

- **change:** `/newhomepage` restyled after getdesign.md (Barry's chosen reference, full design freedom): near-black canvas (#141416), Geist + Geist Mono, hairline-ruled panels, mono kickers and 01–08 numbering, sticky left section sidebar (desktop), light "scan page" mock in the hero, Wiley orange as the single action colour, rating colours kept for data, Medical yellow for the Medical ID section.
- **feat:** product range is now a searchable catalogue table of the 13 ACTIVE Shopify products with real prices from `new/phase2/shop.json`.
- **note:** this departs from the cream / Fraunces + Inter system in CLAUDE.md for this page only (approved by Barry, 4 Nov). Previous light version: commit e7b80ae.

## 2026-11-04 (Homepage: Medical ID + full tag range)

- **feat:** new **Medical ID bands** section on `/newhomepage` (yellow Medical ID · SOS band, sample scan card, who it's for, "not a medical device" disclaimer), plus Medical ID in the nav, pillars (now 8, incl. Travel & safety), FAQ, Free plan and footer.
- **feat:** product range now 8 cards: Medical ID bands, kids' slap bands, Guardian bands ("Scan to contact guardian"), SOS event wristbands, key fobs, pet & dog tags, smart stickers, school & event packs. New images: `medical-id-card.webp`, `guardian-band-card.webp`, `keyfob-front.webp`, `keyfob-back.webp`.
- **todo:** pet & dog tag card uses the key fob back (Wiley side) until a dedicated dog-tag photo is supplied.

## 2026-11-04 (New homepage draft at /newhomepage)

- **feat:** `newhomepage/index.html`, the new landing page for www.thewileyfox.com (single file, Fraunces + Inter, brand tokens, 900px breakpoint, no build). Sections: hero (Get your tag + Check a place, safety-check search), honest proof strip, six pillars, Family & child safety, Tags/bands/stickers, SOS & women's safety, Crime & safety checks, Know before you go (links to `/new/guides/*`), Travel & safety, Lost & found, Community, Pricing (Free / Pro £4), FAQ, Know Before You Go newsletter, footer. Images in `newhomepage/img/`.
- **feat:** every CTA deep-links into the app at `/new/phase2/#<view>` (map, people, tags, labels, places, travel, book, shop, account).
- **change:** `new/phase2/index.html` hash deep-linking now opens any rail view (`#map`, `#family`, `#tags`, ...), not just the four Phase 2 views. One-line change in the load IIFE; port it to `scripts/phase2/module.js` before the next rebuild or it will be overwritten.
- **note (claims):** proof stats are only what we can stand behind today (160+ cities with local intel, 9 official data sources, 1–5 rating, monthly UK refresh, no app needed to scan). Testimonials are labelled "example story" until real member stories exist (ASA/CAP). The live site's 94% / 2.4M / 180+ figures were deliberately not carried over.
- **dev hooks:** newsletter form has `data-endpoint` for Beehiiv; hero search passes `?q=` to `/new/phase2/` (the map doesn't read it yet); legal footer links are `#` placeholders.

## 2026-10-19 (Phase 2 rebuilt as the full /new app)

- **change:** `/new/phase2/` is now the whole `/new` app (map, people, inbox, tags, saved places, account, original shop and label-pack designer, guides) with the Phase 2 features added to the same rail, instead of a separate page. Generated by `scripts/phase2/build_phase2.py` from `new/index.html` + fragments in `scripts/phase2/` (`module.css`, `rail.html`, `views.html`, `shop.html`, `module.js`); every patch asserts its anchor so a `/new` change can't silently break it. Rebuild after any `/new` change.
- **feat:** links back to system features everywhere:
  - Book a trip → destination card with the live Wiley Fox rating, **Check safety on the map** (loads the city on the map), hotels/insurance for the city, and the city's travel guide.
  - Hotels → **View area on map** drops a pin and loads safety for that exact spot (street-level data.police.uk for UK hotels, council-area + neighbourhood map in Scotland, official area data elsewhere); **Save place** adds it to Saved places.
  - Every booking confirmation offers the travel guide (read free, or test-buy the printable PDF at £4.99; cities without a guide get "Request this guide"), the safety map, the next booking step and QR wristbands.
  - My travel → safety card and map button, guide card, hotel items with View on map / Save place (manual hotels are geocoded), and a "Before you go" list linking Your people, Account (SOS contact), Shop (wristbands, travel kit) and Saved places.
  - Name labels → "Who are they for" from the family group; each QR pack is added to **Tags & items** (`wf_mock_tags`) with a button to open it; links to wristbands, Medical ID and the family group.
- **feat:** www.thewileyfox.com on every product: printed under the QR on QR name labels (and in the printer job as `brand_url`), on every shop card, and appended to the description of all 21 Shopify products (13 active, 8 draft).
- **fix:** shop catalogue snapshot now includes the 3 bundles and the twin pack (21 products); Bundles filter added.

## 2026-10-19 (Phase 2 preview at /new/phase2)

- **feat:** new unlinked preview page `new/phase2/` (noindex; not linked from `/new`), same shell and tokens as `/new`. Four sections:
  - **Name labels** (working designer, test checkout): stick-on, iron-on, shoe, mini and allergy labels drawn to real size in mm; name, second line, allergy note, 3 brand fonts, 8 colours, 8 icons, optional Wiley Fox QR (real, scannable, one code per pack). Test checkout (UK postcode check) creates an order with a printer job file (JSON: SKU, size, artwork, QR URL, ship-to, service) and print-ready A4 SVG sheets; order status simulated Received → Sent to printer → Printed → Dispatched → Delivered. Warns if a phone number or address is typed onto a label. Orders in `localStorage` (`wf_p2_label_orders`). No payment, nothing sent to a printer.
  - **My travel** (working, on-device only): trips with travellers pulled from the `/new` family group (`wf_mock_family`) and account; itinerary (flights, hotels, other) sorted by date; passports per traveller with photo page (shrunk, stored in IndexedDB `wf_p2_docs`); medical notes per traveller; travel insurance and GHIC/health cover with certificate photo. Warnings: passport expiring before return or within 6 months, EU 10-year-issue rule, no insurance recorded. Wiley Fox rating for the destination. One-click wipe of all passport and medical data. Nothing uploaded.
  - **Book a trip** (test): flights, hotels and insurance quotes generated on the page (deterministic per search, fictional carriers and "Example Insurer A/B/C"); hotels show the Wiley Fox area band and a real "See prices on Booking.com" link through the CJ wrapper (`wfBook`, SID `wf-phase2`). Insurance tips per city (theft cover where the rating is 3 or lower, GHIC limits in Europe, US medical, declaring conditions, FCDO exclusions). Bookings and chosen policies drop into My travel.
  - **Shop**: Shopify catalogue snapshot (`new/phase2/shop.json`, 19 Oct) with basket; 9 live QR products plus the new **Travel Accessories** smart collection (tag `travel-accessory`) and 8 DRAFT placeholder products created in Shopify (cabin case, packing cubes, RFID wallet, adapter, luggage scale, TSA locks, pillow, anti-theft bag; supplier TBC). Store is password-protected until launch.

## 2026-10-19 (Scotland neighbourhood map)

- **feat:** Edinburgh, Glasgow, Aberdeen and Inverness now show a neighbourhood map in place of hexes: 1,719 data zones (about 500–1,000 residents each) shaded on the brand 1–5 palette by the SIMD 2020 crime indicator (recorded crime 2017/18 per 10,000 residents) against the Scotland rate (289.6), using the same curve as the official-area rating. Tap a zone for its name, rate and ratio. Inverness covers zones within 12 km of the centre (Highland is otherwise mostly rural). Files: `new/data/scotland-dz/<city>.json` (100–570 KB, loaded on demand); builder `scripts/official-area/build_scot_dz.py`.
- **note:** the city rating is unchanged (council-area figures for 2025-26). Zone figures are older and per resident, so city-centre zones read high; the card says so. SIMD 2026 (2022 data zones) is due later in 2026 — rebuild when it lands.

## 2026-10-16 (Phase 2 coverage: official area data + LA fix)

- **fix:** Los Angeles live map now reads LAPD NIBRS Offenses (`k7nn-b2ep`, Group A only). The old dataset (`2nrs-mtv8`) stopped on 30 Dec 2024, so the map had been showing 2024 incidents as the latest month. `US_CITY_APIS` entries can now carry `extraWhere`; `mapUSCategory` learns NIBRS abbreviations (GTA, BFMV, TFMV, ADW, pocket-picking).
- **feat:** area-level rating mode for cities without street data (`OFFICIAL_AREA`, `renderOfficialCity`). Official police-recorded rates for assault, robbery, burglary, theft and homicide vs the national average fill the 70% slot that live police data fills in the UK; Numbeo stays 30%. "City-level data, no street map" card, per-category table (city vs national per 100k), source + period on every card. Method in Dev Handoff §21.
- **feat:** Scotland: Edinburgh, Glasgow, Aberdeen, Inverness (council areas, Recorded Crime in Scotland 2025-26) added to the UK city list. Any search, map click or "my location" in Scotland now routes to official data instead of an empty data.police.uk call (`isScotlandCoords`, `loadScotland`); points away from the four cities show Scotland-wide figures.
- **feat:** Ireland: Dublin, Cork, Galway, Limerick (Eurostat NUTS 3 2024) with a provisional CSO Garda trend line (2026 H1 vs 2025 H1, not used in the rating).
- **feat:** France (SSMSI commune data 2025): Lyon, Marseille, Nice added; Paris and Strasbourg now rated from it. Italy (Eurostat provinces): Milan, Florence, Venice, Naples added; Rome rated from it. Barcelona, Amsterdam, Berlin, Munich, Cologne, Nuremberg, Lisbon, Vienna rated from Eurostat NUTS 3. Rating changes: Paris 4 → 3, Rome 4 → 3; all others unchanged. Prague keeps its Czech Statistical Office rating (not in `OFFICIAL_AREA`).
- **fix:** city search matched substrings (searching "Venice" would have opened Nice). Exact match first, then whole-word.
- **chore:** `scripts/official-area/` (builder, source snapshots, refresh README).
## 2026-10-16 (Guides approved: all ten live on /new)

- **feat:** Prague Christmas 2026 guide approved and published at `/new/guides/prague/` (web page, PDF, Word, 26 credited Commons photos), copied byte-for-byte from the preview site. `/new` map gets the Prague city-list entry (rating 4, Czech Statistical Office 2025 / Eurostat 2024) and its `GUIDE_LINKS` entry. Queue status set to done.
- **chore:** every guide on the preview site is now live on production `/new/guides/`: London, New York, Nuremberg, Munich, Cologne, Berlin, Chicago, Strasbourg, Vienna, Prague. Audit on 16 Oct: page HTML identical on preview, production and repo for all nine earlier guides; Munich's photos on preview are an older re-encode of the same images, production keeps the repo copies. "Draft / preview only" comments removed from `GUIDE_LINKS`.
- **ops:** backup before deploy — GitHub tag `backup-pre-guide-approval-2026-10-16` (= production as of a870a45) and a copy of the preview-only files in the Cowork folder `_archive/site_backup_2026-10-16/`. The preview site was not redeployed.

## 2026-10-14 (Prague)

- **feat:** Prague Christmas 2026 guide build script and source data (`scripts/city-guides/prague/`): 716 creator facts from 155 videos (79 creators credited), Czech Statistical Office 2025 crime tables (Prague 34,853 registered crimes, -9.3%; 2,492 per 100,000; violent 115 per 100,000), 2026 market dates from the organiser (trhypraha.cz), 2026 PID fares, airport transfer options (taxi cap ended 1 Oct 2026), Czech National Bank exchange rules. Czech-regions compare box. Rating 4 (Low), creator feeling 4. On preview only (`/guides/prague/`); new Prague city-list entry on preview (rating 4, homicide 0.7 Eurostat 2024).
- **ops:** discovery queue now Edinburgh, then Prague (review), Vienna and Strasbourg (done).

## 2026-10-08 (Vienna publish)

- **feat:** Vienna Christmas 2026 guide approved and live at `/new/guides/vienna/`; `/new` map links it (`GUIDE_LINKS`) and the Vienna city-list entry moves from 5 'Very safe' (Eurostat 2023) to 4 'Generally safe' (Bundeskriminalamt 2025, homicide 1.1 per 100,000). Queue status set to done.

## 2026-10-08 (Vienna)

- **feat:** Vienna Christmas 2026 guide build script and source data (`scripts/city-guides/vienna/`): 450 creator facts from 88 videos (50 creators credited), Bundeskriminalamt 2025 report (Vienna pickpocketing 5,448, -7.8%; all offences ~9,530 per 100,000, Wiley Fox calculation), LPD Wien weapon-ban orders, 2026 market dates from christkindlmarkt.at / wien.info / organisers, 2026 Wiener Linien fares and airport rail works. Austria-by-state compare box. Rating 4 (Low), creator feeling 5. On preview only (`/guides/vienna/`); preview map entry for Vienna changed from 5 'Very safe' (Eurostat 2023) to 4 'Generally safe' (BK 2025), pending approval.
- **ops:** discovery queue now Prague, Edinburgh, then Vienna (review) and Strasbourg (done).

## 2026-10-08 (Strasbourg publish)

- **feat:** Strasbourg Christmas 2026 guide approved and live at `/new/guides/strasbourg/`; `/new` map links it (`GUIDE_LINKS`) and adds the Strasbourg city-list entry (rating 3, SSMSI 2025). Queue status set to done.

## 2026-10-07 (affiliate links + review fixes)

- **feat:** Booking.com affiliate links live via CJ (publisher 101838202, ad 15734754). Guides: `scripts/city-guides/affiliate.py` wraps every Booking URL with SID `wf-xmas-<city>`; all 8 guides re-rendered (HTML, Word, PDF), London patched in place. `/new` map: `wfBook()` helper wraps all 22 Booking links (SID `wf-map`) plus a click-time safety net. Munich links match the CJ sheet exactly. Re-rendered guides diffed against live: only links and wording changed.
- **fix:** research shorthand "NOT VERIFIED" no longer reaches readers; renderers print "not yet confirmed" (Berlin, Chicago, Munich, Strasbourg).
- **fix (Strasbourg, preview):** Marché OFF pin moved to Place Grimmeissen, Petite France (OSM 48.5816, 7.7406) and removed from the Krutenau text; cathedral on 25 Dec now says sources differ (City: closed; cathedral feast-day hours 14:00-17:15); tram text no longer implies bank-card tap; security figure dated 2025; "street robbery" → "violent theft without a weapon"; Hotel Leonor tag "Close to the markets"; Gengenbach date marked likely; compare rows sorted by theft.

## 2026-10-06 (Strasbourg)

- **feat:** Strasbourg Christmas 2026 guide build script and source data (`scripts/city-guides/strasbourg/`): first French city. ~475 creator facts from 112 videos, SSMSI 2025 commune crime data with a custom French-cities comparison box (built in `build_guide.py`, not `make_compare.py`), Préfecture 2025 market security plan, verified 2026 dates (market opens 27 Nov) and 40 checked tips. Preview only (`/guides/strasbourg/`), new city-list entry on the preview map. New queue: Strasbourg, Vienna, Prague, Edinburgh.

## 2026-10-05 (Chicago publish)

- **feat:** Chicago Christmas 2026 guide approved and live at `/new/guides/chicago/`; `/new` map links it (`GUIDE_LINKS`) and the city list entry is updated (rating 2 -> 3, 'Stay aware', Chicago Police 2025 / Data Portal 2026).

## 2026-10-05 (Chicago)

- **feat:** Chicago Christmas 2026 guide build script and source data (`scripts/city-guides/chicago/`): 790 creator facts from 222 videos, Chicago Police 2025 review and Data Portal trends to 27 Sep 2026, street-level crime table and hex map from Data Portal records (Jun-Aug 2026, `crime_build.py`), verified 2026 Christmas dates, 33 checked tips. Preview only (`/guides/chicago/`); preview map entry updated (rating 2 -> 3, 'Stay aware', CPD 2025). Awaiting approval before `/new`.

## 2026-10-05 (publish)

- **feat:** Cologne, New York and Berlin Christmas 2026 guides approved and live at `/new/guides/<slug>/`. `/new` map: `GUIDE_LINKS` now points New York at `guides/new-york/` (old standalone HTML left in place) and adds Cologne and Berlin; city list adds Cologne and updates Berlin (rating 4 → 3, 'Stay aware', PKS 2025) and New York.

## 2026-10-05

- **feat:** Berlin Christmas 2026 guide build script and source data (`scripts/city-guides/berlin/`): PKS Berlin 2025, the seven kbO hotspots from 1 July 2026, knife-ban zones, Görlitzer Park court rulings, verified 2026 market dates, 33 checked tips. Guide is on the preview site only (`/guides/berlin/`), awaiting approval before `/new`. Two campaigning channels are excluded from creator credits via `EXCLUDE` in the build script.

## 2026-10-01

- **docs:** handoff v1.6 (§20 city content pipeline, guides and live advice); this changelog; README/DEPLOY/CLAUDE updated for the new endpoints, admin ops and guide workflow.
- **feat:** Munich Christmas 2026 guide replaced with the reviewed build (Sicherheitsreport 2025 figures, verified 2026 market dates, visually checked photos) and linked from the `/new` map (`GUIDE_LINKS` + city list).

## 2026-09-30

- feat: Munich Christmas 2026 guide live at /new/guides/munich/ (`7695e1a`)
- feat: Munich Christmas guide build script (`8898a69`)
- fix: guide cover subtitle no longer hidden behind the city name's descenders (`bff4841`)

## 2026-09-29

- feat: Cologne guide build script; sights heading counts items (`a39e6ea`)
- feat: city crime comparison box (Eurostat NUTS3 2024 / FBI CDE) in guides; Nuremberg updated (`9367843`)
- fix: Nuremberg guide - DB Museum photo shows the museum building (`05e1ef5`)
- fix: Nuremberg guide photos (DB Museum, station, St Lorenz, fountain, cover) (`2021f9f`)
- feat: Nuremberg Christmas 2026 guide live on /new; Nuremberg added to map city list (`cbb212b`)
- feat: city-guide template supports cities without street-level crime data (`ac7e9a8`)
- feat: focus-city discovery mode (`bb7da31`)

## 2026-09-28

- feat: single official advice source (live US State Dept) + 'What travellers say' panel (`74c3059`)
- fix: US city crime data blank for New York; rate US cities like the UK (`da3226d`)
- feat: reusable city-guide template (web/PDF/Word + Christmas chapter), NYC crime build, review ops (`bcd86f4`)
- feat: name clicked map points by suburb and focus the guide on that area (`b43f1e5`)
- feat: serve redesign + London guide at /new on live site (`bdd6ec4`)
- feat: live City guide panel in redesign prototype; faster Mac transcript fetch; Wikimedia attraction photos (`29e0eeb`)

## 2026-09-27

- feat: append-only city content database + daily YouTube discovery (`4ebce85`)

## 2026-09-23

- fix: swap Carto tiles for OpenFreeMap; move FBI key server-side (`a03e2db`)

## Before September 2026

See git history and the handoff changelog (§0). Key earlier milestones: Neon replaces Supabase for pipeline data (May 2026); unified prototype safety score and dev handoff v1.2 (June 2026).
