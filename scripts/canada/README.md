# Canadian crime layers

`build_ca.py vancouver <csv files>` / `build_ca.py ottawa [year]` → `new/data/canada/<city>.json`. Refreshed monthly by `scripts/refresh/refresh_layers.py`.

- **Vancouver:** [VPD GeoDASH open data](https://geodash.vpd.ca/opendata/), every incident at its 100-block (UTM 10N → lat/lng with pyproj); last 12 complete months. Offences against a person have no published location, so the card notes partial data.
- **Ottawa:** [Ottawa Police criminal offences](https://open.ottawa.ca/datasets/ottawa::criminal-offences-open-data) ([ArcGIS service](https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Criminal_Offences_Open_Data/FeatureServer/0)), one point per offence at the nearest intersection; published yearly (latest year used).

Not covered: Calgary (only social-disorder stats are open), Edmonton and Winnipeg (dashboards only, no download), Toronto/Montreal already live.
