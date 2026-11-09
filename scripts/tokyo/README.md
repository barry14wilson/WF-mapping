# Tokyo street-block crime layer

`build_tokyo.py` → `new/data/tokyo/mpd_chome.json`, read by `loadAggregateCity()` on `/new` and `/new/phase2`.

- **Counts:** Tokyo Metropolitan Police Department, *区市町村の町丁別、罪種別及び手口別認知件数* — recorded offences per street block (町丁目) by crime type, cumulative for the year: https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html (`R8.csv` = 2026 to date).
- **Block centres:** MLIT 位置参照情報, 大字・町丁目レベル, Tokyo (`13000-<ver>.zip` → `13_<year>.csv`): https://nlftp.mlit.go.jp/isj/
- Ward/city total rows are skipped; 99.6% of offences are placed (Jan–Sep 2026). The page shows a monthly average (`months`).

Refresh monthly (MPD posts mid-month): download the newest `R8.csv`, then
`python3 scripts/tokyo/build_tokyo.py R8.csv 13_2024.csv --months <months covered> --period "Jan–<Mon> 2026"` and redeploy.
In January switch to the new year's file (R9 = 2027).
