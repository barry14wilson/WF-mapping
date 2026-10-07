# Renders a city's guide.json into the Wiley Fox travel-guide web page. Usage: python3 render_city.py <city_dir>
import json, html, sys, os
D = sys.argv[1].rstrip('/')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import affiliate
_raw = open(f'{D}/guide.json').read()
G = json.loads(affiliate.rewrite(_raw, json.loads(_raw)['city']))
CITY = G['city']; FN = CITY.replace(' ', '_') + '_Guide'
CS = G.get('crime_source', {'name': 'data.police.uk', 'citation': ''})
MAPC = G.get('map', {'center': [-0.13, 51.49], 'zoom': 10.6})
EMERG = G['facts'].get('Emergency', '').split(' ')[0] or '999'
_ch = [0]
WORDS = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten']
def chap():
    _ch[0] += 1; return WORDS[_ch[0]-1]
C = G['creators']
e = lambda s: html.escape(str(s))
TIER_LABEL = {1: "Highest", 2: "High", 3: "Moderate", 4: "Lower", 5: "Lowest"}

def credit(keys):
    keys = [k for k in keys if k in C]
    if not keys: return f'<span class="credit">{e(G.get("credit_fallback", "Wiley Fox data"))}</span>'
    return '<span class="credit">Via ' + ', '.join(f'<a href="{C[k]["url"]}" target="_blank" rel="noopener">{e(C[k]["name"])}</a>' for k in keys) + '</span>'

def cta(where):
    c = next(x for x in G['app_ctas'] if x['where'] == where)
    return f'''<div class="wf-cta"><div class="wf-cta-mark">WF</div><p>{e(c["text"])}</p>
      <a class="btn btn-primary btn-sm" href="{c["url"]}" target="_blank" rel="noopener">Open Wiley Fox</a></div>'''

S = G['safety']
import datetime
MON=lambda m: datetime.date(int(m[:4]),int(m[5:]),1).strftime('%b %Y')
RANGE=f"{MON(S['data_months'][-1])} to {MON(S['data_months'][0])}"
css = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'guide.css')).read()
import re as _re
PH = json.load(open(f'{D}/img/credits.json')) if os.path.exists(f'{D}/img/credits.json') else {}
def photo(key):
    p = PH.get(key)
    if not p: return ''
    return f'<figure class="ph"><img src="{p["file"]}" alt="{e(key)}" loading="lazy"><figcaption>Photo: {e(html.unescape(p["artist"]) or "Wikimedia Commons")} · <a href="{p["page"]}" target="_blank" rel="noopener">{e(p["license"])}</a></figcaption></figure>'
HAS_HEX = os.path.exists(f'{D}/hexdata.json')
HEX = open(f'{D}/hexdata.json').read() if HAS_HEX else 'null'
total_crimes = json.loads(HEX)['total'] if HAS_HEX else 0
CT = G.get('crime_table') or {}
if CT:
    PINS = json.dumps([{"n": k, "lat": v["lat"], "lng": v["lng"], "m": v["avg_month"], "t": v["theft_share"], "v": v["violence_share"], "k": "area"} for k, v in CT.items()])
else:  # cities without street-level data: labelled pins (markets, sights, official hotspots)
    PINS = json.dumps([{"n": p["n"], "lat": p["lat"], "lng": p["lng"], "note": p.get("note", ""), "k": p.get("kind", "sight")} for p in G.get("map_pins", [])])
def crime_line(c, full=True):
    if not c: return ''
    if full: return f'<div class="hood-data">{c["avg_month"]:,} crimes a month nearby · {c["theft_share"]}% theft · {c["violence_share"]}% violence or robbery</div>'
    return f'<div class="hood-data">{c["avg_month"]:,} crimes a month nearby · top: {e(", ".join(c["top_categories"]))}</div>'
