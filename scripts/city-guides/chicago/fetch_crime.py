import json, urllib.request, urllib.parse, collections
BASE='https://data.cityofchicago.org/resource/ijzp-q8t2.json'
rows=[]; off=0
while True:
    q={'$select':'date,primary_type,description,latitude,longitude,location_description','$where':"date between '2026-06-01T00:00:00' and '2026-08-31T23:59:59' and latitude is not null",'$limit':50000,'$offset':off,'$order':'id'}
    d=json.load(urllib.request.urlopen(BASE+'?'+urllib.parse.urlencode(q),timeout=180))
    rows+=[[r['date'][:7],r.get('primary_type',''),r.get('description',''),float(r['latitude']),float(r['longitude']),r.get('location_description',''),r['date'][11:16]] for r in d]
    print(off,len(d)); off+=50000
    if len(d)<50000: break
json.dump(rows,open('cpd_2026_jja.json','w'))
print(len(rows), collections.Counter(r[0] for r in rows)); print(collections.Counter(r[1] for r in rows).most_common(30))
