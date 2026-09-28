import json, urllib.request, urllib.parse
BASE='https://data.cityofnewyork.us/resource/5uac-w243.json'
rows=[]; off=0
while True:
    q={'$select':'cmplnt_fr_dt,ofns_desc,pd_desc,latitude,longitude,prem_typ_desc,cmplnt_fr_tm','$where':"cmplnt_fr_dt between '2026-04-01T00:00:00' and '2026-06-30T23:59:59' and latitude is not null",'$limit':50000,'$offset':off,'$order':'cmplnt_num'}
    d=json.load(urllib.request.urlopen(BASE+'?'+urllib.parse.urlencode(q),timeout=120))
    rows+= [[r['cmplnt_fr_dt'][:7],r.get('ofns_desc',''),r.get('pd_desc',''),float(r['latitude']),float(r['longitude']),r.get('prem_typ_desc',''),r.get('cmplnt_fr_tm','')] for r in d]
    print(off,len(d)); off+=50000
    if len(d)<50000: break
json.dump(rows,open('nypd_2026q2.json','w'))
import collections; print(len(rows), collections.Counter(r[0] for r in rows)); print(collections.Counter(r[1] for r in rows).most_common(25))
