import json, math, collections
rows=json.load(open('cpd_2026_jja.json'))
EXCL={'NON-CRIMINAL','NON - CRIMINAL','CONCEALED CARRY LICENSE VIOLATION','LIQUOR LAW VIOLATION','GAMBLING','OBSCENITY','PUBLIC INDECENCY'} #'VEHICLE AND TRAFFIC LAWS','INTOXICATED & IMPAIRED DRIVING','ADMINISTRATIVE CODE','OFFENSES AGAINST PUBLIC ADMINI','OTHER STATE LAWS','OTHER STATE LAWS (NON PENAL LA','NYS LAWS-UNCLASSIFIED FELONY','AGRICULTURE & MRKTS LAW-UNCLASSIFIED'}
def cat(o):
    if o in ('BATTERY','ASSAULT','HOMICIDE','CRIMINAL SEXUAL ASSAULT','SEX OFFENSE','KIDNAPPING','HUMAN TRAFFICKING','STALKING','INTIMIDATION','OFFENSE INVOLVING CHILDREN'): return 'Violence'
    if o=='ROBBERY': return 'Robbery'
    if o in ('THEFT','DECEPTIVE PRACTICE'): return 'Theft'
    if o=='BURGLARY': return 'Burglary'
    if o=='WEAPONS VIOLATION': return 'Weapons'
    if o=='NARCOTICS': return 'Drugs'
    if o in ('CRIMINAL DAMAGE','ARSON'): return 'Criminal damage'
    if o=='MOTOR VEHICLE THEFT': return 'Vehicle crime'
    if o in ('PUBLIC PEACE VIOLATION','CRIMINAL TRESPASS','INTERFERENCE WITH PUBLIC OFFICER','PROSTITUTION'): return 'Public order'
    return 'Other'
SEV={'Violence':3,'Robbery':3,'Weapons':3,'Burglary':2,'Drugs':2,'Criminal damage':1.5,'Vehicle crime':1.5,'Theft':1,'Public order':1,'Harassment':0.8,'Other':1}
R=[r for r in rows if r[1] not in EXCL and 41.62<r[3]<42.05 and -87.95<r[4]<-87.5]
print('kept',len(R),'of',len(rows))
months=sorted(set(r[0] for r in R)); last=months[-1]
# ---- hexes (last month) ----
Rm=350; CLAT,CLNG=41.84,-87.68; mLat=110540; mLng=111320*math.cos(math.radians(CLAT))
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
AREAS={'The Loop (Daley Plaza)':(41.8840,-87.6303),'Millennium Park':(41.8826,-87.6226),'Magnificent Mile':(41.8948,-87.6243),'River North':(41.8924,-87.6341),
 'Streeterville':(41.8925,-87.6200),'Navy Pier':(41.8917,-87.6086),'Gold Coast':(41.9030,-87.6280),'South Loop':(41.8676,-87.6270),'Museum Campus':(41.8663,-87.6146),
 'West Loop / Fulton Market':(41.8865,-87.6520),'Union Station':(41.8786,-87.6400),'Old Town':(41.9110,-87.6380),'Lincoln Park Zoo':(41.9211,-87.6340),
 'Lincoln Park':(41.9214,-87.6513),'Wrigleyville / Lakeview':(41.9484,-87.6553),'Wicker Park':(41.9088,-87.6796),'Logan Square':(41.9231,-87.7093),
 'Chinatown':(41.8517,-87.6338),'Pilsen':(41.8564,-87.6600),'Hyde Park':(41.7906,-87.5830)}
def near(lat,lng,r=1609):
    return [x for x in R if abs(x[3]-lat)<0.0146 and abs(x[4]-lng)<0.0195 and math.hypot((x[3]-lat)*mLat,(x[4]-lng)*mLng)<=r]
out={}
for n,(lat,lng) in AREAS.items():
    xs=near(lat,lng); cc=collections.Counter(cat(x[1]) for x in xs); tot=len(xs)
    pick=collections.Counter(x[2] for x in xs if 'POCKET' in (x[2] or '') or 'PURSE' in (x[2] or ''))
    out[n]={'avg_month':round(tot/len(months)),'theft_share':round(100*cc['Theft']/max(tot,1)),'violence_share':round(100*(cc['Violence']+cc['Robbery'])/max(tot,1)),
      'top_categories':[k.lower() for k,_ in cc.most_common(3)],'pickpocket_month':round(sum(pick.values())/len(months)),'lat':lat,'lng':lng}
vals=sorted(v['avg_month'] for v in out.values())
for v in out.values():
    p=vals.index(v['avg_month'])/len(vals); v['tier']=1 if p>=.85 else 2 if p>=.65 else 3 if p>=.4 else 4 if p>=.15 else 5
json.dump({'months':months,'source':'Chicago Police Department, Crimes - 2001 to Present, City of Chicago Data Portal','areas':out},open('chi_crime.json','w'),indent=1)
for n,v in sorted(out.items(),key=lambda x:-x[1]['avg_month']): print(f"{n:30s} {v['avg_month']:5d} theft{v['theft_share']:3d}% viol{v['violence_share']:3d}% pick{v['pickpocket_month']:4d} t{v['tier']} {v['top_categories']}")
