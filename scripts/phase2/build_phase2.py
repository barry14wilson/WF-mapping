#!/usr/bin/env python3
"""Build new/phase2/index.html = the live /new app + the Phase 2 features.

Phase 2 must always carry everything /new has, so it is generated, never hand-edited:
  python3 scripts/phase2/build_phase2.py
Re-run after any change to new/index.html or to the fragments in scripts/phase2/
(module.css, rail.html, views.html, shop.html, module.js). Every patch below asserts
its anchor exists exactly once, so a /new change that moves an anchor fails loudly.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(ROOT, 'new', 'index.html'), encoding='utf-8').read()
frag = lambda n: open(os.path.join(HERE, n), encoding='utf-8').read()
s = src
def once(old, new):
    global s
    n = s.count(old)
    if n != 1: sys.exit(f'build_phase2: anchor found {n} times: {old[:80]!r}')
    s = s.replace(old, new)

# 0. strip any Netlify-injected snippet that was saved into the source
s = re.sub(r'<script async src="/\.netlify/scripts/hud[^>]*></script>', '', s)
# 1. head: noindex, title, QR library, Phase 2 styles
once('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">')
s = re.sub(r'<title>([^<]*)</title>', r'<title>\1 · Phase 2 preview</title>', s, count=1)
once('</head>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>\n<style id="phase2-css">\n' + frag('module.css') + '\n</style>\n</head>')
# 2. relative paths: the page lives one folder down (/new/phase2/)
s, n = re.subn(r"(:\s*)'guides/", r"\1'../guides/", s)
if n < 9: sys.exit(f'build_phase2: only {n} guide links rewritten')
once("fetch(`data/scotland-dz/", "fetch(`../data/scotland-dz/")
once("fetch('./wileyfox-travel-guide-template.html", "fetch('../wileyfox-travel-guide-template.html")
# 3. rail: Phase 2 tag, new items after Saved places, shop badge
once('<div class="wf-brand"><span class="m"></span><span class="n">WileyFox</span></div>', '<div class="wf-brand"><span class="m"></span><span class="n">WileyFox</span></div>\n    <span class="wf-p2tag">PHASE 2 PREVIEW</span>')
once('<span>Saved places</span><span class="b" id="wfSpotCount" hidden>0</span></span></button>', '<span>Saved places</span><span class="b" id="wfSpotCount" hidden>0</span></span></button>\n' + frag('rail.html'))
once('<span class="lbl"><span>Shop</span><span class="soon">SOON</span></span>', '<span class="lbl"><span>Shop</span><span class="b" id="cartCount" hidden>0</span></span>')
# 4. views: keep the original shop (catalogue, Premium, label pack designer) and add the live
#    catalogue on top; add the new views after it
once('<section class="wf-view wf-mock" id="v-shop" hidden style="position:absolute">\n    <div class="content">',
     '<section class="wf-view wf-mock" id="v-shop" hidden style="position:absolute">\n    <div class="content">\n' + frag('shop.html'))
once("var VIEWS = ['map', 'people', 'inbox', 'tags', 'places', 'shop', 'account', 'family'];", "var VIEWS = ['map', 'people', 'inbox', 'tags', 'places', 'shop', 'account', 'family', 'labels', 'travel', 'book'];")
i = s.index('id="v-shop"'); j = s.index('</section>', i) + len('</section>')
s = s[:j] + '\n' + frag('views.html') + s[j:]
# 5. expose default tags so name-label orders can join Tags & items
once('var DEFAULT_TAGS = [', 'var DEFAULT_TAGS = window.WF_DEFAULT_TAGS = [')
# 6. Phase 2 script last, so every /new function is defined
k = s.rindex('</body>')
s = s[:k] + '<script id="phase2-js">\n' + frag('module.js') + '\n</script>\n' + s[k:]
out = os.path.join(ROOT, 'new', 'phase2', 'index.html')
open(out, 'w', encoding='utf-8').write(s)
print('built', out, len(s), 'bytes')
