# run after: python3 ../data/make_compare.py us Chicago guide.json Illinois
import json
p='/home/claude/cityguide/chi/guide.json'; g=json.load(open(p))
n=" Chicago's homicide rate - about 15 per 100,000 residents in 2025 (Chicago Police) - is much higher than this overall violent-crime figure suggests, and is concentrated in a small number of South and West Side neighbourhoods."
if n not in g['compare']['note']: g['compare']['note'] += n
json.dump(g,open(p,'w'),ensure_ascii=False,indent=1)
