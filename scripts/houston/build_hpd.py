#!/usr/bin/env python3
"""Build the Houston crime file the map reads (new/data/houston/hpd_latest.json).

Source: Houston Police Department, "Monthly Crime Data by Street and Police Beat"
  https://houstontx.gov/police/cs/Monthly_Crime_Data_by_Street_and_Police_Beat.htm
  One CSV per year (NIBRSPublicView<YEAR>.csv). Each row is one NIBRS offence with
  hundred-block street, beat, premise and map coordinates. Public, no key.

What it writes:
  * The latest COMPLETE month (a month counts as complete once it holds at least
    85% of the median of the three months before it; HPD posts late reports for
    weeks, so the newest month is usually short).
  * Group A offences only (Group B are arrest-only and 'N' rows are not crimes),
    the same rule the map uses for Los Angeles NIBRS data.
  * Compact rows: [lat, lng, category index, day of month, description index, street index].

Usage:  python3 scripts/houston/build_hpd.py            # downloads the current year
        python3 scripts/houston/build_hpd.py --csv f.csv # use a file you already have
Refresh monthly (HPD posts 1–4 weeks after month end), then redeploy.
"""
import argparse, csv, datetime as dt, io, json, os, statistics, sys, urllib.request
from collections import Counter

BASE = 'https://houstontx.gov/police/cs/xls/NIBRSPublicView{year}.csv'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'new', 'data', 'houston', 'hpd_latest.json')

# NIBRS offence code -> Wiley Fox map category (same keys as data.police.uk).
CAT = {
    '09A': 'violent-crime', '09B': 'violent-crime', '13A': 'violent-crime', '13B': 'violent-crime',
    '13C': 'violent-crime', '100': 'violent-crime', '64A': 'violent-crime', '64B': 'violent-crime',
    '11A': 'violent-crime', '11B': 'violent-crime', '11C': 'violent-crime', '11D': 'violent-crime',
    '36A': 'violent-crime', '36B': 'violent-crime',
    '120': 'robbery', '520': 'possession-of-weapons', '220': 'burglary',
    '240': 'vehicle-crime', '23F': 'vehicle-crime', '23G': 'vehicle-crime',
    '23A': 'theft-from-the-person', '23B': 'theft-from-the-person',
    '23C': 'shoplifting', '23D': 'other-theft', '23E': 'other-theft', '23H': 'other-theft',
    '200': 'criminal-damage-arson', '290': 'criminal-damage-arson',
    '35A': 'drugs', '35B': 'drugs',
}
GROUP_B_OR_N = lambda code: code.startswith('90') or code in ('09C',)


def read_rows(args):
    if args.csv:
        return list(csv.DictReader(open(args.csv, encoding='utf-8-sig')))
    year = dt.date.today().year
    rows = []
    for y in (year - 1, year) if dt.date.today().month <= 2 else (year,):
        req = urllib.request.Request(BASE.format(year=y), headers={'User-Agent': 'WileyFox-data-build'})
        with urllib.request.urlopen(req, timeout=300) as r:
            rows += list(csv.DictReader(io.TextIOWrapper(r, encoding='utf-8-sig')))
    return rows


def latest_complete_month(rows):
    counts = Counter(r['Occurrence Date'][:7] for r in rows if r.get('Occurrence Date'))
    months = sorted(m for m in counts if counts[m] > 100)
    for i in range(len(months) - 1, 2, -1):
        prev = statistics.median(counts[m] for m in months[i - 3:i])
        if counts[months[i]] >= 0.85 * prev:
            return months[i], counts
    return months[-1], counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()

    rows = read_rows(args)
    month, counts = latest_complete_month(rows)
    cats = sorted(set(CAT.values())) + ['other-crime']
    descs, streets, out = [], [], []
    di, si = {}, {}
    for r in rows:
        if not r['Occurrence Date'].startswith(month):
            continue
        code = (r['NIBRS Class'] or '').strip()
        if not code or GROUP_B_OR_N(code):
            continue
        try:
            lat, lng = round(float(r['Map Latitude']), 5), round(float(r['Map Longitude']), 5)
        except (TypeError, ValueError):
            continue
        if not (29.0 < lat < 30.5 and -96.2 < lng < -94.7):
            continue
        cat = CAT.get(code, 'other-crime')
        desc = (r['NIBRS Description'] or '').strip()
        street = ' '.join(x for x in (r['Street Number'], r['Street Name'], r['Street Type'], r['Street Suffix']) if x and x.strip()).strip().title()
        if desc not in di: di[desc] = len(descs); descs.append(desc)
        if street not in si: si[street] = len(streets); streets.append(street)
        for _ in range(max(1, int(r.get('Offense Count') or 1))):
            out.append([lat, lng, cats.index(cat), int(r['Occurrence Date'][8:10]), di[desc], si[street]])

    payload = {
        'source': 'Houston Police Department — NIBRS monthly crime data (Group A offences)',
        'source_url': 'https://houstontx.gov/police/cs/Monthly_Crime_Data_by_Street_and_Police_Beat.htm',
        'month': month,
        'generated': dt.date.today().isoformat(),
        'note': 'Street to the hundred block; HPD advises against comparing beats directly.',
        'cats': cats, 'descs': descs, 'streets': streets,
        'rows': out,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(payload, f, separators=(',', ':'))
    print(f'month={month} offences={len(out)} (month rows {counts[month]}) -> {os.path.relpath(args.out)} {os.path.getsize(args.out)//1024} KB')


if __name__ == '__main__':
    sys.exit(main())
