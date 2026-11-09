# Dutch neighbourhood (buurt) crime layer

`build_nl.py` → `new/data/netherlands/nl_buurt.json` (Amsterdam, Rotterdam, The Hague, Utrecht), read by `loadAggregateCity()`.

- **Counts:** Politie / CBS open data **47022NED**, registered crimes by type, neighbourhood and month: https://data.politie.nl/#/Politie/nl/dataset/47022NED (OData feed `https://dataderden.cbs.nl/ODataFeed/odata/47022NED/`).
- **Neighbourhood centres:** CBS/PDOK Wijk- en Buurtkaart WFS (`https://service.pdok.nl/cbs/wijkenbuurten/<year>/wfs/v1_0`), polygon centroids.
- Averages the latest 3 final months. Kept: burglary, vehicle/bike theft, pickpocketing, violence, robbery, damage, shoplifting, drugs, weapons, public order. Dropped: road accidents, relationship disputes, environmental, traffic/DUI, fraud, cyber, immigration.

Refresh monthly: `python3 scripts/netherlands/build_nl.py` (works from the cloud container), then redeploy. Add a city by adding its CBS municipality code to `CITIES`.
