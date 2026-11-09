#!/usr/bin/env python3
"""Build a prefecture's street-crime layer from the national 犯罪オープンデータ format.

Prefectural police across Japan publish the same seven street crimes per year, one CSV each
(ひったくり, 車上ねらい, 部品ねらい, 自動販売機ねらい, 自動車盗, オートバイ盗, 自転車盗), one row per
incident with the municipality and street block (町丁目). Index of publishers:
https://www.npa.go.jp/toukei/seianki/hanzaiopendatalink.html

Block centres: MLIT 位置参照情報 (大字・町丁目レベル) for the prefecture, https://nlftp.mlit.go.jp/isj/

Output new/data/japan/<pref>.json, rows [lat, lng, categoryIndex, count], months = 12.
These cover theft-type street crime only, so the map shows them but the city rating stays on
its global baseline (US_CITY_APIS entry sets baselineOnly).

Usage: python3 scripts/japan/build_japan_pref.py osaka 2025 <isj csv> <crime csv> [<crime csv> ...]
Refresh each summer when the prefectures publish the previous year.
"""
import csv, io, json, os, re, sys, collections, datetime as dt

CAT = {'ひったくり': 'theft-from-the-person', '車上ねらい': 'vehicle-crime', '部品ねらい': 'vehicle-crime',
       '自動車盗': 'vehicle-crime', 'オートバイ盗': 'vehicle-crime', '自動販売機ねらい': 'other-theft', '自転車盗': 'bicycle-theft'}
KANJI = '〇一二三四五六七八九'
def kanji_num(n):
    n = int(n)
    if n < 10: return KANJI[n]
    if n < 20: return '十' + (KANJI[n % 10] if n % 10 else '')
    return KANJI[n // 10] + '十' + (KANJI[n % 10] if n % 10 else '')
def norm(s):
    s = (s or '').translate(str.maketrans('０１２３４５６７８９', '0123456789')).replace('ヶ', 'ケ').replace('　', '').replace(' ', '').strip()
    return re.sub(r'(\d+)丁目', lambda m: kanji_num(m.group(1)) + '丁目', s)
def read(path):
    b = open(path, 'rb').read()
    for enc in ('utf-8-sig', 'cp932'):
        try: return list(csv.DictReader(io.StringIO(b.decode(enc))))
        except UnicodeDecodeError: pass
    raise SystemExit('cannot decode ' + path)

def main():
    pref, year, isj, files = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
    pts, by_town = {}, collections.defaultdict(list)
    b = open(isj, 'rb').read()
    for enc in ('cp932', 'utf-8-sig'):
        try: rows = list(csv.reader(io.StringIO(b.decode(enc)))); break
        except UnicodeDecodeError: pass
    names = collections.defaultdict(dict)   # municipality → {block name: point}
    for r in rows[1:]:
        lat, lng = float(r[6]), float(r[7])
        key = norm(r[3] + r[5]); pts[key] = (lat, lng)
        names[norm(r[3])][norm(r[5])] = (lat, lng)
        by_town[re.sub(r'[一二三四五六七八九十]+丁目$', '', key)].append((lat, lng))
    muni_list = sorted(names, key=len, reverse=True)
    def find_muni(m):
        if m in names: return m
        return next((x for x in muni_list if x.endswith(m)), None)   # e.g. '豊山町' → '西春日井郡豊山町'
    def locate(m, blk):
        mm = find_muni(m)
        if not mm or not blk: return None, 'unplaced'
        if blk in names[mm]: return names[mm][blk], 'block'
        b2 = blk.replace('大字', '')
        if b2 in names[mm]: return names[mm][b2], 'block'
        cands = sorted(names[mm], key=len, reverse=True)
        # Kyoto street-direction addresses end with the town: '西木屋町通三条下る山崎町' → '山崎町'
        hit = next((c for c in cands if len(c) >= 2 and b2.endswith(c)), None)
        if hit: return names[mm][hit], 'suffix'
        # aza / sub-district detail after the town: '六軒屋町字東丘' → '六軒屋町'
        hit = next((c for c in cands if len(c) >= 2 and b2.startswith(c)), None)
        if hit: return names[mm][hit], 'prefix'
        town = by_town.get(re.sub(r'[一二三四五六七八九十]+丁目$', '', mm + b2))
        if town: return (sum(x for x, _ in town) / len(town), sum(y for _, y in town) / len(town)), 'town'
        return None, 'unplaced'
    agg = collections.Counter(); total = placed = 0; method = collections.Counter()
    for f in files:
        for r in read(f):
            cat = CAT.get((r.get('手口') or '').strip())
            if not cat: continue
            total += 1
            muni = norm(r.get('市区町村（発生地）') or ''); blk = norm(r.get('町丁目（発生地）') or '')
            p, how = locate(muni, blk)
            method[how] += 1
            if not p: continue
            agg[(round(p[0], 5), round(p[1], 5), cat)] += 1; placed += 1
    cats = sorted(set(CAT.values()))
    out = [[la, ln, cats.index(c), n] for (la, ln, c), n in agg.items()]
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'japan', f'{pref}.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump({'source': f'{pref.title()} Prefectural Police — 犯罪オープンデータ {year} (7 street crimes)',
               'source_url': 'https://www.npa.go.jp/toukei/seianki/hanzaiopendatalink.html',
               'points_source': 'MLIT 位置参照情報 block representative points', 'period': year, 'months': 12,
               'generated': dt.date.today().isoformat(), 'types': 'bag snatching, car break-ins, car-part theft, vending-machine theft, car theft, motorbike theft, bike theft',
               'note': 'Street-crime incidents placed at their street block centre (not exact locations).', 'cats': cats, 'rows': out},
              open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{pref}: {total} incidents, placed {placed} ({placed/total:.1%}) [{dict(method)}]; rows {len(out)}; {os.path.getsize(path)//1024} KB')

if __name__ == '__main__':
    main()
