# Houston crime data

Houston publishes crime as files, not an API, so it reaches Wiley Fox two ways.

| Piece | Source | What it feeds | Refresh |
|---|---|---|---|
| `build_hpd.py` → `new/data/houston/hpd_latest.json` | HPD monthly NIBRS file (`NIBRSPublicView<YEAR>.csv`), one row per offence with hundred-block street and map coordinates | Houston dots, hexes and rating on `/new` and `/new/phase2` (via `loadStaticUSCity`) | Monthly: run the script, then redeploy |
| `connectors/us-houston-hpd.js` (`npm run connector:houston`) | Same file | `crime_incidents` in Neon → H3 scoring → `/api/safety-tiles` | Netlify scheduled function `scheduled-us-houston` on the 20th of each month |
| Super Neighborhood panel (live, in the page) | City of Houston / HPD `HPD_Crime_Summary` ArcGIS layer, 2020–2024 counts by Super Neighborhood | The "Houston Super Neighborhood" card and outline on the map | Nothing to do; read live (CORS-enabled). Year is `HOU_SN_YEAR` in the page |
| Reporting links | Crime Stoppers of Houston (713-222-TIPS), Stop Houston Gangs, HPD crime data page | "Reporting a concern in Houston" card | Check links once a year |

Rules the build follows:
- Group A offences only. Group B (90x, arrest-only) and 09C (justifiable homicide) are dropped, the same as the Los Angeles NIBRS feed.
- The map shows the latest **complete** month: a month counts once it holds at least 85% of the median of the three before it. HPD posts late reports for weeks, so the newest month is usually short. As of Nov 2026 the file runs to June 2026 and the map shows May 2026.
- Houston's homicide input for the global score is **11.4 per 100k**: 272 murders (09A) in HPD's 2025 file ÷ 2,390,125 residents (US Census Bureau, 1 July 2024 estimate). Update `homicide` in `GLOBAL_CITIES` each January.
- HPD advises against comparing beats or areas directly, and Super Neighborhood counts aren't adjusted for population. The page says so next to the figures.

Caveat for the scheduled function: the yearly CSV grows to ~35 MB by December and scheduled functions have a short time limit. If a run times out, run `DRY_RUN=0 npm run connector:houston` from a machine with `DATABASE_URL` set.
