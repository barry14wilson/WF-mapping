# US cities from area-coded or file-based crime data

`build_us_areas.py <city> [file]` → `new/data/us/<city>.json`. Refreshed monthly by `scripts/refresh/refresh_layers.py`.

| City | Source | Placed by |
|---|---|---|
| Austin | [APD crime reports (Socrata fdj4-gpfu)](https://data.austintexas.gov/Public-Safety/Crime-Reports/fdj4-gpfu) | census block group centre ([TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10)); Part I offences only |
| Louisville | [LMPD crime data (ArcGIS crime_data_<year>)](https://louisville-metro-opendata-lojic.hub.arcgis.com/) | ZIP code, spread across the ZCTA ([TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2)) |
| Phoenix | [Phoenix PD crime data CSV](https://www.phoenixopendata.com/dataset/crime-data) | ZIP code, spread across the ZCTA; latest full year |
| Milwaukee | [MPD WIBR CSV](https://data.milwaukee.gov/dataset/wibr) | reported address (lat/lng in the file) |

NIBRS codes map to the map's categories in `nibrs()`; fraud and Group B offences are left out.
