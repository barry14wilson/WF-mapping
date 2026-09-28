import json, math, collections
rows=json.load(open('nypd_2026q2.json'))
EXCL={'VEHICLE AND TRAFFIC LAWS','INTOXICATED & IMPAIRED DRIVING','ADMINISTRATIVE CODE','OFFENSES AGAINST PUBLIC ADMINI','OTHER STATE LAWS','OTHER STATE LAWS (NON PENAL LA','NYS LAWS-UNCLASSIFIED FELONY','AGRICULTURE & MRKTS LAW-UNCLASSIFIED'}
def cat(o):
    if o in ('FELONY ASSAULT','ASSAULT 3 & RELATED OFFENSES','SEX CRIMES','RAPE','MURDER & NON-NEGL. MANSLAUGHTER','KIDNAPPING & RELATED OFFENSES','HOMICIDE-NEGLIGENT,UNCLASSIFIE'): return 'Violence'
    if o=='ROBBERY': return 'Robbery'
    if o in ('PETIT LARCENY','GRAND LARCENY','OTHER OFFENSES RELATED TO THEFT','THEFT-FRAUD','POSSESSION OF STOLEN PROPERTY'): return 'Theft'
    if o=='BURGLARY': return 'Burglary'
    if o=='DANGEROUS WEAPONS': return 'Weapons'
    if o=='DANGEROUS DRUGS': return 'Drugs'
    if o in ('CRIMINAL MISCHIEF & RELATED OF','ARSON'): return 'Criminal damage'
    if o=='GRAND LARCENY OF MOTOR VEHICLE': return 'Vehicle crime'
    if o=='HARRASSMENT 2': return 'Harassment'
    if o in ('OFF. AGNST PUB ORD SENSBLTY &','CRIMINAL TRESPASS','MISCELLANEOUS PENAL LAW'): return 'Public order'
    return 'Other'
SEV={'Violence':3,'Robbery':3,'Weapons':3,'Burglary':2,'Drugs':2,'Criminal damage':1.5,'Vehicle crime':1.5,'Theft':1,'Public order':1,'Harassment':0.8,'Other':1}
R=[r for r in rows if r[1] not in EXCL and 40.45<r[3]<40.95 and -74.3<r[4]<-73.65]
print('kept',len(R),'of',len(rows))
months=sorted(set(r[0] for r in R)); last=months[-1]
# ---- hexes (last month) ----
Rm=350; CLAT,CLNG=40.73,-73.95; mLat=110540; mLng=111320*math.cos(math.radians(CLAT))
def hround(q,r):
    s=-q-r; rq,rr,rs=round(q),round(r),round(s)
    dq,dr,ds=abs(rq-q),abs(rr-r),abs(rs-s)
    if dq>dr and dq>ds: rq=-rr-rs
    elif dr>ds: rr=-rq-rs
    return rq,rr
cells={}
for m,o,pd,lat,lng,prem,tm in R:
    if m!=last: continue
    x=(lng-CLNG)*mLng; y=(lat-CLAT)*mLat
    q,r=hround((math.sqrt(3)/3*x-y/3)/Rm,(2/3*y)/Rm)
    c=cells.setdefault((q,r),{'w':0,'n':0,'c':collections.Counter()})
    k=cat(o); c['w']+=SEV[k]; c['n']+=1; c['c'][k]+=1
CATS=sorted(SEV)
ws=sorted(c['w'] for c in cells.values() if c['n']>=3)
def pct(w): 
    import bisect; return bisect.bisect_left(ws,w)/len(ws)
h=[]; dist=collections.Counter()
for (q,r),c in cells.items():
    if c['n']<3: b=0
    else:
        p=pct(c['w']); b=1 if p>=.95 else 2 if p>=.85 else 3 if p>=.65 else 4 if p>=.35 else 5
    dist[b]+=1; h.append([q,r,b,c['n'],CATS.index(c['c'].most_common(1)[0][0])])
hx={'R':Rm,'clat':CLAT,'clng':CLNG,'mLat':mLat,'mLng':mLng,'cats':CATS,'month':last,'total':sum(c['n'] for c in cells.values()),'h':h,'mode':'relative'}
json.dump(hx,open('hexdata.json','w'),separators=(',',':'))
print('hexes',len(h),dict(dist),'month',last,'total',hx['total'])
# ---- areas (3-month avg within ~1 mile) ----
AREAS={'Times Square':(40.7580,-73.9855),'Midtown East / Grand Central':(40.7527,-73.9772),'Rockefeller Center':(40.7587,-73.9787),
 'Herald Square / Penn Station':(40.7505,-73.9904),'Upper West Side':(40.7870,-73.9754),'Upper East Side':(40.7736,-73.9566),
 'Central Park South':(40.7657,-73.9760),'Chelsea':(40.7465,-74.0014),'Greenwich Village':(40.7336,-74.0027),'Union Square':(40.7359,-73.9911),
 'SoHo':(40.7233,-74.0030),'Chinatown / Little Italy':(40.7158,-73.9970),'Lower East Side':(40.7150,-73.9843),'Financial District':(40.7075,-74.0113),
 'Battery Park City':(40.7115,-74.0156),'Harlem':(40.8116,-73.9465),'DUMBO':(40.7033,-73.9881),'Downtown Brooklyn':(40.6928,-73.9903),
 'Williamsburg':(40.7081,-73.9571),'Park Slope':(40.6710,-73.9814),'Long Island City':(40.7447,-73.9485),'Astoria':(40.7644,-73.9235),
 'Hell\'s Kitchen':(40.7638,-73.9918),'Bryant Park':(40.7536,-73.9832),'Columbus Circle':(40.7681,-73.9819),'Hudson Yards':(40.7538,-74.0020),
 'Coney Island':(40.5755,-73.9707),'Dyker Heights':(40.6215,-74.0139)}
def near(lat,lng,r=1609):
    return [x for x in R if abs(x[3]-lat)<0.0146 and abs(x[4]-lng)<0.0192 and math.hypot((x[3]-lat)*mLat,(x[4]-lng)*mLng)<=r]
out={}
for n,(lat,lng) in AREAS.items():
    xs=near(lat,lng); cc=collections.Counter(cat(x[1]) for x in xs); tot=len(xs)
    pick=collections.Counter(x[2] for x in xs if 'PICKPOCKET' in (x[2] or '') or 'FROM PERSON' in (x[2] or ''))
    out[n]={'avg_month':round(tot/len(months)),'theft_share':round(100*cc['Theft']/max(tot,1)),'violence_share':round(100*(cc['Violence']+cc['Robbery'])/max(tot,1)),
      'top_categories':[k.lower() for k,_ in cc.most_common(3)],'pickpocket_month':round(sum(pick.values())/len(months)),'lat':lat,'lng':lng}
vals=sorted(v['avg_month'] for v in out.values())
for v in out.values():
    p=vals.index(v['avg_month'])/len(vals); v['tier']=1 if p>=.85 else 2 if p>=.65 else 3 if p>=.4 else 4 if p>=.15 else 5
json.dump({'months':months,'source':'NYPD Complaint Data Current (Year To Date), NYC Open Data','areas':out},open('nyc_crime.json','w'),indent=1)
for n,v in sorted(out.items(),key=lambda x:-x[1]['avg_month']): print(f"{n:30s} {v['avg_month']:5d} theft{v['theft_share']:3d}% viol{v['violence_share']:3d}% pick{v['pickpocket_month']:4d} t{v['tier']} {v['top_categories']}")
