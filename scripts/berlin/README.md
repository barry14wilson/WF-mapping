# Berlin district-region crime layer

`build_berlin.py` → `new/data/berlin/kriminalitaetsatlas.json`, read by `loadAggregateCity()`.

- **Counts:** Polizei Berlin, *Kriminalitätsatlas Berlin*: offences per Bezirksregion (143 areas), 2016–2025: https://daten.berlin.de/datensaetze/kriminalitatsatlas-berlin (file `fallzahlen_hz-2016-2025.xlsx`, sheet `Fallzahlen_<year>`).
- **Areas:** Geoportal Berlin LOR 2021 WFS `https://gdi.berlin.de/services/wfs/lor_2021`, layer `a_lor_plr_2021` (542 Planungsräume).
- Each region's count is spread across its planning areas in proportion to area, so a region doesn't draw as one hotspot. This is presentation, not finer data.
- Kept: robbery, assault/threats, vehicle theft, bike theft, residential burglary, other theft, arson/criminal damage, drugs. Fraud and other offences without a meaningful location are left out. "Nicht zuzuordnen" rows (offences police couldn't place, ~73k) are skipped.

Refresh yearly (the police publish the previous year around spring):
`python3 scripts/berlin/build_berlin.py fallzahlen_hz-2016-<year>.xlsx plr.json --year <year>`, then redeploy.