OFFICIAL = ''.join(f'<div class="stat-item"><div class="stat-number">{e(x["number"])}</div><div class="stat-label">{e(x["label"])}</div><div class="stat-desc">{e(x.get("desc",""))}</div></div>' for x in G.get('official_crime', []))


stay_cards = ''.join(f'''
<article class="hood-card">{photo(s["area"])}
  <div class="hood-head"><div class="hood-name">{e(s["area"])}</div>
    {f'<div class="tier-pill t{s["crime"]["tier"]}">{TIER_LABEL[s["crime"]["tier"]]} recorded crime</div>' if s.get("crime") else ''}</div>
  <div class="hood-body">
    <div class="hood-tagline">{" · ".join(e(x) for x in s["for"])}</div>
    <p class="hood-desc">{e(s["why"])}</p>
    {crime_line(s.get("crime"))}
    {credit(s["creators"])}
  </div>
</article>''' for s in G['stay'])

caution_rows = ''.join(f'''
<div class="caution-row">
  <div class="dot" style="background:var(--safety-{(c["crime"]["tier"] if c.get("crime") and c["crime"]["tier"]<3 else 2)})"></div>
  <div style="flex:1">
    <div class="borough-name">{e(c["area"])}</div>
    <div class="caution-when">Take most care: {e(c["when"])}</div>
    <p class="caution-note">{e(c["note"])}</p>
    {crime_line(c.get("crime"), False)}
    {credit(c["creators"])}
  </div>
</div>''' for c in G['caution'])

ct = sorted(CT.items(), key=lambda x: x[1]['avg_month'])
mx = max([v['avg_month'] for _, v in ct] or [1])
bars = ''.join(f'''<div class="bar-row"><span class="bar-name">{e(k)}</span>
  <span class="bar-track"><span class="bar-fill" style="width:{v["avg_month"]/mx*100:.1f}%;background:var(--safety-{v["tier"]})"></span></span>
  <span class="bar-val">{v["avg_month"]:,}</span></div>''' for k, v in ct)

top_rows = ''.join(f'''
<div class="top-row"><div class="top-rank">{i:02d}</div>
  <div class="top-content">{photo(t["name"]) if t["name"] in PH else ""}<h3>{e(t["name"])}</h3>
    <div class="top-meta">{e(t["area"])}{' <span class="sep">·</span> Great for kids' if t["family"] else ''}</div>
    <p class="top-desc">{e(t["why"])}</p>{credit(t["creators"])}</div>
  <div class="top-cta"><div class="price">{e(t["price"])}</div>
    <a href="{t["url"]}" target="_blank" rel="noopener sponsored" class="btn btn-ghost btn-sm">{"Book" if "getyourguide" in t["url"] else "Details"}</a></div>
</div>''' for i, t in enumerate(G['top'], 1))

eat_rows = ''.join(f'''
<article class="eat-row"><div class="eat-price">{e(r["price"])}</div>
  <div class="eat-info"><h3>{e(r["name"])}</h3>
    <div class="eat-meta">{e(r["area"])} <span class="sep">·</span> {e(r["type"])}</div>
    <p class="eat-desc">{e(r["why"])}</p>
    <div class="eat-tags">{'<span class="eat-tag safe">Family friendly</span>' if r["family"] else '<span class="eat-tag">Grown-ups</span>'}{credit(r["creators"])}</div></div>
  <a href="{r["url"]}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Visit</a>
</article>''' for r in G['eat'])

hotel_cards = ''.join(f'''
<article class="hotel-card"><div class="hotel-body">
  <div class="hotel-meta">{e(h["area"])} · {e(h["for"])}</div>
  <div class="hotel-name">{e(h["name"])}</div>
  <p class="hotel-desc">{e(h["why"])}</p>
  <div class="hotel-footer"><div class="hotel-price">{e(h["band"])} <small>price band</small></div>
    <a href="{h["url"]}" target="_blank" rel="noopener sponsored" class="btn btn-primary btn-sm">See prices</a></div>
  <div style="margin-top:10px">{credit([h["source"]]) if h["source"] in C else '<span class="credit">Wiley Fox pick</span>'}</div>
</div></article>''' for h in G['hotels'])

