# Changelog

All notable changes to the WF-mapping repo. Newest first. Dates are commit dates (UTC). Design and architecture notes live in `Wiley-Fox-Dev-Handoff-v1.md` (§20 covers September 2026).

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
