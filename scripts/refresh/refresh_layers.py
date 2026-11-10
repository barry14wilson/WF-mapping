#!/usr/bin/env python3
"""Monthly refresh of the area/file-based crime layers (run by the scheduled task, or by hand).

Downloads each source into a temp folder, rebuilds its layer under new/data/, and prints one line per
layer. A failed source is reported and skipped; the old file stays in place. After it runs: check the
summary, update CHANGELOG.md, commit, deploy (see DEPLOY.md / handoff §25).

Covered (fetchable from a cloud machine):
  australia nsw, vic, sa, qld · canada vancouver, ottawa · us austin, louisville, phoenix, milwaukee · netherlands
Yearly / manual (not here): Berlin (spring), Japan prefectures (summer; Osaka and Saitama block cloud downloads,
fetch from the Mac), Tokyo (monthly cumulative R8.csv + --months), Houston (its own scheduled function).

Usage: python3 scripts/refresh/refresh_layers.py [layer ...]     (default: all)
"""
import json, os, shutil, subprocess, sys, tempfile, urllib.request as U, zipfile, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PY = [sys.executable, '-I']
UA = {'User-Agent': 'Mozilla/5.0 (WileyFox data refresh)'}

def fetch(url, path, t=600):
    # curl follows cross-host redirects to signed S3 links (Milwaukee) that urllib gets a 403 on
    subprocess.run(['curl', '-sS', '-L', '--fail', '--retry', '3', '-m', str(t), '-A', UA['User-Agent'], '-o', path, url], check=True)
    return path
def ckan(base, pkg):
    return json.load(U.urlopen(U.Request(f'{base}/api/3/action/package_show?id={pkg}', headers=UA), timeout=120))['result']['resources']
def run(*args):
    out = subprocess.run(PY + list(args), cwd=ROOT, capture_output=True, text=True, timeout=3600)
    if out.returncode: raise RuntimeError(out.stderr[-800:])
    return out.stdout.strip().splitlines()[0] if out.stdout.strip() else ''

def nsw(d):
    z = fetch('https://bocsarblob.blob.core.windows.net/bocsar-open-data/SuburbData.zip', f'{d}/nsw.zip')
    zipfile.ZipFile(z).extractall(d)
    return run('scripts/australia/build_au.py', 'nsw', glob.glob(f'{d}/SuburbData*.csv')[0])
def vic(d):
    res = [r for r in ckan('https://discover.data.vic.gov.au', 'data-tables-recorded-offences') if 'LGA' in r['name']]
    return run('scripts/australia/build_au.py', 'vic', fetch(res[-1]['url'], f'{d}/vic.xlsx'))
def sa(d):
    res = [r for r in ckan('https://data.sa.gov.au/data', 'crime-statistics') if r['name'].startswith('Crime Statistics')]
    res.sort(key=lambda r: r['name']); return run('scripts/australia/build_au.py', 'sa', fetch(res[-1]['url'], f'{d}/sa.csv'))
def qld(d):
    c = fetch('https://open-crime-data.s3-ap-southeast-2.amazonaws.com/Crime%20Statistics/division_Reported_Offences_Number.csv', f'{d}/qld.csv')
    zipfile.ZipFile(fetch('https://open-crime-data.s3-ap-southeast-2.amazonaws.com/document/QPS_DIVISIONS.zip', f'{d}/qdiv.zip')).extractall(f'{d}/qdiv')
    return run('scripts/australia/build_au.py', 'qld', c, glob.glob(f'{d}/qdiv/*.shp')[0])
def vancouver(d):
    import datetime as dt
    files = []
    for y in (dt.date.today().year - 1, dt.date.today().year):
        z = fetch(f'https://geodash.vpd.ca/opendata/crimedata_download/AllNeighbourhoods_{y}/crimedata_csv_AllNeighbourhoods_{y}.zip', f'{d}/van{y}.zip')
        zipfile.ZipFile(z).extractall(f'{d}/van{y}'); files += glob.glob(f'{d}/van{y}/*.csv')
    return run('scripts/canada/build_ca.py', 'vancouver', *files)
def ottawa(d): return run('scripts/canada/build_ca.py', 'ottawa')
def austin(d): return run('scripts/us-areas/build_us_areas.py', 'austin')
def louisville(d): return run('scripts/us-areas/build_us_areas.py', 'louisville')
def phoenix(d):
    url = [r['url'] for r in ckan('https://www.phoenixopendata.com', 'crime-data') if r['url'].endswith('.csv')][0]
    return run('scripts/us-areas/build_us_areas.py', 'phoenix', fetch(url, f'{d}/phx.csv'))
def milwaukee(d):
    url = [r['url'] for r in ckan('https://data.milwaukee.gov', 'wibr') if r['url'].endswith('.csv')][0]
    return run('scripts/us-areas/build_us_areas.py', 'milwaukee', fetch(url, f'{d}/wibr.csv'))
def netherlands(d): return run('scripts/netherlands/build_nl.py')

LAYERS = dict(nsw=nsw, vic=vic, sa=sa, qld=qld, vancouver=vancouver, ottawa=ottawa, austin=austin, louisville=louisville,
              phoenix=phoenix, milwaukee=milwaukee, netherlands=netherlands)

if __name__ == '__main__':
    pick = sys.argv[1:] or list(LAYERS)
    ok = 0
    for name in pick:
        d = tempfile.mkdtemp(prefix=f'wf-{name}-')
        try: print(f'OK   {name}: {LAYERS[name](d)}'); ok += 1
        except Exception as e: print(f'FAIL {name}: {type(e).__name__}: {str(e)[-300:]}')
        finally: shutil.rmtree(d, ignore_errors=True)
    print(f'{ok}/{len(pick)} layers refreshed')