transport = ''.join(f'''<div class="practical-card"><div class="practical-title">{e(t["title"])}</div>
  <div class="practical-text">{e(t["text"])}</div>{credit(t["creators"])}</div>''' for t in G['transport'])
scams = ''.join(f'''<div class="practical-card"><div class="practical-title">{e(t["title"])}</div>
  <div class="practical-text">{e(t["text"])}</div>{credit(t["creators"])}</div>''' for t in G['scams'])

LT = json.load(open(f'{D}/tips.json'))['tips']
CATS = [('transport_payment','Paying for transport'),('water_snacks','Water & snacks'),('toilets','Toilets'),('parks_play','Parks & play'),
        ('money_tipping','Money & tipping'),('phone_data','Phones & data'),('safety_habits','Safety habits'),('local_ways','Local ways')]
def _lt(t):
    src = f' <a class="lt-src" href="{e(t["verified_url"])}" target="_blank" rel="noopener">Checked {e(t["verified_at"][:7])} ↗</a>' if t.get('verified_url') else ''
    badge = '<span class="lt-xmas">Christmas</span> ' if t.get('season') == 'christmas' else ''
    return f'<div class="practical-card"><div class="practical-title">{badge}{e(t["worry"])}</div><div class="practical-text">{e(t["tip"])}{src}</div></div>'
local_tips = ''.join(f'<h3 class="sub-h">{lab}</h3><div class="practical-grid">' + ''.join(_lt(t) for t in LT if t['category']==k) + '</div>'
                     for k, lab in CATS if any(t['category']==k for t in LT))
tips = ''.join(f'''<div class="practical-card"><div class="practical-title">{e(t["title"])}</div><div class="practical-text">{e(t["text"])}</div></div>''' for t in G['tips'])
costs = ''.join(f'''<div class="data-row"><span class="data-label">{e(c["item"])}</span><span class="data-value">{e(c["price"])} <small>{e(c["date"])}</small></span></div>''' for c in G['costs'])
facts = ''.join(f'<div class="fact-row"><span class="fact-label">{e(k)}</span><span class="fact-value">{e(v)}</span></div>' for k, v in G['facts'].items())
stats = ''.join(f'<div class="stat-item"><div class="stat-number">{e(s["number"])}</div><div class="stat-label">{e(s["label"])}</div><div class="stat-desc">{e(s["desc"])}</div></div>' for s in G['stats'])
it1 = ''.join(f'<div class="itin-block"><span class="itin-time">{t}</span><span class="itin-action"><strong>{e(a)}.</strong> {e(b)}</span></div>' for t, a, b in G['itinerary']['1day'])
it3 = ''.join(f'''<div class="itin-day"><div class="itin-day-num"><span class="label">Day</span><span class="num">{i}</span></div>
  <div class="itin-day-content"><h3>{e(d[0].split(" · ")[1])}</h3>
  <div class="itin-block"><span class="itin-time">AM</span><span class="itin-action">{e(d[1])}</span></div>
  <div class="itin-block"><span class="itin-time">PM</span><span class="itin-action">{e(d[2])}</span></div>
  <div class="itin-block"><span class="itin-time">EVE</span><span class="itin-action">{e(d[3])}</span></div></div></div>''' for i, d in enumerate(G['itinerary']['3day'], 1))
sources = ''.join(f'<li><a href="{s["url"]}" target="_blank" rel="noopener">{e(s["title"])}</a> <span class="src-by">{e(s["creator"])} · {e(s["date"])}</span></li>' for s in G['sources'])


