# Japanese prefectural street-crime layers

`build_japan_pref.py <pref> <year> <MLIT isj csv> <7 crime csvs>` → `new/data/japan/<pref>.json`.

Prefectural police publish the same seven street crimes every year (ひったくり, 車上ねらい, 部品ねらい, 自動販売機ねらい, 自動車盗, オートバイ盗, 自転車盗), one row per incident with the street block. Index: https://www.npa.go.jp/toukei/seianki/hanzaiopendatalink.html

| Layer | City on the map | Source |
|---|---|---|
| osaka | Osaka | https://www.police.pref.osaka.lg.jp/seikatsu/24614.html |
| kyoto | Kyoto | https://data.bodik.jp/organization/260002 (BODIK CKAN) |
| hyogo | Kobe | https://web.pref.hyogo.lg.jp/kk26/johoseisaku/opendata.html |
| aichi | Nagoya | https://www.pref.aichi.jp/police/anzen/toukei/opendata/seian-s/crimeopendata.html |
| fukuoka | Fukuoka | https://data.bodik.jp/organization/400009 (BODIK CKAN) |

Block centres: MLIT 位置参照情報, `<pref code>000-18.0b.zip` from https://nlftp.mlit.go.jp/isj/ (Osaka 27, Kyoto 26, Hyogo 28, Aichi 23, Fukuoka 40).
Matching handles Kyoto's street-direction addresses (…通…下る○○町 → ○○町), 大字/字 sub-districts and 郡-prefixed towns; 94–99.5% of 2025 incidents are placed.

These are theft-type crimes only, so the US_CITY_APIS entries set `baselineOnly: true`: the map shows the data and the card says so, but the rating stays on the city's global baseline.
Refresh each summer when the previous year is published. Tokyo has richer data (all crime types, monthly): see `scripts/tokyo/`.
