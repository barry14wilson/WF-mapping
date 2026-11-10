# Australian suburb / police-division crime layers

`build_au.py <state> <files>` → `new/data/australia/<state>.json`, read by `loadAggregateCity()`. Refreshed monthly by `scripts/refresh/refresh_layers.py`.

| Layer | Cities | Source | Unit | Period |
|---|---|---|---|---|
| nsw | Sydney | [BOCSAR SuburbData.zip](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html) | suburb, monthly | last 12 months |
| vic | Melbourne | [Crime Statistics Agency, LGA data tables (Table 03)](https://discover.data.vic.gov.au/dataset/data-tables-recorded-offences) | suburb, year ending | latest year ending |
| sa | Adelaide | [SAPOL crime statistics (data.sa.gov.au)](https://data.sa.gov.au/data/dataset/crime-statistics) | suburb, daily | financial year |
| qld | Brisbane, Gold Coast, Cairns | [QPS offences by division](https://www.data.qld.gov.au/dataset/offence-numbers-police-divisions-monthly-from-july-2001) + [QPS division boundaries](https://www.data.qld.gov.au/dataset/qps-divisions) | police division, monthly | last 12 months |

Suburb shapes: [ABS ASGS 2021 Suburbs and Localities](https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0). Each area's count is spread over points ~1.2 km apart inside it (QLD divisions ~1.8 km), so large areas don't draw as one hotspot. Kept categories: violence (incl. sexual offences, stalking), robbery, burglary, vehicle crime, theft, shoplifting, damage/arson, drugs, weapons, disorder. Fraud, justice-procedure and traffic offences are left out.

Not covered: Perth (WA Police publish suburb figures only in a Power BI dashboard; the downloadable file is by district), Canberra, Hobart, Darwin (no suburb-level download).