X = G.get('christmas')
def _xcard(t):
    meta = ' <span class="sep">·</span> '.join(e(x) for x in [t.get('area'), t.get('when')] if x)
    extra = f'<p class="top-desc"><b>Crowds:</b> {e(t["crowds"])}</p>' if t.get('crowds') else ''
    url = t.get('url') or ''
    btn = f'<a href="{url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Details</a>' if url else ''
    return f"""<div class="top-row"><div class="top-rank">★</div>
  <div class="top-content">{photo(t["name"]) if t["name"] in PH else ""}<h3>{e(t["name"])}</h3>
    <div class="top-meta">{meta}{' <span class="sep">·</span> Great for kids' if t.get("family") else ''}</div>
    <p class="top-desc">{e(t["why"])}</p>{extra}{credit(t.get("creators", []))}</div>
  <div class="top-cta"><div class="price">{e(t.get("price", ""))}</div>{btn}</div></div>"""
if X:
    XNAV = '<a href="#christmas">Christmas</a>'
    xs = ''.join(f"""<div class="practical-card"><div class="practical-title">{e(t["title"])}</div><div class="practical-text">{e(t["text"])}</div>{credit(t.get("creators", []))}</div>""" for t in X.get('safety', []))
    XMAS_BODY = f"""<section id="christmas" class="alt xmas"><div class="container"><div class="section-rule">Chapter {{CH}} · Christmas</div>
<div class="section-label">The festive season</div><h2 class="section-title">Christmas in {e(CITY)}</h2>
<p class="section-sub">{e(X["intro"])}</p>
<h3 class="sub-h">Christmas markets</h3><div class="top-list">{''.join(_xcard(t) for t in X.get('markets', []))}</div>
<h3 class="sub-h">Lights, rinks and festive sights</h3><div class="top-list">{''.join(_xcard(t) for t in X.get('sights', []))}</div>
<h3 class="sub-h">Staying safe in the Christmas crowds</h3><div class="practical-grid">{xs}</div>
<p class="small-note">{e(X.get("plan", ""))}</p>
{cta("families")}
</div></section>"""
else:
    XNAV = ''; XMAS_BODY = ''

if HAS_HEX:
    MAP_BLOCK = f"""<h3 class="sub-h" id="map">The Wiley Fox crime map of {e(CITY)}</h3>
<p class="section-sub">Every recorded crime in {MON(S['data_months'][0])} from {e(CS['name'])}, weighted by seriousness the same way as the Wiley Fox app and grouped into 350-metre hexagons. Colours compare each hexagon with the rest of {e(CITY)}: red marks the busiest 5% of the city. Blank areas had no recorded crime. Busy tourist districts show up red partly because so many people pass through them. For a street-level score, open the Wiley Fox map.</p>
<div class="map-wrap"><div id="gmap"></div>
<div class="map-legend"><b>Recorded crime vs rest of {e(CITY)}</b><span><i style="background:#D7263D"></i>Highest 5%</span><span><i style="background:#F46036"></i>Next 10%</span><span><i style="background:#FFC857"></i>Next 20%</span><span><i style="background:#A4C957"></i>Middle 30%</span><span><i style="background:#3FA34D"></i>Lowest 35%</span></div></div>
<p class="map-foot">{total_crimes:,} crimes · {e(CS["name"])} · <a href="{G["app_ctas"][0]["url"]}" target="_blank" rel="noopener">Check any street live on the Wiley Fox map</a></p>
<h3 class="sub-h">Recorded crime by area</h3><p class="section-sub">{e(S["data_note"])}</p>
<div class="bars">{bars}</div>
<div class="legend"><span><i style="background:var(--safety-5)"></i>Lowest</span><span><i style="background:var(--safety-4)"></i>Lower</span><span><i style="background:var(--safety-3)"></i>Moderate</span><span><i style="background:var(--safety-2)"></i>High</span><span><i style="background:var(--safety-1)"></i>Highest</span></div>"""
else:
    MAP_BLOCK = f"""<h3 class="sub-h">What the official figures say</h3>
<p class="section-sub">{e(S["data_note"])}</p>
<div class="stat-strip" style="margin:18px 0;border-radius:10px"><div class="container" style="padding:0">{OFFICIAL}</div></div>
<h3 class="sub-h" id="map">Map: markets, sights and places to take care</h3>
<p class="section-sub">{e(G.get("map_intro", "Street-level crime data is not published for this city, so this map shows the places in this guide and the areas official reports and creators flag. Tap a pin for the note."))}</p>
<div class="map-wrap"><div id="gmap"></div>
<div class="map-legend"><b>Pins</b><span><i style="background:#1F6B3A"></i>Christmas market</span><span><i style="background:#1a1a1a"></i>Sight or base</span><span><i style="background:#F46036"></i>Take extra care</span></div></div>
<p class="map-foot">Crime figures: {e(CS["name"])} · <a href="{G["app_ctas"][0]["url"]}" target="_blank" rel="noopener">Open the Wiley Fox map</a></p>"""

