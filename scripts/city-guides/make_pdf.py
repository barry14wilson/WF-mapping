# Usage: python3 make_pdf.py <city_dir>   (renders <City>_Guide.html -> .pdf, forcing lazy images to load)
import sys, json, glob
from playwright.sync_api import sync_playwright
import os; D=os.path.abspath(sys.argv[1]); html=glob.glob(f'{D}/*_Guide.html')[0]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.goto('file://'+html); pg.wait_for_timeout(4000)
    pg.evaluate("document.querySelectorAll('img').forEach(i=>{i.loading='eager'; i.src=i.src;})")
    pg.wait_for_function("[...document.images].every(i=>i.complete)", timeout=60000); pg.wait_for_timeout(1500)
    pg.emulate_media(media='print'); pg.pdf(path=html.replace('.html','.pdf'), format='A4', print_background=True, margin={'top':'12mm','bottom':'12mm','left':'10mm','right':'10mm'})
print('pdf ok')
