# Official area-level crime data (Phase 2 coverage)

Feeds `OFFICIAL_AREA` in `new/index.html`: area-level ratings for cities with no street-level feed
(Scotland, Ireland, France, Italy and the other European cities in `GLOBAL_CITIES`). Method in Dev Handoff §21.

| File in `data/` | Source | Fetch |
|---|---|---|
| `eu_by_year.json` | Eurostat `crim_gen_reg`, per 100k, 2023 + 2024 | Eurostat API (works from the cloud) — same parser as `scripts/city-guides/data/eu_fetch.py`, keeping both years |
| `cjq10.json` | CSO CJQ10, Garda division quarterly (new operating model, 2025 Q1 on) | `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CJQ10/JSON-stat/2.0/en` |
| `scot.csv`, `scot_counts.csv` | statistics.gov.scot `recorded-crime`, ratio (per 10k) and counts by council area | SPARQL at `https://statistics.gov.scot/sparql.csv` — **run on the Mac** (blocked from cloud IPs) |
| `fr.json` | SSMSI base communale + départementale 2025, data.gouv.fr | download the communal `.csv.gz` and departmental `.csv` — **run on the Mac** — then filter to the five cities and national totals |

Then `python3 build_official.py` writes `data/official_area.json` and `data/official_data.js`; paste the JS block over
`const OFFICIAL_AREA = {...};` in `new/index.html`. Refresh: Scotland each September (annual bulletin), France each July,
Eurostat each summer, CSO quarterly. A good fit for a quarterly scheduled task.