CP = G.get('compare')
if CP:
    _mx = [max(r['vals'][i] for r in CP['rows']) or 1 for i in range(len(CP['cols']))]
    _rows = ''.join('<tr class="%s"><th>%s</th>%s</tr>' % ('me' if r.get('me') else ('avg' if r.get('avg') else ''), e(r['name']),
        ''.join(f'<td><span class="cmp-bar" style="width:{v/_mx[i]*100:.0f}%"></span><span class="cmp-v">{v:,}</span></td>' for i, v in enumerate(r['vals']))) for r in CP['rows'])
    MAP_BLOCK += f"""<h3 class="sub-h" id="compare">{e(CP['title'])}</h3><p class="section-sub">{e(CP['intro'])}</p>
<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>{''.join(f'<th>{e(c)}</th>' for c in CP['cols'])}</tr></thead><tbody>{_rows}</tbody></table>
<div class="cmp-unit">{e(CP['unit'])}</div></div>
<p class="map-foot">{e(CP['note'])} Source: <a href="{CP['source']['url']}" target="_blank" rel="noopener">{e(CP['source']['name'])}</a></p>"""

NTOP = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen'][len(G['top'])] if len(G['top'])<16 else str(len(G['top']))
page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(CITY)} Travel Guide | Wiley Fox</title>
<meta name="description" content="{e(G["cover_blurb"])}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"><style>{css}</style></head><body>
<nav class="topbar"><div class="topbar-logo"><span class="mark">WF</span> Wiley Fox <span class="sep">/</span> <span class="city">{e(CITY)}</span></div>
  <div class="topbar-nav">{XNAV}<a href="#safety">Safety</a><a href="#stay">Stay</a><a href="#top">See</a><a href="#eat">Eat</a><a href="#practical">Getting around</a><a href="#local-tips">Local tips</a><a href="#sources">Sources</a></div>
  <div class="topbar-actions"><a href="{FN}.pdf" class="topbar-back">Download PDF</a><a href="{G["app_ctas"][0]["url"]}" class="topbar-back">Open the map</a></div></nav>

<header class="cover-hero"><img class="photo" src="{PH["cover"]["file"]}" alt="{e(CITY)}"><div class="photo-overlay"></div>
  <div class="cover-top"><div class="cover-logo-box">WF</div><div class="cover-edition"><div class="ed-badge">{e(G["edition"])}</div><div>Wiley Fox Travel</div><div>{e(G["audience"])}</div></div></div>
  <div class="cover-tagline">The Wiley Fox guide to</div>
  <div class="wordmark-wrap"><div class="city-wordmark">{e(CITY)}</div></div>
  <div class="cover-subtitle">For families &amp; solo travellers</div>
  <p class="cover-blurb">{e(G["cover_blurb"])}</p>
  <div class="cover-safety"><div class="safety-score-pill"><div class="score-num" style="color:var(--safety-{S["wf_rating"]})">{S["wf_rating"]}</div>
    <div class="score-meta"><div class="score-headline">Wiley Fox rating · {e(S["wf_label"])}</div><div class="score-label">out of 5 · police data {RANGE}</div>
    <div class="score-source">Creator feeling {S["creator_feeling"]}/5 · {e(S["creator_feeling_label"])}</div></div></div></div>
