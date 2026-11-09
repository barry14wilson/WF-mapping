#!/usr/bin/env python3
"""Build Tokyo's street-block (chome) crime layer: new/data/tokyo/mpd_chome.json

Sources
  * Crime counts: Tokyo Metropolitan Police Department (警視庁) "区市町村の町丁別、罪種別及び手口別認知件数"
    https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html
    R8.csv = Reiwa 8 (2026), cumulative year to date, recorded offences per 町丁目 (street block) by crime type.
  * Block centre points: MLIT 位置参照情報 (大字・町丁目レベル), Tokyo, https://nlftp.mlit.go.jp/isj/
    e.g. 13000-18.0b.zip → 13_2024.csv (lat/lng of each 町丁目 representative point).

Output rows: [lat, lng, categoryIndex, count] — one row per block × Wiley Fox category, so the
page can draw hexes and rate a 1-mile area. `months` = months covered by the year-to-date file.

Usage: python3 scripts/tokyo/build_tokyo.py R8.csv 13_2024.csv --months 9
Refresh monthly when MPD posts the next cumulative file (also update --months).
"""
import argparse, csv, io, json, os, re, collections, datetime as dt

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'tokyo', 'mpd_chome.json')

# MPD column → Wiley Fox category (data.police.uk keys used across the map)
COLS = {
    '凶悪犯強盗': 'robbery', '凶悪犯その他': 'violent-crime',            # robbery; murder, arson, rape
    '粗暴犯凶器準備集合': 'public-order', '粗暴犯暴行': 'violent-crime', '粗暴犯傷害': 'violent-crime',
    '粗暴犯脅迫': 'violent-crime', '粗暴犯恐喝': 'violent-crime',
    '侵入窃盗金庫破り': 'burglary', '侵入窃盗学校荒し': 'burglary', '侵入窃盗事務所荒し': 'burglary', '侵入窃盗出店荒し': 'burglary',
    '侵入窃盗空き巣': 'burglary', '侵入窃盗忍込み': 'burglary', '侵入窃盗居空き': 'burglary', '侵入窃盗その他': 'burglary',
    '非侵入窃盗自動車盗': 'vehicle-crime', '非侵入窃盗オートバイ盗': 'vehicle-crime', '非侵入窃盗車上ねらい': 'vehicle-crime',
    '非侵入窃盗自転車盗': 'bicycle-theft', '非侵入窃盗自販機ねらい': 'other-theft', '非侵入窃盗工事場ねらい': 'other-theft',
    '非侵入窃盗すり': 'theft-from-the-person', '非侵入窃盗ひったくり': 'theft-from-the-person', '非侵入窃盗置引き': 'other-theft',
    '非侵入窃盗万引き': 'shoplifting', '非侵入窃盗その他': 'other-theft',
    'その他詐欺': 'other-crime', 'その他占有離脱物横領': 'other-theft', 'その他その他知能犯': 'other-crime',
    'その他賭博': 'other-crime', 'その他その他刑法犯': 'other-crime',
}
KANJI = '〇一二三四五六七八九'
def kanji_num(n):
    n = int(n)
    if n < 10: return KANJI[n]
    if n < 20: return '十' + (KANJI[n % 10] if n % 10 else '')
    return KANJI[n // 10] + '十' + (KANJI[n % 10] if n % 10 else '')

def norm(name):
    """MPD '千代田区飯田橋１丁目' → '千代田区飯田橋一丁目' (MLIT spelling)."""
    s = name.translate(str.maketrans('０１２３４５６７８９', '0123456789')).replace('ヶ', 'ケ').replace('　', '').strip()
    return re.sub(r'(\d+)丁目', lambda m: kanji_num(m.group(1)) + '丁目', s)

def read(path):
    b = open(path, 'rb').read()
    for enc in ('utf-8-sig', 'cp932'):
        try: return list(csv.reader(io.StringIO(b.decode(enc))))
        except UnicodeDecodeError: pass
    raise SystemExit('cannot decode ' + path)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mpd'); ap.add_argument('isj'); ap.add_argument('--months', type=int, required=True)
    ap.add_argument('--period', default=''); ap.add_argument('--out', default=OUT)
    a = ap.parse_args()

    pts, by_town, munis = {}, collections.defaultdict(list), set()
    for r in read(a.isj)[1:]:
        munis.add(r[3])
        key = (r[3] + r[5]).replace('ヶ', 'ケ')
        lat, lng = float(r[6]), float(r[7])
        pts[key] = (lat, lng)
        by_town[r[3] + re.sub(r'[一二三四五六七八九十]+丁目$', '', r[5]).replace('ヶ', 'ケ')].append((lat, lng))

    rows = read(a.mpd); head = rows[0]
    cats = sorted(set(COLS.values()))
    out, matched, unmatched, total, lost = [], 0, 0, 0, 0
    for r in rows[1:]:
        if not r or not r[0] or r[0].endswith(('計', '不明')): continue
        key = norm(r[0])
        if key in munis: continue  # ward / city total rows (e.g. '新宿区') duplicate the block rows
        p = pts.get(key)
        if not p:  # fall back to the town's centre (all its chome averaged)
            town = by_town.get(re.sub(r'[一二三四五六七八九十]+丁目$', '', key))
            if town: p = (sum(x for x, _ in town) / len(town), sum(y for _, y in town) / len(town))
        n_row = sum(int(r[i] or 0) for i, h in enumerate(head) if h in COLS)
        total += n_row
        if not p: unmatched += 1; lost += n_row; continue
        matched += 1
        agg = collections.Counter()
        for i, h in enumerate(head):
            if h in COLS and r[i] and int(r[i]): agg[COLS[h]] += int(r[i])
        for c, n in agg.items(): out.append([round(p[0], 5), round(p[1], 5), cats.index(c), n])

    payload = {
        'source': 'Tokyo Metropolitan Police Department — recorded offences by street block (町丁目) and crime type',
        'source_url': 'https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html',
        'points_source': 'MLIT 位置参照情報 (block representative points), https://nlftp.mlit.go.jp/isj/',
        'period': a.period, 'months': a.months, 'generated': dt.date.today().isoformat(),
        'note': 'Counts are per street block, placed at the block centre (not exact locations).',
        'cats': cats, 'rows': out,
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(payload, open(a.out, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'blocks matched {matched}, unmatched {unmatched} ({lost} of {total} offences = {lost/total:.1%} not placed); rows {len(out)}; {os.path.getsize(a.out)//1024} KB')

if __name__ == '__main__':
    main()
