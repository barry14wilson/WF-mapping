# Wiley Fox affiliate links: Booking.com via CJ (publisher 101838202, ad 15734754).
# Every Booking URL is wrapped as a CJ deep link with a per-city SID (wf-xmas-<slug>) so CJ reports show which guide earned it.
import re, urllib.parse
CJ = 'https://www.jdoqocy.com/click-101838202-15734754'
def slug(city): return {'Köln': 'cologne', 'München': 'munich', 'Nürnberg': 'nuremberg'}.get(city, city.lower().replace(' ', '-'))
def wrap(booking_url, city):
    clean = re.sub(r'[&?]aid=[^&]*', '', booking_url.replace('&amp;', '&'))
    return f"{CJ}?sid=wf-xmas-{slug(city)}&url={urllib.parse.quote(clean, safe='')}"
BK_RE = re.compile(r'https://www\.booking\.com/[^"\'\s<>]*')
def rewrite(text, city):
    """Wrap every raw booking.com URL in text (json or html). Idempotent: CJ-wrapped URLs are already encoded."""
    return BK_RE.sub(lambda m: wrap(m.group(0), city), text)