</header>

<div class="stat-strip"><div class="container">{stats}</div></div>

<section id="overview" class="overview"><div class="container"><div class="section-rule">Chapter {chap()} · The City</div>
<div class="overview-grid"><div><p class="overview-lede">{e(G["overview"][0])}</p><p>{e(G["overview"][1])}</p><p>{e(G["overview"][2])}</p>{cta("before_booking")}</div>
<aside class="overview-sidebar"><h4>Fast facts</h4>{facts}</aside></div></div></section>
{XMAS_BODY.replace('{CH}', chap()) if XMAS_BODY else ''}

<section id="safety"><div class="container"><div class="section-rule">Chapter {chap()} · Safety</div>
<div class="section-label">What the data and the creators say</div><h2 class="section-title">How it feels, and what the numbers show</h2>
<div class="two-col"><div class="panel"><h3>The data</h3><p>{e(S["wf_summary"])}</p></div><div class="panel"><h3>The creators</h3><p>{e(S["creator_summary"])}</p></div></div>
{MAP_BLOCK}
<h3 class="sub-h" id="caution">Areas to take extra care</h3><p class="section-sub">None of these are no-go areas. Know the pattern, and plan your timing and your route home.</p>
<div class="ranking-card">{caution_rows}</div>
{cta("night")}
<h3 class="sub-h">Scams and tricks creators keep seeing</h3><div class="practical-grid">{scams}</div>
</div></section>

<section id="stay" class="alt"><div class="container"><div class="section-rule">Chapter {chap()} · Where to base yourself</div>
<div class="section-label">Neighbourhoods</div><h2 class="section-title">Where to stay</h2>
<p class="section-sub">{"Pick an area first, then a hotel. Every area card shows the latest recorded crime within about a mile, so you can compare busy against calm." if HAS_HEX else "Pick an area first, then a hotel. The old town is compact, so most bases are within a short walk of the markets."}</p>
<div class="hood-grid">{stay_cards}</div>
<h3 class="sub-h">Hotels we'd start with</h3>
<div class="affiliate-note">Wiley Fox may earn a small commission if you book through these links. Your price stays the same.</div>
<div class="hotel-grid">{hotel_cards}
<article class="hotel-card search-card"><div class="hotel-name">Search all {e(CITY)} hotels</div><p class="hotel-desc">Compare live prices, then check the street on the Wiley Fox map before you book.</p>
<a href="{affiliate.wrap("https://www.booking.com/searchresults.html?ss="+CITY.replace(" ","+"), CITY)}" target="_blank" rel="noopener sponsored" class="btn btn-primary">Search Booking.com</a></article></div>
{cta("families")}
</div></section>

<section id="top"><div class="container"><div class="section-rule">Chapter {chap()} · The Sights</div>
<div class="section-label">What creators rate</div><h2 class="section-title">{NTOP} things worth your time</h2>
<p class="section-sub">{e(G.get('top_intro', 'Ranked by how often creators recommend them. Book popular ones early.'))}</p><div class="top-list">{top_rows}</div>
<h3 class="sub-h">If you only have one day</h3><div class="itin-day"><div class="itin-day-num"><span class="label">One</span><span class="num">1</span></div><div class="itin-day-content"><h3>The classic loop</h3>{it1}</div></div>
<h3 class="sub-h">Three days, grouped by area</h3>{it3}
</div></section>

<section id="eat" class="alt"><div class="container"><div class="section-rule">Chapter {chap()} · The Table</div>
<div class="section-label">{e(G.get("eat_label", "What creators rate"))}</div><h2 class="section-title">Where to eat</h2>
<p class="section-sub">{e(G.get("eat_intro", "Every place is credited to the creator who recommended it."))}</p>
<div class="eat-list">{eat_rows}</div><p class="small-note">{e(G["grown_ups"])} Opening times and menus change, so check before you travel. Wiley Fox is not paid for restaurant listings.</p>
</div></section>

