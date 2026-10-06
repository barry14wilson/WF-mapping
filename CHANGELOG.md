# Changelog

All notable changes to the WF-mapping repo. Newest first. Dates are commit dates (UTC). Design and architecture notes live in `Wiley-Fox-Dev-Handoff-v1.md` (§20 covers September 2026).

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
