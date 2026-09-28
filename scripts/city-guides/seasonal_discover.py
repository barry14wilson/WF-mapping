# Seasonal YouTube discovery for chosen cities -> city database (needs YOUTUBE_API_KEY in .env.pipeline; wfapi.sh helper for the admin API).
import json, urllib.request, urllib.parse, subprocess, sys, os
ENV=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','.env.pipeline')
KEY=[l.split('=',1)[1].strip() for l in open(ENV) if l.startswith('YOUTUBE_API_KEY=')][0]
def yt(path, **p):
    p['key']=KEY; u=f"https://www.googleapis.com/youtube/v3/{path}?"+urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(u, timeout=30))
CITIES={'new_york_city':('New York','United States',['Christmas in New York City','New York City in December','NYC Christmas things to do','New York City travel guide 2025','NYC safety tips tourists','where to stay in New York City','New York City food guide']),
 'chicago':('Chicago','United States',['Chicago Christkindlmarket','Chicago in December','Chicago Christmas things to do','Chicago travel guide 2025','Chicago safety tips tourists','where to stay in Chicago','Chicago food guide']),
 'berlin':('Berlin','Germany',['Berlin Christmas market','Berlin in December','Berlin Christmas things to do','Berlin travel guide 2025','Berlin safety tips tourists','where to stay in Berlin','Berlin food guide']),
 'munich':('Munich','Germany',['Munich Christmas market','Munich in December','Munich Christmas things to do','Munich travel guide 2025','Munich safety tips tourists','where to stay in Munich','Munich food guide']),
 'cologne':('Cologne','Germany',['Cologne Christmas market','Cologne in December','Cologne Christmas things to do','Cologne travel guide','Cologne Germany tips tourists','where to stay in Cologne','Cologne food guide']),
 'nuremberg':('Nuremberg','Germany',['Nuremberg Christmas market','Nuremberg Christkindlesmarkt','Nuremberg in December','Nuremberg travel guide','Nuremberg things to do','Nuremberg food','Nuremberg day trip'])}
def api(op, body):
    r=subprocess.run(['/home/claude/wfapi.sh',op,json.dumps(body)],capture_output=True,text=True); return r.stdout
print(api('upsert_cities',{'cities':[{'slug':s,'name':n,'country':c,'region':'Europe' if c=='Germany' else 'North America'} for s,(n,c,_) in CITIES.items()]}))
found={}
for slug,(name,country,qs) in CITIES.items():
    for q in qs:
        try:
            d=yt('search',part='snippet',type='video',maxResults=12,relevanceLanguage='en',order='relevance',publishedAfter='2023-01-01T00:00:00Z',q=q)
            for it in d.get('items',[]): found.setdefault(it['id']['videoId'],(slug,'xmas_search:'+q))
        except Exception as e: print('ERR',q,e)
ids=list(found); rows=[]
for i in range(0,len(ids),50):
    d=yt('videos',part='snippet,statistics,contentDetails',id=','.join(ids[i:i+50]))
    for v in d['items']:
        views=int(v.get('statistics',{}).get('viewCount',0))
        if views<5000: continue
        slug,via=found[v['id']]
        rows.append({'id':'yt:'+v['id'],'url':'https://www.youtube.com/watch?v='+v['id'],'title':v['snippet']['title'],'channel':v['snippet']['channelTitle'],
          'channel_id':v['snippet']['channelId'],'city_slug':slug,'published_at':v['snippet']['publishedAt'],'views':views,
          'likes':int(v.get('statistics',{}).get('likeCount',0)),'duration':v['contentDetails'].get('duration'),'description':v['snippet']['description'][:4000],'discovered_via':via})
import collections
print('candidates',len(ids),'kept',len(rows),collections.Counter(r['city_slug'] for r in rows))
tot=0
for i in range(0,len(rows),40):
    open('/tmp/claude-0/wf/x_src.json','w').write(json.dumps({'sources':rows[i:i+40]}))
    out=subprocess.run(['/home/claude/wfapi.sh','add_sources','@/tmp/claude-0/wf/x_src.json'],capture_output=True,text=True).stdout
    tot+=json.loads(out).get('inserted',0)
print('inserted new',tot)