<section id="practical"><div class="container"><div class="section-rule">Chapter {chap()} · Getting around &amp; costs</div>
<div class="section-label">Before you go</div><h2 class="section-title">Getting around {e(CITY)}</h2>
<div class="practical-grid">{transport}</div>
<div class="two-col"><div class="data-panel"><h3>What it costs</h3>{costs}<p class="panel-foot">Creator prices carry the video date. Anything older than 18 months is marked to check.</p></div>
<div><h3 class="sub-h" style="margin-top:0">Quick tips</h3><div class="practical-grid single">{tips}</div></div></div>
{cta("community")}
</div></section>

<section id="local-tips" class="alt"><div class="container"><div class="section-rule">Chapter {chap()} · Local tips</div>
<div class="section-label">The small things visitors worry about</div><h2 class="section-title">Local tips for {e(CITY)}</h2>
<p class="section-sub">{e(G.get("tips_intro", "Every tip here was checked against an official or trusted source on the date shown. Rules and prices change, so tap the link to double-check before you travel."))}</p>
{local_tips}
<style>.lt-src{{display:inline-block;margin-left:4px;font-size:.78em;font-weight:600;color:#EA2E00;text-decoration:none;white-space:nowrap}}.lt-xmas{{display:inline-block;font-family:Inter,sans-serif;font-style:normal;font-size:.62em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:#1F6B3A;color:#fff;border-radius:4px;padding:2px 6px;vertical-align:middle}}</style>
</div></section>

<div class="cta-banner"><div class="container"><div class="cta-inner"><div class="cta-text"><h2>Travel with Wiley Fox</h2>
<p>{e(G.get("banner_text", "Live crime maps, Safest Route home, one-tap SOS, and QR wristbands so lost children and lost bags find their way back."))}</p></div>
<div class="cta-buttons"><a href="{G["app_ctas"][0]["url"]}" class="btn btn-primary">Open the Wiley Fox map</a><a href="https://www.thewileyfox.com" class="btn btn-on-dark">Get QR wristbands</a></div></div></div></div>

<section id="sources" class="alt"><div class="container"><div class="section-rule">Credits</div><h2 class="section-title">Our sources</h2>
<p class="section-sub">This guide summarises these creators' videos in our own words. Watch the originals - they are worth it. Crime data: {e(CS['name'])} ({RANGE}). {e(CS.get('citation',''))}</p>
<ol class="sources">{sources}</ol></div></section>

<footer><div class="footer-logo">Wiley Fox <span class="accent">·</span> Travel</div>
<p><a href="https://www.thewileyfox.com">thewileyfox.com</a></p>
<p class="footer-small">Accommodation and activity links are affiliate links. Editorial recommendations are independent. Safety information is guidance, not a guarantee. In an emergency call {e(EMERG)}.</p>
<div class="footer-meta">© 2026 Wiley Fox · Updated {e(G["updated"])}</div></footer>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function(){{
const H={HEX}; const PINS={PINS};
const COL={{5:'#3FA34D',4:'#A4C957',3:'#FFC857',2:'#F46036',1:'#D7263D',0:'#9ED2B2'}};
const LAB={{5:'Lowest 35% in {e(CITY)}',4:'Middle 30% in {e(CITY)}',3:'Busier than most (top 35%)',2:'Busy (top 15%)',1:'Highest 5% in {e(CITY)}'}};
const toLL=(x,y)=>[H.clng+x/H.mLng,H.clat+y/H.mLat];
const feats=!H?[]:H.h.map(([q,r,b,n,c])=>{{const cx=H.R*Math.sqrt(3)*(q+r/2),cy=H.R*1.5*r;const ring=[];
 for(let i=0;i<6;i++){{const a=Math.PI/180*(60*i-30);ring.push(toLL(cx+H.R*Math.cos(a),cy+H.R*Math.sin(a)));}} ring.push(ring[0]);
 return {{type:'Feature',properties:{{b,n,top:H.cats[c],col:COL[b],lab:LAB[b]}},geometry:{{type:'Polygon',coordinates:[ring]}}}};}});
const pins={{type:'FeatureCollection',features:PINS.map(p=>({{type:'Feature',properties:p,geometry:{{type:'Point',coordinates:[p.lng,p.lat]}}}}))}};
if(!window.maplibregl){{document.getElementById('gmap').innerHTML='<p style="padding:20px">Map unavailable offline - open the Wiley Fox map online.</p>';return;}}
const map=new maplibregl.Map({{container:'gmap',style:'https://tiles.openfreemap.org/styles/positron',center:{json.dumps(MAPC['center'])},zoom:(window.innerWidth<700?{MAPC['zoom']-1.2}:{MAPC['zoom']}),cooperativeGestures:true,attributionControl:{{compact:true}}}});
map.addControl(new maplibregl.NavigationControl({{showCompass:false}}),'top-right');
map.on('load',()=>{{
 if(H){{map.addSource('hex',{{type:'geojson',data:{{type:'FeatureCollection',features:feats}}}});
 map.addLayer({{id:'hex',type:'fill',source:'hex',paint:{{'fill-color':['get','col'],'fill-opacity':0.55}}}});}}
 map.addSource('pins',{{type:'geojson',data:pins}});
 map.addLayer({{id:'pins',type:'circle',source:'pins',paint:{{'circle-radius':6,'circle-color':['match',['get','k'],'market','#1F6B3A','caution','#F46036','#1a1a1a'],'circle-stroke-color':'#fff','circle-stroke-width':2}}}});
 map.addLayer({{id:'pinlab',type:'symbol',source:'pins',layout:{{'text-field':['get','n'],'text-size':11,'text-offset':[0,1.1],'text-anchor':'top','text-font':['Noto Sans Bold']}},paint:{{'text-color':'#1a1a1a','text-halo-color':'#fff','text-halo-width':1.6}}}});
 const pop=new maplibregl.Popup({{closeButton:true,maxWidth:'260px'}});
 map.on('click','pins',e=>{{const p=e.features[0].properties;pop.setLngLat(e.lngLat).setHTML(p.m!==undefined&&p.m!==null&&p.m!=='' ? `<b>${{p.n}}</b><br>${{Number(p.m).toLocaleString('en-GB')}} crimes a month within ~1 mile<br>${{p.t}}% theft · ${{p.v}}% violence or robbery<br><a href="https://www.thewileyfox.com" target="_blank">Open on Wiley Fox</a>` : `<b>${{p.n}}</b><br>${{p.note||''}}`).addTo(map);}});
 map.on('click','hex',e=>{{if(map.queryRenderedFeatures(e.point,{{layers:['pins']}}).length)return;const p=e.features[0].properties;pop.setLngLat(e.lngLat).setHTML(`<b style="color:${{p.col}}">${{p.lab}}</b><br>${{p.n}} crimes in ${{'{MON(S["data_months"][0])}'}}<br>Most common: ${{p.top}}`).addTo(map);}});
 (H?['hex','pins']:['pins']).forEach(l=>{{map.on('mouseenter',l,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',l,()=>map.getCanvas().style.cursor='');}});
}});
}})();
</script>
</body></html>'''
import re as _r2
# Research shorthand never reaches readers
page = _r2.sub(r'(^|[.>:]\s*)NOT VERIFIED', lambda m: m.group(1) + 'Not yet confirmed', page)
page = page.replace('NOT VERIFIED', 'not yet confirmed')
open(f'{D}/{FN}.html', 'w').write(page)
print('html', len(page))
