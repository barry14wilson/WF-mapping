
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var gbp = function (n) { return '£' + Number(n).toFixed(2); };
var store = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
var uid = function (p) { return (p || '') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); };
function fmtDate(d) { if (!d) return ''; var x = new Date(d + (d.length === 10 ? 'T12:00' : '')); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function dlg(html) { $('p2dlgBody').innerHTML = html; var d = $('p2dlg'); if (!d.open) d.showModal(); return d; }
$('p2dlg').addEventListener('click', function (e) { if (e.target === $('p2dlg') || e.target.closest('[data-close]')) $('p2dlg').close(); });

/* ---------- Profile pulled from the /new account + family group (same site, same browser) ---------- */
var COLOURS = ['#0F766E', '#B45309', '#1D4ED8', '#7C3AED', '#B91C1C', '#047857'];
function profile() {
  var p = store.get('wf_p2_profile', null) || { name: 'Barry Wilson', email: 'barry14wilson@gmail.com', address: '', postcode: '', example: true };
  var fam = store.get('wf_mock_family', null);
  var people = [{ id: 'me', name: p.name, role: 'You' }];
  if (fam && fam.members) fam.members.forEach(function (m, i) { if (m.role !== 'owner' && m.name) people.push({ id: 'm' + i, name: m.name, role: m.protected ? 'Protected person' : (m.role || 'Member') }); });
  else { people.push({ id: 'zoe', name: 'Zoe', role: 'Child' }); people.push({ id: 'mia', name: 'Mia', role: 'Member' }); }
  people.forEach(function (x, i) { x.colour = COLOURS[i % COLOURS.length]; });
  return { me: p, people: people, fromFamily: !!(fam && fam.members) };
}

/* ---------- Navigation: the Phase 2 views live inside the /new shell ---------- */
var P2_VIEWS = ['labels', 'travel', 'book', 'shop'];
function p2Go(v) { var b = document.querySelector('.wf-nav[data-view="' + v + '"]'); if (b) b.click(); }
function onView(v) {
  if (v === 'labels') { renderLabelControls(); renderLabel(); }
  if (v === 'travel') renderTrips();
  if (v === 'book') { if (!bKeep) bPrefill = null; bKeep = false; renderBookForm(); }
  if (v === 'shop') renderShop();
  var el = document.getElementById('v-' + v); if (el) el.scrollTop = 0;
}
document.querySelectorAll('.wf-nav[data-view]').forEach(function (b) { b.addEventListener('click', function () { if (P2_VIEWS.indexOf(b.dataset.view) >= 0) onView(b.dataset.view); }); });
// any [data-goto] / [data-shop] inside Phase 2 jumps to a system feature
document.addEventListener('click', function (e) {
  var g = e.target.closest && e.target.closest('[data-goto]');
  if (g) { e.preventDefault(); if ($('p2dlg').open) $('p2dlg').close(); p2Go(g.dataset.goto); return; }
  var sh = e.target.closest && e.target.closest('[data-shop]');
  if (sh) { e.preventDefault(); if ($('p2dlg').open) $('p2dlg').close(); sFilter = sh.dataset.shop; p2Go('shop'); }
});

/* ---------- Map + safety + guides: reuse the live /new functions ---------- */
function p2City(name) {
  var n = String(name || '').toLowerCase().trim(); if (!n) return null;
  var g = GLOBAL_CITIES.filter(function (c) { return c.name.toLowerCase() === n; })[0];
  if (g) return { name: g.name, country: g.country, lat: g.lat, lng: g.lng, rating: g.rating || null, global: g, uk: g.region === 'scotland' };
  var u = DEFAULT_CITIES.filter(function (c) { return c.name.toLowerCase() === n; })[0];
  if (u) { var cache = store.get('wf_city_rating_cache', {}); return { name: u.name, country: 'United Kingdom', lat: u.lat, lng: u.lng, rating: cache[u.name] || null, uk: true, live: true }; }
  return null;
}
function p2Geocode(q) {
  return fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1', { headers: { 'Accept-Language': 'en' } })
    .then(function (r) { return r.json(); }).then(function (j) { return j && j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; }).catch(function () { return null; });
}
var p2Marker = null;
function p2ToMap(fn) { p2Go('map'); setTimeout(function () { var gs = document.getElementById('cityGridSection'); if (gs) gs.style.display = 'none'; try { showBackBtn('\u2190 Back to city overview'); } catch (e) {} fn(); }, 250); }
// Show a destination city on the safety map
function p2ShowCity(name) {
  var c = p2City(name);
  p2ToMap(function () {
    if (p2Marker) { p2Marker.remove(); p2Marker = null; }
    if (c && c.live) loadCity(c.name, c.lat, c.lng);
    else if (c && c.global) loadGlobalCity(c.global);
    else { var si = document.getElementById('searchInput'); if (si) { si.value = name; handleSearch(); } }
  });
}
// Show one place (a hotel) on the map with the safety data for that exact spot
function p2ShowPoint(label, lat, lng, cityName, sub) {
  p2ToMap(function () {
    if (isUKCoords(lat, lng)) loadCity(label, lat, lng);
    else { var c = p2City(cityName); loadGlobalCity(c && c.global ? Object.assign({}, c.global, { lat: lat, lng: lng, displayName: label }) : { name: cityName || label, country: '', lat: lat, lng: lng }); }
    setTimeout(function () {
      if (p2Marker) p2Marker.remove();
      p2Marker = new maplibregl.Marker({ color: '#E0380D' }).setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 26 }).setHTML('<div style="font-family:Inter,sans-serif;padding:2px"><b>' + esc(label) + '</b>' + (sub ? '<br><span style="font-size:12px;color:#666">' + esc(sub) + '</span>' : '') + '<br><span style="font-size:11px;color:#999">Safety for this area is in the panel</span></div>'))
        .addTo(map); p2Marker.togglePopup();
      try { map.flyTo({ center: [lng, lat], zoom: 14.2, duration: 900 }); } catch (e) {}
    }, 1500);
  });
}
// Save a place into the existing Saved places list (same storage as Save a Spot)
function p2SavePlace(name, address, lat, lng) {
  try {
    if (igSpots.some(function (s) { return Math.abs(s.lat - lat) < 1e-4 && Math.abs(s.lng - lng) < 1e-4; })) return 'already';
    var r = getNearestSafetyRating(lat, lng);
    var spot = { id: 'ig_' + Date.now(), igUrl: null, shortcode: null, locationName: name, geoName: address, lat: lat, lng: lng, thumbnail: null, rating: (r && r.rating) || null, nearestCity: (r && r.city) || null, savedAt: new Date().toISOString(), source: 'phase2-booking' };
    igSpots.unshift(spot); igSave(); renderIgMarker(spot); renderIgList(); return 'ok';
  } catch (e) { console.warn('[p2 save place]', e); return 'fail'; }
}
// Travel guide for a city: free web guide + test PDF purchase, or a request if none exists
function p2Guide(city) {
  var c = p2City(city), key = c ? c.name : titleCase(city), url = (typeof GUIDE_LINKS !== 'undefined') ? GUIDE_LINKS[key] : null;
  if (!url) return { name: key };
  var web = /^https?:/.test(url);
  return { name: key, url: url, pdf: web ? null : url + key.replace(/ /g, '_') + '_Guide.pdf' };
}
var guidesOwned = store.get('wf_p2_guides', []);
function guideCardHTML(city) {
  var g = p2Guide(city), owned = guidesOwned.indexOf(g.name) >= 0;
  if (!g.url) {
    var req = store.get('wf_p2_guide_requests', []).indexOf(g.name) >= 0;
    return '<div class="card"><h3>' + esc(g.name) + ' travel guide</h3><p class="note" style="margin:0 0 10px">We haven\'t published a ' + esc(g.name) + ' guide yet. Ask for one and we\'ll tell you when it\'s out.</p><button class="btn btn-ghost btn-sm" data-guide-req="' + esc(g.name) + '"' + (req ? ' disabled' : '') + '>' + (req ? 'Requested' : 'Request this guide') + '</button></div>';
  }
  return '<div class="card"><h3>' + esc(g.name) + ' travel guide</h3><p class="note" style="margin:0 0 10px">Where to stay, what to avoid and local tips from creators who live there, with the official safety data.</p><div class="row"><a class="btn btn-ghost btn-sm" href="' + esc(g.url) + '" target="_blank" rel="noopener">Read the guide</a>'
    + (g.pdf ? (owned ? '<a class="btn btn-dark btn-sm" href="' + esc(g.pdf) + '" target="_blank" rel="noopener">Open your PDF</a>' : '<button class="btn btn-accent btn-sm" data-guide-buy="' + esc(g.name) + '">Printable PDF · £4.99 (test)</button>') : '') + '</div></div>';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-guide-buy]');
  if (b) {
    var name = b.dataset.guideBuy, g = p2Guide(name);
    dlg('<h2>' + esc(name) + ' guide · PDF <span class="pill pill-amber">Test</span></h2><p>£4.99 · instant download · yours to keep offline. No payment is taken in this preview.</p><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="gBuy">Buy (test)</button></div>');
    $('gBuy').onclick = function () { if (guidesOwned.indexOf(name) < 0) guidesOwned.push(name); store.set('wf_p2_guides', guidesOwned); dlg('<h2>' + esc(name) + ' guide is yours</h2><p class="note">Saved to My travel. In the live version this is a paid download from www.thewileyfox.com.</p><div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-close>Close</button><a class="btn btn-accent" href="' + esc(g.pdf) + '" target="_blank" rel="noopener">Open PDF</a></div>'); refreshOpen(); };
  }
  var r = e.target.closest && e.target.closest('[data-guide-req]');
  if (r) { var q = store.get('wf_p2_guide_requests', []); if (q.indexOf(r.dataset.guideReq) < 0) q.push(r.dataset.guideReq); store.set('wf_p2_guide_requests', q); r.textContent = 'Requested'; r.disabled = true; }
});
function refreshOpen() { var v = document.querySelector('.wf-view.p2:not([hidden])'); if (!v) return; if (v.id === 'v-travel') renderTrips(); if (v.id === 'v-book' && lastDest) renderDest(lastDest); }
function ratingLine(c) {
  if (!c) return '<span class="note">No Wiley Fox rating yet. The map shows the country-level rating.</span>';
  if (!c.rating) return '<span class="band"><span class="dot" style="background:#9ED2B2"></span>Live street-level data on the map</span>';
  return '<span class="band"><span class="dot" style="background:var(--r' + c.rating + ')"></span>Wiley Fox rating ' + c.rating + '/5 · ' + BAND[c.rating] + '</span>';
}

/* ======================================================================
   1. NAME LABELS — designer, test checkout, printer job
   ====================================================================== */
var LT = [
  { id: 'stick', name: 'Stick-on clothing labels', w: 30, h: 13, qr: true, packs: [[48, 12.99], [96, 19.99]], note: 'Stick on the care label. Wash-proof to 60°C, tumble-dryer safe.' },
  { id: 'iron', name: 'Iron-on labels', w: 45, h: 12, qr: true, packs: [[50, 11.99], [100, 18.99]], note: 'Iron onto socks, PE kit and anything without a care label.' },
  { id: 'shoe', name: 'Shoe labels', w: 28, h: 22, qr: false, packs: [[16, 7.99], [32, 12.99]], note: 'Sit inside the shoe, left and right. No QR on shoe labels.' },
  { id: 'mini', name: 'Mini stickers', w: 25, h: 8, qr: false, packs: [[120, 9.99], [240, 15.99]], note: 'For pens, rulers, glue sticks and calculators. Name only.' },
  { id: 'allergy', name: 'Allergy labels', w: 45, h: 18, qr: true, packs: [[30, 9.99], [60, 15.99]], note: 'Bold border for lunchboxes and bottles. Dishwasher safe.' }
];
var LCOL = [['#E0380D', '#fff'], ['#17130F', '#fff'], ['#1D4ED8', '#fff'], ['#0F766E', '#fff'], ['#7C3AED', '#fff'], ['#FFC857', '#17130F'], ['#F7C8D6', '#17130F'], ['#FFFFFF', '#17130F']];
var ICONS = {
  none: '',
  fox: '<path d="M4 5l4 4h8l4-4v8c0 4-3.6 7-8 7s-8-3-8-7z" fill="currentColor"/><circle cx="9.5" cy="12.5" r="1.1" fill="#fff"/><circle cx="14.5" cy="12.5" r="1.1" fill="#fff"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  ball: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7l3.5 2.6-1.3 4.2H9.8L8.5 9.6z" fill="currentColor"/>',
  rocket: '<path d="M12 3c3 2 4.5 5.5 4.5 9.5L14 16h-4l-2.5-3.5C7.5 8.5 9 5 12 3z" fill="currentColor"/><path d="M10 17l-2 4M14 17l2 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  paw: '<circle cx="7" cy="10" r="2" fill="currentColor"/><circle cx="17" cy="10" r="2" fill="currentColor"/><circle cx="10" cy="6" r="2" fill="currentColor"/><circle cx="14" cy="6" r="2" fill="currentColor"/><path d="M12 11c3 0 5 3.5 5 6 0 1.7-2 2.5-5 2.5S7 18.7 7 17c0-2.5 2-6 5-6z" fill="currentColor"/>',
  music: '<path d="M9 17V6l10-2v11" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="17" r="2.5" fill="currentColor"/><circle cx="17" cy="15" r="2.5" fill="currentColor"/>',
  flower: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><g fill="currentColor" opacity=".75"><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/></g>'
};
var L = { type: 'stick', colour: 0, icon: 'fox', pack: 0 };
var QRS = {};
function qrMatrix(text) {
  if (QRS[text]) return QRS[text];
  if (typeof qrcode === 'undefined') return null;
  var q = qrcode(0, 'M'); q.addData(text); q.make();
  var n = q.getModuleCount(), m = [];
  for (var r = 0; r < n; r++) { m.push([]); for (var c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
  return (QRS[text] = m);
}
function qrPath(m, x, y, size) {
  var n = m.length, s = size / n, d = '';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) d += 'M' + (x + c * s).toFixed(3) + ' ' + (y + r * s).toFixed(3) + 'h' + s.toFixed(3) + 'v' + s.toFixed(3) + 'h-' + s.toFixed(3) + 'z';
  return d;
}
// One label as SVG, drawn in millimetres (w x h) so the same markup is the print file.
function labelSVG(spec, opts) {
  opts = opts || {};
  var t = LT.filter(function (x) { return x.id === spec.type; })[0];
  var W = t.w, H = t.h, bg = LCOL[spec.colour][0], fg = LCOL[spec.colour][1];
  var useQR = spec.qr && t.qr;
  var pad = Math.min(H * 0.12, 2), urlH = useQR ? Math.max(1.2, H * 0.11) : 0, qrS = useQR ? H - pad * 2 - urlH : 0;
  var icon = spec.icon !== 'none' && t.id !== 'mini' ? ICONS[spec.icon] : '';
  var icS = icon ? (useQR ? Math.min(H * 0.42, 6) : Math.min(H * 0.62, 9)) : 0;
  var x0 = pad + 1 + (icon ? icS + 1.2 : 0), x1 = W - pad - (useQR ? qrS + 1.2 : 0) - 0.8;
  var lines = [spec.name || 'Name'];
  if (t.id === 'allergy') lines.push(spec.allergy || 'ALLERGY');
  else if (spec.line2 && t.id !== 'mini') lines.push(spec.line2);
  var avail = x1 - x0, fs1 = Math.min(H * (lines.length > 1 ? 0.36 : 0.5), avail / Math.max(4, lines[0].length * 0.56));
  var fs2 = Math.min(fs1 * 0.72, lines[1] ? avail / Math.max(4, lines[1].length * 0.56) : 99);
  var fam = spec.font === 'Fraunces' ? "Fraunces,Georgia,serif" : (spec.font === 'Inter' ? 'Inter,Arial,sans-serif' : "'Plus Jakarta Sans',Arial,sans-serif");
  var cy = H / 2, txt = '';
  if (lines.length > 1) {
    txt = '<text x="' + x0 + '" y="' + (cy - 0.4).toFixed(2) + '" font-family="' + fam + '" font-weight="800" font-size="' + fs1.toFixed(2) + '" fill="' + fg + '">' + esc(lines[0]) + '</text>'
        + (t.id === 'allergy'
          ? '<rect x="' + (x0 - 0.6) + '" y="' + (cy + 0.9).toFixed(2) + '" width="' + Math.min(avail + 0.6, lines[1].length * fs2 * 0.66 + 1.4).toFixed(2) + '" height="' + (fs2 * 1.3).toFixed(2) + '" rx="1" fill="#D7263D"/><text x="' + x0 + '" y="' + (cy + 0.9 + fs2 * 1.0).toFixed(2) + '" font-family="' + fam + '" font-weight="800" font-size="' + fs2.toFixed(2) + '" fill="#fff">' + esc(lines[1]) + '</text>'
          : '<text x="' + x0 + '" y="' + (cy + fs2 + 0.2).toFixed(2) + '" font-family="' + fam + '" font-weight="600" font-size="' + fs2.toFixed(2) + '" fill="' + fg + '" opacity=".85">' + esc(lines[1]) + '</text>');
  } else {
    txt = '<text x="' + x0 + '" y="' + (cy + fs1 * 0.35).toFixed(2) + '" font-family="' + fam + '" font-weight="800" font-size="' + fs1.toFixed(2) + '" fill="' + fg + '">' + esc(lines[0]) + '</text>';
  }
  var border = t.id === 'allergy' ? '<rect x=".6" y=".6" width="' + (W - 1.2) + '" height="' + (H - 1.2) + '" rx="2.4" fill="none" stroke="#D7263D" stroke-width="1.2"/>' : '';
  var ic = icon ? '<g transform="translate(' + (pad + 1) + ' ' + (cy - icS / 2).toFixed(2) + ') scale(' + (icS / 24).toFixed(3) + ')" color="' + fg + '" style="color:' + fg + '">' + icon + '</g>' : '';
  var qr = '';
  if (useQR) {
    var m = qrMatrix(spec.qrUrl || 'https://thewileyfox.com/t/WF-PREVIEW');
    var qx = W - pad - qrS, qy = pad;
    qr = '<rect x="' + (qx - 0.5) + '" y="' + (qy - 0.5) + '" width="' + (qrS + 1) + '" height="' + (qrS + 1 + urlH) + '" rx=".8" fill="#fff"/>' + (m ? '<path d="' + qrPath(m, qx, qy, qrS) + '" fill="#17130F"/>' : '')
      + '<text x="' + (qx + qrS / 2).toFixed(2) + '" y="' + (qy + qrS + urlH * 0.82).toFixed(2) + '" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="' + Math.min(urlH * 0.8, qrS / 9.5).toFixed(2) + '" fill="#17130F">thewileyfox.com</text>';
  }
  var scale = opts.scale || 4;
  var sz = opts.raw ? '' : ' width="' + (W * scale) + '" height="' + (H * scale) + '"';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + sz + (opts.cls ? ' class="' + opts.cls + '"' : '') + ' role="img" aria-label="Label preview: ' + esc(lines.join(', ')) + '">'
    + '<rect width="' + W + '" height="' + H + '" rx="' + (t.id === 'shoe' ? 4 : 2.6) + '" fill="' + bg + '"' + (bg === '#FFFFFF' ? ' stroke="#D8CBB6" stroke-width=".3"' : '') + '/>'
    + border + ic + txt + qr + '</svg>';
}
function curSpec() {
  return { type: L.type, name: $('lName').value.trim(), line2: $('lLine2').value.trim(), allergy: $('lAllergy').value.trim().toUpperCase(), font: $('lFont').value, colour: L.colour, icon: L.icon, qr: $('lQR').checked };
}
function fillWho() {
  var sel = $('lWho'); if (!sel || sel.options.length) return;
  profile().people.forEach(function (p) { var o = document.createElement('option'); o.value = p.name; o.textContent = p.name + (p.role ? ' · ' + p.role : ''); sel.appendChild(o); });
  var kid = profile().people.filter(function (p) { return /zoe/i.test(p.name); })[0]; if (kid) sel.value = kid.name;
  sel.onchange = function () { var nm = sel.value, me = profile().me.name.split(' '); $('lName').value = nm.indexOf(' ') > 0 ? nm : nm + (me[1] ? ' ' + me[me.length - 1] : ''); renderLabel(); };
}
function renderLabelControls() {
  fillWho();
  $('labTypes').innerHTML = LT.map(function (t) {
    return '<button class="lt" data-t="' + t.id + '" aria-pressed="' + (L.type === t.id) + '"><div class="nm">' + t.name + '</div><div class="sz">' + t.w + ' × ' + t.h + ' mm' + (t.qr ? ' · QR' : '') + '</div><div class="pr">from ' + gbp(t.packs[0][1]) + '</div></button>';
  }).join('');
  $('lColours').innerHTML = LCOL.map(function (c, i) { return '<button class="sw" data-c="' + i + '" style="background:' + c[0] + '" aria-label="Colour ' + c[0] + '" aria-pressed="' + (L.colour === i) + '"></button>'; }).join('');
  $('lIcons').innerHTML = Object.keys(ICONS).map(function (k) {
    return '<button class="icb" data-i="' + k + '" aria-label="' + k + '" aria-pressed="' + (L.icon === k) + '">' + (k === 'none' ? '<span class="note">None</span>' : '<svg viewBox="0 0 24 24" style="color:#3E362C">' + ICONS[k] + '</svg>') + '</button>';
  }).join('');
  var t = LT.filter(function (x) { return x.id === L.type; })[0];
  $('lPacks').innerHTML = t.packs.map(function (p, i) { return '<button class="chip" data-p="' + i + '" aria-pressed="' + (L.pack === i) + '">' + p[0] + ' labels · ' + gbp(p[1]) + '</button>'; }).join('');
}
function renderLabel() {
  var t = LT.filter(function (x) { return x.id === L.type; })[0];
  $('lAllergyWrap').hidden = t.id !== 'allergy';
  $('lLine2Wrap').hidden = t.id === 'allergy' || t.id === 'mini';
  $('lQR').disabled = !t.qr; $('lQR').parentNode.style.opacity = t.qr ? 1 : .5;
  var s = curSpec();
  $('lPhoneWarn').hidden = !/(\d[\s-]?){7,}|@|\b(street|road|rd|lane|avenue)\b/i.test(s.name + ' ' + s.line2 + ' ' + s.allergy);
  $('lBig').innerHTML = labelSVG(s, { scale: Math.min(9, 300 / t.w), cls: 'big' });
  var mini = ''; for (var i = 0; i < 6; i++) mini += labelSVG(s, { scale: Math.min(3, 110 / t.w) });
  $('lSheet').innerHTML = mini;
  $('lSizeNote').textContent = t.name + ': actual size ' + t.w + ' × ' + t.h + ' mm. ' + t.note;
  $('lTotal').textContent = gbp(t.packs[L.pack][1]);
}
$('labTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; L.type = b.dataset.t; L.pack = 0; renderLabelControls(); renderLabel(); });
$('lColours').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (!b) return; L.colour = +b.dataset.c; renderLabelControls(); renderLabel(); });
$('lIcons').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; L.icon = b.dataset.i; renderLabelControls(); renderLabel(); });
$('lPacks').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; L.pack = +b.dataset.p; renderLabelControls(); renderLabel(); });
['lName', 'lLine2', 'lAllergy', 'lFont', 'lQR'].forEach(function (id) { $(id).addEventListener('input', renderLabel); $(id).addEventListener('change', renderLabel); });

function qrCode() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'WF-'; for (var i = 0; i < 6; i++) { s += a[Math.floor(Math.random() * a.length)]; if (i === 2) s += '-'; } return s; }
// A4 print sheet (SVG, mm) — what the printer receives, one file per order line
function printSheet(spec, qty) {
  var t = LT.filter(function (x) { return x.id === spec.type; })[0];
  var gap = 3, margin = 10, cols = Math.floor((210 - 2 * margin + gap) / (t.w + gap)), rows = Math.floor((297 - 2 * margin - 12 + gap) / (t.h + gap));
  var per = cols * rows, pages = Math.ceil(qty / per), out = [];
  var one = labelSVG(spec, { raw: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  for (var p = 0; p < pages; p++) {
    var g = '', n = Math.min(per, qty - p * per);
    for (var i = 0; i < n; i++) { var c = i % cols, r = Math.floor(i / cols); g += '<g transform="translate(' + (margin + c * (t.w + gap)) + ' ' + (margin + 12 + r * (t.h + gap)) + ')">' + one + '</g>'; }
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="#fff"/>'
      + '<text x="10" y="14" font-family="Arial" font-size="3.4" fill="#8A7B67">Wiley Fox print job · ' + esc(spec.orderId) + ' · ' + esc(t.name) + ' ' + t.w + 'x' + t.h + 'mm · sheet ' + (p + 1) + '/' + pages + ' · ' + n + ' labels · cut lines = label edges</text>' + g + '</svg>');
  }
  return out;
}
function download(name, text, type) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('lCheckout').addEventListener('click', function () {
  var s = curSpec(), t = LT.filter(function (x) { return x.id === s.type; })[0];
  if (!s.name) { $('lErr').hidden = false; $('lErr').textContent = 'Add a name for the labels.'; return; }
  $('lErr').hidden = true;
  var pr = profile().me;
  dlg('<h2>Checkout <span class="pill pill-amber">Test</span></h2><p class="note">' + esc(t.name) + ' · ' + t.packs[L.pack][0] + ' labels · ' + gbp(t.packs[L.pack][1]) + ' · free UK delivery</p>'
    + '<div class="stack" style="gap:10px;margin-top:12px">'
    + '<label class="f">Name <input class="in" id="coName" value="' + esc(pr.name) + '"></label>'
    + '<label class="f">Email <input class="in" id="coEmail" value="' + esc(pr.email) + '"></label>'
    + '<label class="f">Delivery address <textarea class="in" id="coAddr" placeholder="House, street, town">' + esc(pr.address || '') + '</textarea></label>'
    + '<label class="f">Postcode <input class="in" id="coPc" value="' + esc(pr.postcode || '') + '" placeholder="e.g. RG27 9AA"></label>'
    + '<div class="banner demo">Card payment is not taken in this preview. In the live version payment runs through Shopify and the order goes to the print partner automatically.</div>'
    + '<div class="note" id="coErr" style="color:#B91C1C"></div>'
    + '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="coGo">Place test order</button></div></div>');
  $('coGo').onclick = function () {
    var addr = $('coAddr').value.trim(), pc = $('coPc').value.trim().toUpperCase();
    if (!addr || !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(pc)) { $('coErr').textContent = 'Add a delivery address and a valid UK postcode (we ship to the UK only).'; return; }
    var p = store.get('wf_p2_profile', null) || {}; p.name = $('coName').value.trim(); p.email = $('coEmail').value.trim(); p.address = addr; p.postcode = pc; store.set('wf_p2_profile', p);
    var id = 'WFL-' + uid().slice(-6), code = (s.qr && t.qr) ? qrCode() : null;
    s.orderId = id; if (code) s.qrUrl = 'https://thewileyfox.com/t/' + code;
    var order = { id: id, created: new Date().toISOString(), status: 0, spec: s, product: t.name, sku: 'WF-LBL-' + t.id.toUpperCase() + '-' + t.packs[L.pack][0], qty: t.packs[L.pack][0], price: t.packs[L.pack][1],
      size_mm: [t.w, t.h], qr_code: code, ship_to: { name: p.name, address: addr, postcode: pc, country: 'GB' }, email: p.email };
    var orders = store.get('wf_p2_label_orders', []); orders.unshift(order); store.set('wf_p2_label_orders', orders);
    if (code) { try { var tg = store.get('wf_mock_tags', null) || JSON.parse(JSON.stringify(window.WF_DEFAULT_TAGS || [])); tg.unshift({ id: code, name: (($('lWho') && $('lWho').value) || s.name) + "'s name labels", type: t.name, person: ($('lWho') && $('lWho').value) || s.name, colour: LCOL[s.colour][0], status: 'active', scans: [], fields: { name: 1, contacts: 1 }, labelOrder: id }); store.set('wf_mock_tags', tg); } catch (e) {} }
    showOrder(order);
  };
});
var STAGES = ['Order received', 'Sent to printer', 'Printed', 'Dispatched', 'Delivered'];
function printerJob(o) {
  return { job_type: 'name_labels', order_id: o.id, created_at: o.created, sku: o.sku, product: o.product, quantity: o.qty, label_size_mm: { w: o.size_mm[0], h: o.size_mm[1] },
    material: o.spec.type === 'iron' ? 'iron-on polyester' : 'vinyl, wash-proof 60C', artwork: { name: o.spec.name, line2: o.spec.line2 || null, allergy: o.spec.type === 'allergy' ? o.spec.allergy : null, font: o.spec.font, background: LCOL[o.spec.colour][0], text_colour: LCOL[o.spec.colour][1], icon: o.spec.icon, qr_url: o.qr_code ? 'https://thewileyfox.com/t/' + o.qr_code : null },
    files: [o.id + '_sheet.svg'], brand_url: 'www.thewileyfox.com', ship_to: o.ship_to, service: 'Royal Mail 2nd Class, large letter', test: true };
}
function showOrder(o) {
  var st = o.status;
  dlg('<h2>Order ' + esc(o.id) + ' <span class="pill pill-amber">Test</span></h2><p class="note">' + esc(o.product) + ' · ' + o.qty + ' labels · ' + gbp(o.price) + ' · ' + new Date(o.created).toLocaleString('en-GB') + '</p>'
    + '<div style="display:flex;justify-content:center;margin:12px 0">' + labelSVG(o.spec, { scale: Math.min(8, 260 / o.size_mm[0]) }) + '</div>'
    + '<div class="timeline">' + STAGES.map(function (s, i) { return '<div class="tl' + (i <= st ? ' done' : '') + '">' + s + '</div>'; }).join('') + '</div>'
    + (o.qr_code ? '<p class="note">QR code <b>' + o.qr_code + '</b> is now in <b>Tags &amp; items</b> as &ldquo;' + esc(o.spec.name) + '&rdquo;. If a finder scans a label, you get a message there.</p><div class="row"><button class="btn btn-ghost btn-sm" id="oTags">View in Tags &amp; items</button><button class="btn btn-ghost btn-sm" data-shop="Wristbands">Add a snap wristband</button></div>' : '')
    + '<div class="banner info" style="margin-top:8px">The printer receives a job file (order, size, artwork, delivery address) and a print-ready A4 sheet. Download both to check what they would get.</div>'
    + '<div class="row" style="margin-top:14px;justify-content:space-between"><div class="row"><button class="btn btn-ghost btn-sm" id="oJob">Printer job (JSON)</button><button class="btn btn-ghost btn-sm" id="oSheet">Print sheet (SVG)</button></div>'
    + '<div class="row"><button class="btn btn-dark btn-sm" id="oAdv"' + (st >= STAGES.length - 1 ? ' disabled' : '') + '>Simulate next step</button><button class="btn btn-ghost btn-sm" data-close>Close</button></div></div>');
  if ($('oTags')) $('oTags').onclick = function () { try { sessionStorage.setItem('p2open', 'tags'); } catch (e) {} location.reload(); };
  $('oJob').onclick = function () { download(o.id + '_printer_job.json', JSON.stringify(printerJob(o), null, 2)); };
  $('oSheet').onclick = function () { var s = Object.assign({}, o.spec, { qrUrl: o.qr_code ? 'https://thewileyfox.com/t/' + o.qr_code : null }); printSheet(s, o.qty).forEach(function (svg, i, all) { setTimeout(function () { download(o.id + '_sheet' + (all.length > 1 ? '_' + (i + 1) : '') + '.svg', svg, 'image/svg+xml'); }, i * 400); }); };
  $('oAdv').onclick = function () { var all = store.get('wf_p2_label_orders', []); all.forEach(function (x) { if (x.id === o.id) x.status = Math.min(STAGES.length - 1, x.status + 1); }); store.set('wf_p2_label_orders', all); o.status = Math.min(STAGES.length - 1, o.status + 1); showOrder(o); };
}
$('ordersBtn').addEventListener('click', function () {
  var orders = store.get('wf_p2_label_orders', []);
  dlg('<h2>My label orders</h2>' + (orders.length ? '<table class="t"><tr><th>Order</th><th>Labels</th><th>Status</th><th></th></tr>' + orders.map(function (o, i) {
    return '<tr><td><b>' + esc(o.id) + '</b><div class="note">' + new Date(o.created).toLocaleDateString('en-GB') + '</div></td><td>' + esc(o.spec.name) + '<div class="note">' + esc(o.product) + ' × ' + o.qty + '</div></td><td><span class="pill ' + (o.status >= 3 ? 'pill-green' : 'pill-amber') + '">' + STAGES[o.status] + '</span></td><td><button class="btn btn-ghost btn-sm" data-o="' + i + '">Open</button></td></tr>';
  }).join('') + '</table>' : '<div class="empty">No label orders yet.</div>') + '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" data-close>Close</button></div>');
  $('p2dlgBody').querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { showOrder(orders[+b.dataset.o]); }; });
});

/* ======================================================================
   2. MY TRAVEL — trips, itinerary, documents, medical, insurance (on-device)
   ====================================================================== */
// Passport/insurance images live in IndexedDB (too big for localStorage); everything else in localStorage.
var IDB = { db: null,
  open: function () { var self = this; if (self.db) return Promise.resolve(self.db); return new Promise(function (res, rej) { var r = indexedDB.open('wf_p2_docs', 1); r.onupgradeneeded = function () { r.result.createObjectStore('files'); }; r.onsuccess = function () { self.db = r.result; res(self.db); }; r.onerror = function () { rej(r.error); }; }); },
  put: function (k, v) { return this.open().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(v, k); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); }); },
  get: function (k) { return this.open().then(function (db) { return new Promise(function (res) { var q = db.transaction('files').objectStore('files').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }); },
  del: function (k) { return this.open().then(function (db) { return new Promise(function (res) { var tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(k); tx.oncomplete = res; }); }); }
};
function shrinkImage(file, maxW) {
  return new Promise(function (res, rej) {
    if (!/^image\//.test(file.type)) return rej(new Error('Please choose a photo (JPG or PNG).'));
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var s = Math.min(1, maxW / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8)); };
    img.onerror = function () { rej(new Error('That image could not be read.')); };
    img.src = url;
  });
}
var trips = store.get('wf_p2_trips', []);
var med = store.get('wf_p2_medical', {});
var docs = store.get('wf_p2_docs_meta', {});   // per person: passport fields (no image)
function saveTrips() { store.set('wf_p2_trips', trips); }
var curTrip = null, curTab = 'itinerary';
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }

function renderTrips() {
  if (curTrip) return renderTrip();
  $('tTitle').textContent = 'Your trips'; $('tSub').textContent = 'Flights, hotels, passports, medical details and insurance for everyone travelling, in one place.';
  $('tHeadBtns').innerHTML = '<button class="btn btn-ghost" data-goto="book">Book a trip</button><button class="btn btn-accent" id="tNew">New trip</button>'; $('tNew').onclick = newTrip;
  $('tTrip').hidden = true; $('tList').hidden = false;
  if (!trips.length) { $('tList').innerHTML = '<div class="empty"><b>No trips yet.</b><br>Create one, or book a flight or hotel and it lands here automatically.<br><br><button class="btn btn-accent" id="tNew2">Create your first trip</button></div>'; $('tNew2').onclick = newTrip; return; }
  $('tList').innerHTML = trips.map(function (t, i) {
    var n = (t.items || []).length, d = t.start ? daysBetween(new Date().toISOString().slice(0, 10), t.start) : null;
    return '<div class="card trip-card" data-i="' + i + '" role="button" tabindex="0"><div class="trip-ic">' + esc((t.city || '?').slice(0, 2).toUpperCase()) + '</div><div style="flex:1"><div style="font-weight:800;font-size:16px">' + esc(t.name) + '</div><div class="note">' + esc(t.city || '') + (t.start ? ' · ' + fmtDate(t.start) + ' – ' + fmtDate(t.end) : '') + ' · ' + (t.who || []).length + ' travelling · ' + n + ' booking' + (n === 1 ? '' : 's') + '</div></div>'
      + (d != null ? (d >= 0 ? '<span class="pill pill-accent">in ' + d + ' day' + (d === 1 ? '' : 's') + '</span>' : '<span class="pill pill-grey">past</span>') : '') + '</div>';
  }).join('');
  $('tList').querySelectorAll('[data-i]').forEach(function (c) { c.onclick = function () { curTrip = trips[+c.dataset.i].id; curTab = 'itinerary'; renderTrip(); }; });
}
function tripForm(t) {
  var ppl = profile().people; t = t || { who: ppl.map(function (p) { return p.id; }) };
  return '<div class="stack" style="gap:10px;margin-top:10px"><label class="f">Trip name <input class="in" id="tfName" value="' + esc(t.name || '') + '" placeholder="e.g. Christmas in Vienna"></label>'
    + '<label class="f">Destination city <input class="in" id="tfCity" value="' + esc(t.city || '') + '" placeholder="e.g. Vienna" list="cityList"></label>'
    + '<div class="grid2"><label class="f">From <input class="in" type="date" id="tfStart" value="' + esc(t.start || '') + '"></label><label class="f">To <input class="in" type="date" id="tfEnd" value="' + esc(t.end || '') + '"></label></div>'
    + '<div class="f">Who is travelling' + (profile().fromFamily ? ' (from your family group)' : ' (example family: create your group on the main app)') + '<div class="row person-tabs" style="margin-top:4px">' + ppl.map(function (p) { return '<label class="chip" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" value="' + p.id + '"' + (t.who.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + esc(p.name) + '</label>'; }).join('') + '</div></div>'
    + '<div class="note" id="tfErr" style="color:#B91C1C"></div></div>';
}
function readTripForm() {
  var name = $('tfName').value.trim(), city = $('tfCity').value.trim(), s = $('tfStart').value, e = $('tfEnd').value;
  var who = Array.prototype.map.call($('p2dlgBody').querySelectorAll('.person-tabs input:checked'), function (x) { return x.value; });
  if (!city) return { err: 'Add a destination city.' };
  if (s && e && e < s) return { err: 'The return date is before the start date.' };
  if (!who.length) return { err: 'Choose at least one traveller.' };
  return { name: name || (city + (s ? ' · ' + new Date(s).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '')), city: city, start: s, end: e, who: who };
}
function newTrip(prefill) {
  dlg('<h2>New trip</h2>' + tripForm(prefill && prefill.city ? prefill : null) + '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="tfGo">Create trip</button></div>');
  $('tfGo').onclick = function () { var r = readTripForm(); if (r.err) { $('tfErr').textContent = r.err; return; } r.id = uid('T'); r.items = []; r.ins = {}; trips.unshift(r); saveTrips(); $('p2dlg').close(); curTrip = r.id; curTab = 'itinerary'; p2Go('travel'); };
}
function findTrip() { return trips.filter(function (t) { return t.id === curTrip; })[0]; }
var ITEM_TYPES = { flight: 'Flight', hotel: 'Hotel', activity: 'Activity', transfer: 'Transfer' };
function itemDate(it) { return it.date || it.checkin || ''; }
function itemTime(it) { return it.time || (it.type === 'hotel' ? '15:00' : '12:00'); }
function renderTrip() {
  var t = findTrip(); if (!t) { curTrip = null; return renderTrips(); }
  var ppl = profile().people.filter(function (p) { return t.who.indexOf(p.id) >= 0; });
  $('tList').hidden = true; $('tTrip').hidden = false;
  $('tTitle').textContent = t.name; $('tSub').textContent = t.city + (t.start ? ' · ' + fmtDate(t.start) + ' – ' + fmtDate(t.end) : '') + ' · ' + ppl.map(function (p) { return p.name; }).join(', ');
  $('tHeadBtns').innerHTML = '<button class="btn btn-ghost" id="tBack">All trips</button><button class="btn btn-ghost" id="tMap">Safety map</button><button class="btn btn-ghost" id="tEdit">Edit trip</button><button class="btn btn-ghost" id="tPrint">Print / save PDF</button>';
  $('tMap').onclick = function () { p2ShowCity(t.city); };
  $('tBack').onclick = function () { curTrip = null; renderTrips(); };
  $('tPrint').onclick = function () { window.print(); };
  $('tEdit').onclick = function () {
    dlg('<h2>Edit trip</h2>' + tripForm(t) + '<div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn btn-ghost" id="tfDel" style="color:#B91C1C">Delete trip</button><div class="row"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="tfGo">Save</button></div></div>');
    $('tfGo').onclick = function () { var r = readTripForm(); if (r.err) { $('tfErr').textContent = r.err; return; } Object.assign(t, r); saveTrips(); $('p2dlg').close(); renderTrip(); };
    $('tfDel').onclick = function () { if (!confirm('Delete this trip and its bookings? Passport and medical details are kept for your next trip.')) return; trips = trips.filter(function (x) { return x.id !== t.id; }); saveTrips(); $('p2dlg').close(); curTrip = null; renderTrips(); };
  };
  var tabs = [['itinerary', 'Itinerary'], ['docs', 'Passports'], ['medical', 'Medical'], ['insurance', 'Insurance']];
  var html = '<div class="tabs">' + tabs.map(function (x) { return '<button class="chip" data-tab="' + x[0] + '" aria-pressed="' + (curTab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div id="tBody"></div>';
  $('tTrip').innerHTML = html;
  $('tTrip').querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { curTab = b.dataset.tab; renderTrip(); }; });
  var body = $('tBody');
  var warns = tripWarnings(t, ppl);
  var warnHTML = warns.length ? '<div class="stack" style="gap:8px;margin-bottom:14px">' + warns.map(function (w) { return '<div class="banner warn">' + w + '</div>'; }).join('') + '</div>' : '';
  if (curTab === 'itinerary') {
    var items = (t.items || []).slice().sort(function (a, b) { return (itemDate(a) + itemTime(a)).localeCompare(itemDate(b) + itemTime(b)); });
    body.innerHTML = warnHTML + '<div class="grid2"><div class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Itinerary</h3><div class="row"><button class="btn btn-ghost btn-sm" data-add="flight">+ Flight</button><button class="btn btn-ghost btn-sm" data-add="hotel">+ Hotel</button><button class="btn btn-ghost btn-sm" data-add="activity">+ Other</button></div></div>'
      + (items.length ? '<div class="itin">' + items.map(function (it) {
        var main = it.type === 'flight' ? '<b>' + esc(it.from) + ' → ' + esc(it.to) + '</b> · ' + esc(it.airline || '') + ' ' + esc(it.no || '') + '<div class="note">Departs ' + esc(it.time || '') + (it.arr ? ' · arrives ' + esc(it.arr) : '') + (it.ref ? ' · ref ' + esc(it.ref) : '') + '</div>'
          : it.type === 'hotel' ? '<b>' + esc(it.name) + '</b><div class="note">' + esc(it.address || '') + ' · ' + (it.checkout ? daysBetween(it.checkin, it.checkout) + ' night' + (daysBetween(it.checkin, it.checkout) === 1 ? '' : 's') : '') + (it.ref ? ' · ref ' + esc(it.ref) : '') + '</div>'
          : '<b>' + esc(it.name) + '</b><div class="note">' + esc(it.time || '') + ' ' + esc(it.note || '') + '</div>';
        var acts = it.type === 'hotel' ? '<button class="btn btn-ghost btn-sm" data-hmap="' + it.id + '">View area on map</button><button class="btn btn-ghost btn-sm" data-hsave="' + it.id + '">Save place</button>' : '';
        return '<div class="it"><div class="d">' + esc(fmtDate(itemDate(it)).toUpperCase()) + ' · ' + (ITEM_TYPES[it.type] || 'Item').toUpperCase() + (it.demo ? ' · TEST BOOKING' : '') + '</div><div class="c"><div>' + main + '</div><div class="row" style="gap:6px;justify-content:flex-end">' + acts + '<button class="btn btn-ghost btn-sm" data-del="' + it.id + '" aria-label="Remove">Remove</button></div></div></div>';
      }).join('') + '</div>' : '<div class="empty">Nothing booked yet. Add your flights and hotel, or use <a href="#book" data-go="book">Book a trip</a>.</div>')
      + '</div><div class="stack"><div class="card"><h3>Travelling</h3>' + ppl.map(function (p) {
        var pd = docs[p.id] || {}, m = med[p.id] || {};
        return '<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="row" style="gap:8px"><span class="av" style="background:' + p.colour + '">' + esc(p.name[0]) + '</span><b>' + esc(p.name) + '</b></span><span class="row" style="gap:6px">'
          + (pd.number ? '<span class="pill pill-green">Passport</span>' : '<span class="pill pill-grey">No passport</span>') + (m.allergies || m.conditions || m.medication ? '<span class="pill pill-accent">Medical</span>' : '') + '</span></div>';
      }).join('') + '</div><div class="card"><h3>Safety at ' + esc(t.city) + '</h3><div id="tSafety"></div></div><div id="tGuide"></div>'
      + '<div class="card"><h3>Before you go</h3><div class="stack" style="gap:8px">'
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-goto="people">Check your family group and roles</button>'
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-goto="account">Choose your SOS contact</button>'
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-shop="Wristbands">QR snap wristbands for the children</button>'
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-shop="Travel accessories">Travel kit: luggage stickers, adapters, locks</button>'
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-goto="places">Saved places for this trip</button>'
      + '</div></div></div></div>';
    body.querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () { addItem(t, b.dataset.add); }; });
    body.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { t.items = t.items.filter(function (x) { return x.id !== b.dataset.del; }); saveTrips(); renderTrip(); }; });
    var hotelById = function (id) { return t.items.filter(function (x) { return x.id === id; })[0]; };
    var locate = function (h) { if (h.lat) return Promise.resolve(h); return p2Geocode((h.name ? h.name + ', ' : '') + (h.address || t.city)).then(function (g) { if (!g) g = p2Geocode(h.address || t.city); return g; }).then(function (g) { if (g) { h.lat = g.lat; h.lng = g.lng; saveTrips(); } return h; }); };
    body.querySelectorAll('[data-hmap]').forEach(function (b) { b.onclick = function () { var h = hotelById(b.dataset.hmap); b.textContent = 'Finding…'; locate(h).then(function (h) { b.textContent = 'View area on map'; if (!h.lat) { alert('Could not find that address on the map. Check it in Edit, or search it on the map.'); return; } p2ShowPoint(h.name, h.lat, h.lng, t.city, h.address); }); }; });
    body.querySelectorAll('[data-hsave]').forEach(function (b) { b.onclick = function () { var h = hotelById(b.dataset.hsave); locate(h).then(function (h) { if (!h.lat) { alert('Could not find that address on the map.'); return; } var r = p2SavePlace(h.name, h.address || t.city, h.lat, h.lng); b.textContent = r === 'fail' ? 'Could not save' : 'Saved'; b.disabled = true; }); }; });
    var go = body.querySelector('[data-go]'); if (go) go.onclick = function (e) { e.preventDefault(); bookFor(t); };
    var c = p2City(t.city);
    $('tSafety').innerHTML = ratingLine(c) + '<p class="note" style="margin:8px 0 0">' + (c && c.live ? 'Live street-level crime from data.police.uk. Open the map for the area around your hotel.' : 'From the Wiley Fox safety map. Open it to see the neighbourhoods and the official figures.') + '</p><button class="btn btn-ghost btn-sm" style="margin-top:10px" id="tSafeMap">View ' + esc(t.city) + ' on the safety map</button>';
    $('tSafeMap').onclick = function () { p2ShowCity(t.city); };
    $('tGuide').innerHTML = guideCardHTML(t.city);
  } else if (curTab === 'docs') {
    body.innerHTML = warnHTML + '<div class="grid2">' + ppl.map(function (p) {
      var pd = docs[p.id] || {};
      return '<div class="card" data-p="' + p.id + '"><h3><span class="av" style="background:' + p.colour + '">' + esc(p.name[0]) + '</span> ' + esc(p.name) + '</h3><div class="stack" style="gap:10px">'
        + '<div class="grid2"><label class="f">Passport number <input class="in" data-k="number" value="' + esc(pd.number || '') + '" autocomplete="off"></label><label class="f">Nationality <input class="in" data-k="nat" value="' + esc(pd.nat || 'British') + '"></label></div>'
        + '<div class="grid2"><label class="f">Issued <input class="in" type="date" data-k="issued" value="' + esc(pd.issued || '') + '"></label><label class="f">Expires <input class="in" type="date" data-k="expiry" value="' + esc(pd.expiry || '') + '"></label></div>'
        + '<div class="row"><img class="doc-thumb" alt="Passport photo page" hidden><label class="btn btn-ghost btn-sm">Add photo page<input type="file" accept="image/*" capture="environment" hidden data-file></label><button class="btn btn-ghost btn-sm" data-rmimg hidden>Remove photo</button></div>'
        + '<div class="note">Photo is reduced in size and stored only in this browser.</div></div></div>';
    }).join('') + '</div><div class="row" style="margin-top:16px;justify-content:space-between"><span class="note">Saved automatically.</span><button class="btn btn-ghost btn-sm" id="wipe" style="color:#B91C1C">Delete all passport and medical data on this device</button></div>';
    body.querySelectorAll('.card[data-p]').forEach(function (card) {
      var pid = card.dataset.p, img = card.querySelector('img'), rm = card.querySelector('[data-rmimg]');
      IDB.get('passport_' + pid).then(function (v) { if (v) { img.src = v; img.hidden = false; rm.hidden = false; } }).catch(function () {});
      card.querySelectorAll('[data-k]').forEach(function (inp) { inp.onchange = function () { docs[pid] = docs[pid] || {}; docs[pid][inp.dataset.k] = inp.value.trim(); store.set('wf_p2_docs_meta', docs); }; });
      card.querySelector('[data-file]').onchange = function (e) { var f = e.target.files[0]; if (!f) return; shrinkImage(f, 1200).then(function (d) { return IDB.put('passport_' + pid, d).then(function () { img.src = d; img.hidden = false; rm.hidden = false; }); }).catch(function (er) { alert(er.message || 'Could not save that photo.'); }); };
      rm.onclick = function () { IDB.del('passport_' + pid).then(function () { img.hidden = true; rm.hidden = true; }); };
    });
    $('wipe').onclick = wipeSensitive;
  } else if (curTab === 'medical') {
    body.innerHTML = '<div class="banner info" style="margin-bottom:14px">Medical details are for your own reference abroad (and to show a doctor). They stay on this device. For an emergency profile that finders and first responders can see, use a Wiley Fox Medical ID band.</div><div class="grid2">' + ppl.map(function (p) {
      var m = med[p.id] || {};
      var f = function (k, l, ph) { return '<label class="f">' + l + ' <textarea class="in" data-k="' + k + '" placeholder="' + ph + '">' + esc(m[k] || '') + '</textarea></label>'; };
      return '<div class="card" data-p="' + p.id + '"><h3><span class="av" style="background:' + p.colour + '">' + esc(p.name[0]) + '</span> ' + esc(p.name) + '</h3><div class="stack" style="gap:10px">'
        + f('allergies', 'Allergies', 'e.g. peanuts (anaphylaxis), penicillin') + f('conditions', 'Conditions', 'e.g. asthma, type 1 diabetes') + f('medication', 'Medication and doses', 'e.g. salbutamol inhaler, EpiPen x2')
        + '<div class="grid2"><label class="f">Blood group <input class="in" data-k="blood" value="' + esc(m.blood || '') + '" placeholder="e.g. O+"></label><label class="f">GP / doctor phone <input class="in" data-k="gp" value="' + esc(m.gp || '') + '"></label></div>'
        + '<label class="f">Emergency contact at home <input class="in" data-k="ice" value="' + esc(m.ice || '') + '" placeholder="Name and phone"></label></div></div>';
    }).join('') + '</div><p class="note" style="margin-top:12px">Travelling with medicine? Some countries restrict common medicines. Carry a doctor\'s letter and check the destination\'s rules before you go.</p>';
    body.querySelectorAll('.card[data-p]').forEach(function (card) { var pid = card.dataset.p; card.querySelectorAll('[data-k]').forEach(function (inp) { inp.onchange = function () { med[pid] = med[pid] || {}; med[pid][inp.dataset.k] = inp.value.trim(); store.set('wf_p2_medical', med); }; }); });
  } else {
    var ins = t.ins || (t.ins = {});
    var blk = function (k, title, extra) {
      var v = ins[k] || {};
      return '<div class="card" data-k="' + k + '"><h3>' + title + '</h3><div class="stack" style="gap:10px"><div class="grid2"><label class="f">Provider <input class="in" data-f="provider" value="' + esc(v.provider || '') + '"></label><label class="f">Policy number <input class="in" data-f="policy" value="' + esc(v.policy || '') + '"></label></div>'
        + '<div class="grid2"><label class="f">24h emergency line <input class="in" data-f="phone" value="' + esc(v.phone || '') + '"></label><label class="f">Cover ends <input class="in" type="date" data-f="ends" value="' + esc(v.ends || '') + '"></label></div>' + (extra || '')
        + '<div class="row"><img class="doc-thumb" alt="Policy document" hidden><label class="btn btn-ghost btn-sm">Add certificate photo<input type="file" accept="image/*" hidden data-file></label></div></div></div>';
    };
    body.innerHTML = warnHTML + '<div class="grid2">' + blk('travel', 'Travel insurance', '<label class="f">Cover level <select class="in" data-f="level"><option value="">Choose</option>' + ['Essential', 'Standard', 'Comprehensive'].map(function (x) { return '<option' + (ins.travel && ins.travel.level === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>')
      + blk('health', 'Health cover (GHIC / private medical)', '<label class="f">GHIC card numbers <input class="in" data-f="ghic" value="' + esc((ins.health || {}).ghic || '') + '" placeholder="UK GHIC covers state healthcare in the EU, not repatriation"></label>')
      + '</div><div class="row" style="margin-top:16px"><button class="btn btn-accent" id="getQuotes">Compare travel insurance for ' + esc(t.city) + '</button></div>';
    body.querySelectorAll('.card[data-k]').forEach(function (card) {
      var k = card.dataset.k, img = card.querySelector('img');
      IDB.get('ins_' + t.id + '_' + k).then(function (v) { if (v) { img.src = v; img.hidden = false; } }).catch(function () {});
      card.querySelectorAll('[data-f]').forEach(function (inp) { inp.onchange = function () { ins[k] = ins[k] || {}; ins[k][inp.dataset.f] = inp.value.trim(); saveTrips(); }; });
      card.querySelector('[data-file]').onchange = function (e) { var f = e.target.files[0]; if (!f) return; shrinkImage(f, 1200).then(function (d) { return IDB.put('ins_' + t.id + '_' + k, d).then(function () { img.src = d; img.hidden = false; }); }).catch(function (er) { alert(er.message); }); };
    });
    $('getQuotes').onclick = function () { bookFor(t, 'insurance'); };
  }
}
function tripWarnings(t, ppl) {
  var w = [], end = t.end || t.start;
  ppl.forEach(function (p) {
    var pd = docs[p.id] || {};
    if (!pd.expiry) return;
    if (end && pd.expiry < end) w.push('<b>' + esc(p.name) + '\'s passport expires before you return</b> (' + fmtDate(pd.expiry) + ').');
    else if (end && daysBetween(end, pd.expiry) < 183) w.push('<b>' + esc(p.name) + '\'s passport has less than 6 months left after the trip.</b> Many countries require 3–6 months\' validity; check the entry rules for ' + esc(t.city) + '.');
    if (pd.issued && t.start && EU_CITIES.indexOf(t.city.toLowerCase()) >= 0 && daysBetween(pd.issued, t.start) > 3650) w.push('<b>' + esc(p.name) + '\'s passport was issued more than 10 years before travel.</b> The EU and Schengen area will not accept it.');
  });
  if (t.start && !(t.ins && t.ins.travel && t.ins.travel.policy)) w.push('No travel insurance recorded for this trip yet.');
  return w;
}
function addItem(t, type) {
  var f = type === 'flight'
    ? '<div class="grid2"><label class="f">From <input class="in" id="iFrom" placeholder="LHR"></label><label class="f">To <input class="in" id="iTo" placeholder="VIE"></label></div><div class="grid2"><label class="f">Airline <input class="in" id="iAir"></label><label class="f">Flight number <input class="in" id="iNo"></label></div><div class="grid3"><label class="f">Date <input class="in" type="date" id="iDate" value="' + esc(t.start || '') + '"></label><label class="f">Departs <input class="in" type="time" id="iTime"></label><label class="f">Arrives <input class="in" type="time" id="iArr"></label></div><label class="f">Booking reference <input class="in" id="iRef"></label>'
    : type === 'hotel'
    ? '<label class="f">Hotel name <input class="in" id="iName"></label><label class="f">Address <input class="in" id="iAddr"></label><div class="grid2"><label class="f">Check-in <input class="in" type="date" id="iIn" value="' + esc(t.start || '') + '"></label><label class="f">Check-out <input class="in" type="date" id="iOut" value="' + esc(t.end || '') + '"></label></div><label class="f">Booking reference <input class="in" id="iRef"></label>'
    : '<label class="f">What <input class="in" id="iName" placeholder="e.g. Christmas market tour, airport transfer"></label><div class="grid2"><label class="f">Date <input class="in" type="date" id="iDate" value="' + esc(t.start || '') + '"></label><label class="f">Time <input class="in" type="time" id="iTime"></label></div><label class="f">Notes <input class="in" id="iNote"></label>';
  dlg('<h2>Add ' + (ITEM_TYPES[type] || 'item').toLowerCase() + '</h2><div class="stack" style="gap:10px;margin-top:10px">' + f + '<div class="note" id="iErr" style="color:#B91C1C"></div></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="iGo">Add</button></div>');
  $('iGo').onclick = function () {
    var v = function (id) { var e = $(id); return e ? e.value.trim() : ''; }, it = { id: uid('I'), type: type };
    if (type === 'flight') { Object.assign(it, { from: v('iFrom').toUpperCase(), to: v('iTo').toUpperCase(), airline: v('iAir'), no: v('iNo').toUpperCase(), date: v('iDate'), time: v('iTime'), arr: v('iArr'), ref: v('iRef').toUpperCase() }); if (!it.from || !it.to || !it.date) { $('iErr').textContent = 'Add from, to and the date.'; return; } }
    else if (type === 'hotel') { Object.assign(it, { name: v('iName'), address: v('iAddr'), checkin: v('iIn'), checkout: v('iOut'), ref: v('iRef') }); if (!it.name || !it.checkin) { $('iErr').textContent = 'Add the hotel name and check-in date.'; return; } if (it.checkout && it.checkout <= it.checkin) { $('iErr').textContent = 'Check-out must be after check-in.'; return; } }
    else { Object.assign(it, { name: v('iName'), date: v('iDate'), time: v('iTime'), note: v('iNote') }); if (!it.name || !it.date) { $('iErr').textContent = 'Add what it is and the date.'; return; } }
    t.items = t.items || []; t.items.push(it); saveTrips(); $('p2dlg').close(); renderTrip();
  };
}
function wipeSensitive() {
  if (!confirm('Delete every passport detail, passport photo and medical note stored on this device? Trips and bookings are kept.')) return;
  docs = {}; med = {}; store.set('wf_p2_docs_meta', docs); store.set('wf_p2_medical', med);
  IDB.open().then(function (db) { var tx = db.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = function () { renderTrip(); }; }).catch(function () { renderTrip(); });
}

/* ---------- City data shared by Book + Travel (ratings from the live map, Oct 2026) ---------- */
var BAND = { 1: 'High caution', 2: 'Caution', 3: 'Stay aware', 4: 'Low incidents', 5: 'Very low incidents' };
var CITY = {
  paris: [3, 'FR'], barcelona: [3, 'ES'], rome: [3, 'IT'], amsterdam: [4, 'NL'], berlin: [3, 'DE'], munich: [4, 'DE'], cologne: [3, 'DE'], strasbourg: [3, 'FR'], nuremberg: [4, 'DE'],
  lisbon: [4, 'PT'], vienna: [4, 'AT'], prague: [4, 'CZ'], istanbul: [3, 'TR'], 'new york': [3, 'US'], miami: [2, 'US'], toronto: [4, 'CA'], 'mexico city': [2, 'MX'], tokyo: [5, 'JP'],
  bangkok: [3, 'TH'], sydney: [4, 'AU'], dubai: [5, 'AE'], singapore: [5, 'SG'], bali: [3, 'ID'], 'cape town': [1, 'ZA'], marrakech: [3, 'MA'], chicago: [3, 'US'], 'san francisco': [2, 'US'],
  'los angeles': [2, 'US'], dublin: [3, 'IE'], cork: [4, 'IE'], galway: [5, 'IE'], limerick: [4, 'IE'], lyon: [3, 'FR'], marseille: [3, 'FR'], nice: [3, 'FR'], milan: [3, 'IT'], florence: [3, 'IT'],
  venice: [4, 'IT'], naples: [4, 'IT'], edinburgh: [4, 'GB'], glasgow: [4, 'GB'], aberdeen: [4, 'GB'], inverness: [5, 'GB'],
  london: [0, 'GB'], manchester: [0, 'GB'], birmingham: [0, 'GB'], liverpool: [0, 'GB'], leeds: [0, 'GB'], bristol: [0, 'GB'], newcastle: [0, 'GB'], cardiff: [0, 'GB'], belfast: [0, 'GB'], brighton: [0, 'GB']
};
var EU_CITIES = Object.keys(CITY).filter(function (k) { return ['FR', 'ES', 'IT', 'NL', 'DE', 'PT', 'AT', 'CZ'].indexOf(CITY[k][1]) >= 0; });
var IATA = { london: 'LHR', paris: 'CDG', barcelona: 'BCN', rome: 'FCO', amsterdam: 'AMS', berlin: 'BER', munich: 'MUC', cologne: 'CGN', strasbourg: 'SXB', nuremberg: 'NUE', lisbon: 'LIS', vienna: 'VIE', prague: 'PRG', istanbul: 'IST', 'new york': 'JFK', miami: 'MIA', toronto: 'YYZ', 'mexico city': 'MEX', tokyo: 'HND', bangkok: 'BKK', sydney: 'SYD', dubai: 'DXB', singapore: 'SIN', bali: 'DPS', 'cape town': 'CPT', marrakech: 'RAK', chicago: 'ORD', 'san francisco': 'SFO', 'los angeles': 'LAX', dublin: 'DUB', cork: 'ORK', galway: 'SNN', limerick: 'SNN', lyon: 'LYS', marseille: 'MRS', nice: 'NCE', milan: 'MXP', florence: 'FLR', venice: 'VCE', naples: 'NAP', edinburgh: 'EDI', glasgow: 'GLA', aberdeen: 'ABZ', inverness: 'INV', manchester: 'MAN', birmingham: 'BHX', bristol: 'BRS', belfast: 'BFS', newcastle: 'NCL', leeds: 'LBA', liverpool: 'LPL', cardiff: 'CWL', southampton: 'SOU', gatwick: 'LGW' };
function cityRating_unused(name) {
  var c = CITY[String(name || '').toLowerCase().trim()];
  if (!c) return null;
  if (!c[0]) return { b: 0, src: 'Live street-level rating on the map (data.police.uk).' };
  return { b: c[0], src: c[1] === 'GB' ? 'Scottish Government recorded crime, 2025-26, blended with Numbeo.' : 'Official police-recorded crime vs the national average, blended with Numbeo.' };
}
function region(name) {
  var c = CITY[String(name || '').toLowerCase().trim()]; if (!c) return 'Worldwide (excl. USA, Canada)';
  var cc = c[1]; if (cc === 'GB') return 'UK'; if (['FR', 'ES', 'IT', 'NL', 'DE', 'PT', 'AT', 'CZ', 'IE'].indexOf(cc) >= 0) return 'Europe'; if (['US', 'CA', 'MX'].indexOf(cc) >= 0) return 'Worldwide (incl. USA, Canada)'; return 'Worldwide (excl. USA, Canada)';
}
document.body.insertAdjacentHTML('beforeend', '<datalist id="cityList">' + Object.keys(CITY).map(function (k) { return '<option value="' + k.replace(/\b\w/g, function (m) { return m.toUpperCase(); }) + '">'; }).join('') + '</datalist>');
function titleCase(s) { return String(s).toLowerCase().replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
// Deterministic pseudo-random so the same search gives the same test results
function rng(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }

/* ======================================================================
   3. BOOK — test flights, hotels, insurance quotes; results feed My travel
   ====================================================================== */
var bMode = 'flights', bPrefill = null, bKeep = false, lastDest = null;
function bookFor(t, mode) { bPrefill = t; bMode = mode || 'flights'; bKeep = true; p2Go('book'); }
function renderBookForm() {
  document.querySelectorAll('#bTabs [data-b]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.b === bMode); });
  var t = bPrefill || {}, ppl = profile().people, n = t.who ? t.who.length : 3;
  var today = new Date(); today.setDate(today.getDate() + 30); var d1 = t.start || today.toISOString().slice(0, 10); today.setDate(today.getDate() + 4); var d2 = t.end || today.toISOString().slice(0, 10);
  var city = '<label class="f">' + (bMode === 'flights' ? 'To' : 'Destination city') + ' <input class="in" id="bCity" list="cityList" value="' + esc(t.city || 'Vienna') + '"></label>';
  var f;
  if (bMode === 'flights') f = '<label class="f">From <input class="in" id="bFrom" list="cityList" value="London"></label>' + city + '<label class="f">Passengers <input class="in" type="number" min="1" max="9" id="bPax" value="' + n + '"></label><label class="f">Depart <input class="in" type="date" id="bD1" value="' + d1 + '"></label><label class="f">Return <input class="in" type="date" id="bD2" value="' + d2 + '"></label>';
  else if (bMode === 'hotels') f = city + '<label class="f">Guests <input class="in" type="number" min="1" max="12" id="bPax" value="' + n + '"></label><label class="f">Rooms <input class="in" type="number" min="1" max="6" id="bRooms" value="1"></label><label class="f">Check-in <input class="in" type="date" id="bD1" value="' + d1 + '"></label><label class="f">Check-out <input class="in" type="date" id="bD2" value="' + d2 + '"></label>';
  else f = city + '<label class="f">Travellers <input class="in" type="number" min="1" max="9" id="bPax" value="' + n + '"></label><label class="f">Oldest traveller\'s age <input class="in" type="number" min="0" max="99" id="bAge" value="44"></label><label class="f">From <input class="in" type="date" id="bD1" value="' + d1 + '"></label><label class="f">To <input class="in" type="date" id="bD2" value="' + d2 + '"></label><label class="f">Existing medical conditions <select class="in" id="bMed"><option value="0">None to declare</option><option value="1">Yes, to be declared</option></select></label>';
  $('bForm').innerHTML = f + '<div style="display:flex;align-items:flex-end"><button class="btn btn-accent" id="bGo" style="width:100%">' + (bMode === 'insurance' ? 'Get quotes' : 'Search') + '</button></div><div class="note" id="bErr" style="color:#B91C1C;grid-column:1/-1"></div>';
  $('bGo').onclick = runSearch;
  $('bResults').innerHTML = bPrefill ? '<div class="note">Results will be added to <b>' + esc(bPrefill.name) + '</b>.</div>' : '';
  $('bDest').innerHTML = '';
}
document.querySelectorAll('#bTabs [data-b]').forEach(function (b) { b.onclick = function () { bMode = b.dataset.b; renderBookForm(); }; });
function runSearch() {
  var city = $('bCity').value.trim(), d1 = $('bD1').value, d2 = $('bD2').value, pax = Math.max(1, +$('bPax').value || 1);
  if (!city) { $('bErr').textContent = 'Add a destination.'; return; }
  if (!d1 || !d2 || d2 <= d1) { $('bErr').textContent = 'Choose dates with the return after the start.'; return; }
  if (d1 < new Date().toISOString().slice(0, 10)) { $('bErr').textContent = 'The start date is in the past.'; return; }
  $('bErr').textContent = '';
  renderDest(city);
  if (bMode === 'flights') flights($('bFrom').value.trim() || 'London', city, d1, d2, pax);
  else if (bMode === 'hotels') hotels(city, d1, d2, pax, +$('bRooms').value || 1);
  else insurance(city, d1, d2, pax, +$('bAge').value || 40, $('bMed').value === '1');
}
function renderDest(city) {
  lastDest = city; var c = p2City(city), nm = c ? c.name : titleCase(city);
  $('bDest').innerHTML = '<div class="grid2"><div class="card"><h3>Is ' + esc(nm) + ' right for you?</h3>' + ratingLine(c)
    + '<p class="note" style="margin:8px 0 12px">Check the neighbourhoods before you book: where crime concentrates, the official figures and current travel advice.</p><div class="row"><button class="btn btn-accent btn-sm" id="dMap">Check safety on the map</button>'
    + (bMode !== 'hotels' ? '<button class="btn btn-ghost btn-sm" id="dHot">Hotels in ' + esc(nm) + '</button>' : '') + (bMode !== 'insurance' ? '<button class="btn btn-ghost btn-sm" id="dIns">Insurance for ' + esc(nm) + '</button>' : '') + '</div></div>' + guideCardHTML(nm) + '</div>';
  $('dMap').onclick = function () { p2ShowCity(nm); };
  var sw = function (m) { return function () { var d1 = $('bD1').value, d2 = $('bD2').value, px = $('bPax').value; bMode = m; renderBookForm(); $('bCity').value = nm; $('bD1').value = d1; $('bD2').value = d2; $('bPax').value = px; runSearch(); }; };
  if ($('dHot')) $('dHot').onclick = sw('hotels'); if ($('dIns')) $('dIns').onclick = sw('insurance');
}
function code(c) { return IATA[c.toLowerCase()] || c.slice(0, 3).toUpperCase(); }
function flights(from, to, d1, d2, pax) {
  var r = rng(from + to + d1 + d2), A = [['Wiley Air (test)', 'WA'], ['Example Airways', 'EX'], ['Sample Jet', 'SJ']], longHaul = /^Worldwide/.test(region(to));
  var dur = longHaul ? 420 + Math.round(r() * 300) : 90 + Math.round(r() * 80), out = [];
  for (var i = 0; i < 5; i++) {
    var a = A[Math.floor(r() * A.length)], dep = 6 * 60 + Math.round(r() * 14 * 60), stops = longHaul && r() > .6 ? 1 : 0, d = dur + stops * 95;
    var fare = Math.round((longHaul ? 380 : 55) + r() * (longHaul ? 420 : 140)) + (stops ? -40 : 0);
    out.push({ air: a[0], no: a[1] + (100 + Math.floor(r() * 899)), dep: dep, arr: dep + d, dur: d, stops: stops, fare: fare, bag: r() > .5 });
  }
  out.sort(function (x, y) { return x.fare - y.fare; });
  var hm = function (m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  $('bResults').innerHTML = '<div class="note">' + out.length + ' test fares · ' + code(from) + ' → ' + code(to) + ' · ' + fmtDate(d1) + ' · ' + pax + ' passenger' + (pax > 1 ? 's' : '') + ' · return ' + fmtDate(d2) + '</div>' + out.map(function (f, i) {
    return '<div class="card res"><div><div class="when">' + hm(f.dep) + ' → ' + hm(f.arr) + (f.arr >= 1440 ? ' <span class="note">+1</span>' : '') + '</div><div class="sub">' + f.air + ' ' + f.no + ' · ' + Math.floor(f.dur / 60) + 'h ' + (f.dur % 60) + 'm · ' + (f.stops ? '1 stop' : 'Direct') + ' · ' + (f.bag ? 'hold bag included' : 'cabin bag only') + '</div></div>'
      + '<div style="text-align:right"><div class="price">' + gbp(f.fare * pax * 2) + '</div><div class="sub">return, ' + pax + ' passenger' + (pax > 1 ? 's' : '') + '</div><button class="btn btn-accent btn-sm" style="margin-top:6px" data-i="' + i + '">Book (test)</button></div></div>';
  }).join('');
  $('bResults').querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () {
    var f = out[+b.dataset.i], ref = 'TST' + uid().slice(-5);
    confirmBooking(to, d1, d2, [
      { id: uid('I'), type: 'flight', from: code(from), to: code(to), airline: f.air, no: f.no, date: d1, time: hm(f.dep), arr: hm(f.arr), ref: ref, demo: true },
      { id: uid('I'), type: 'flight', from: code(to), to: code(from), airline: f.air, no: f.no.replace(/\d+/, function (n) { return +n + 1; }), date: d2, time: hm(f.dep + 180), arr: hm(f.dep + 180 + f.dur), ref: ref, demo: true }
    ], 'Return flights ' + code(from) + ' ⇄ ' + code(to) + ' · ' + gbp(f.fare * pax * 2), pax);
  }; });
}
function hotels(city, d1, d2, pax, rooms) {
  var r = rng(city + d1 + d2), nights = daysBetween(d1, d2), c = p2City(city);
  var names = ['The Linden', 'Hotel Meridian', 'Harbour House', 'The Old Post Office', 'Riverside Suites', 'Casa Verde'];
  var areas = [['City centre', 0.2, 0.3], ['Old town', -0.7, 0.5], ['Near the main station', 1.1, -0.6], ['Riverside', -0.4, -1.2], ['Museum quarter', 1.6, 0.9], ['Quiet residential', -2.4, 2.1]];
  var place = function (lat, lng) {
    var out = names.map(function (n, i) { var a = areas[i]; return { name: n, area: a[0], lat: +(lat + a[2] / 111).toFixed(5), lng: +(lng + a[1] / (111 * Math.cos(lat * Math.PI / 180))).toFixed(5), stars: 3 + Math.floor(r() * 3), score: (7.6 + r() * 2.1).toFixed(1), pn: Math.round(70 + r() * 210), free: r() > .4 }; });
    var bk = 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(city) + '&checkin=' + d1 + '&checkout=' + d2 + '&group_adults=' + pax + '&no_rooms=' + rooms;
    $('bResults').innerHTML = '<div class="row" style="justify-content:space-between"><div class="note">' + out.length + ' test stays in ' + esc(titleCase(city)) + ' · ' + nights + ' night' + (nights > 1 ? 's' : '') + ' · ' + pax + ' guest' + (pax > 1 ? 's' : '') + '. Positions are illustrative; tap <b>View area on map</b> for the real safety data at that spot.</div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener sponsored" href="' + esc(wfBook(bk, 'wf-phase2')) + '">See real prices on Booking.com</a></div>'
      + '<div class="grid3">' + out.map(function (h, i) {
        return '<div class="card"><div class="hotel-img">' + esc(h.name) + '</div><div style="font-weight:800">' + esc(h.name) + ' <span class="note">' + '\u2605'.repeat(h.stars) + '</span></div><div class="note">' + esc(h.area) + ' · guest score ' + h.score + (h.free ? ' · free cancellation' : '') + '</div>'
          + '<div style="margin-top:6px">' + ratingLine(c) + '</div>'
          + '<div class="row" style="gap:6px;margin-top:8px"><button class="btn btn-ghost btn-sm" data-m="' + i + '">View area on map</button><button class="btn btn-ghost btn-sm" data-s="' + i + '">Save place</button></div>'
          + '<div class="row" style="justify-content:space-between;margin-top:10px"><div><div class="price">' + gbp(h.pn * nights * rooms) + '</div><div class="note">' + gbp(h.pn) + ' / night</div></div><button class="btn btn-accent btn-sm" data-i="' + i + '">Book (test)</button></div></div>';
      }).join('') + '</div>';
    $('bResults').querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { var h = out[+b.dataset.m]; p2ShowPoint(h.name + ' (test hotel)', h.lat, h.lng, city, h.area + ', ' + titleCase(city)); }; });
    $('bResults').querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { var h = out[+b.dataset.s]; var res = p2SavePlace(h.name + ' (test hotel)', h.area + ', ' + titleCase(city), h.lat, h.lng); b.textContent = res === 'fail' ? 'Could not save' : 'Saved to Saved places'; b.disabled = true; }; });
    $('bResults').querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () {
      var h = out[+b.dataset.i];
      confirmBooking(city, d1, d2, [{ id: uid('I'), type: 'hotel', name: h.name, address: h.area + ', ' + titleCase(city), lat: h.lat, lng: h.lng, checkin: d1, checkout: d2, ref: 'TST' + uid().slice(-5), demo: true }], h.name + ' · ' + nights + ' nights · ' + gbp(h.pn * nights * rooms), pax);
    }; });
  };
  if (c) place(c.lat, c.lng);
  else { $('bResults').innerHTML = '<div class="note">Finding ' + esc(city) + '…</div>'; p2Geocode(city).then(function (g) { if (g) place(g.lat, g.lng); else $('bResults').innerHTML = '<div class="empty">We could not find ' + esc(city) + ' on the map.</div>'; }); }
}
function insurance(city, d1, d2, pax, age, medical) {
  var reg = region(city), days = daysBetween(d1, d2), pc = p2City(city), rate = pc && pc.rating ? { b: pc.rating } : null, r = rng(city + d1 + d2 + pax + age);
  var base = { 'UK': 3.1, 'Europe': 4.4, 'Worldwide (excl. USA, Canada)': 7.6, 'Worldwide (incl. USA, Canada)': 12.5 }[reg];
  var ageF = age >= 70 ? 2.6 : age >= 60 ? 1.7 : age >= 50 ? 1.25 : 1, medF = medical ? 1.45 : 1;
  var tiers = [['Essential', 0.7, '£2m medical · £1,000 cancellation · £750 baggage · £250 gadgets'], ['Standard', 1, '£10m medical · £3,000 cancellation · £1,500 baggage · £500 gadgets · strike cover'], ['Comprehensive', 1.55, 'Unlimited medical · £7,500 cancellation · £2,500 baggage · £1,000 gadgets · strike and missed-departure cover']];
  var insurers = ['Example Insurer A', 'Example Insurer B', 'Example Insurer C'];
  var q = [];
  insurers.forEach(function (ins, i) { tiers.forEach(function (t) { var p = Math.max(9, base * Math.pow(days, 0.62) * t[1] * ageF * medF * (0.9 + r() * 0.25) * (pax > 1 ? 1 + (pax - 1) * 0.55 : 1)); q.push({ ins: ins, tier: t[0], cover: t[2], price: p, rating: (3.8 + r() * 1.1).toFixed(1) }); }); });
  q.sort(function (a, b) { return a.price - b.price; });
  var tips = [];
  if (rate && rate.b && rate.b <= 3) tips.push('The Wiley Fox rating for ' + esc(titleCase(city)) + ' is ' + rate.b + '/5 (' + BAND[rate.b] + '). Most claims here are theft: check the gadget and personal-belongings limits, and that "unattended items" are covered.');
  if (reg === 'Europe') tips.push('Your UK GHIC covers state healthcare in the EU, but not private treatment, mountain rescue or flying you home. You still need travel insurance.');
  if (/incl\. USA/.test(reg)) tips.push('US medical costs are very high. Choose at least £10m of medical cover.');
  if (medical) tips.push('Declare every existing condition. An undeclared condition is the most common reason claims are refused.');
  tips.push('Policies usually exclude areas where the FCDO advises against travel. Check the travel advice for ' + esc(titleCase(city)) + ' before buying.');
  $('bResults').innerHTML = '<div class="card"><h3>Before you choose · ' + esc(titleCase(city)) + ' · ' + esc(reg) + ' · ' + days + ' days</h3><ul style="margin:0;padding-left:18px">' + tips.map(function (x) { return '<li style="margin-bottom:6px">' + x + '</li>'; }).join('') + '</ul></div>'
    + '<div class="card"><table class="t"><tr><th>Insurer</th><th>Cover</th><th>What\'s included</th><th>Price</th><th></th></tr>' + q.slice(0, 6).map(function (x, i) {
      return '<tr><td><b>' + x.ins + '</b><div class="note">rated ' + x.rating + '/5 (test)</div></td><td>' + x.tier + '</td><td class="note">' + x.cover + '</td><td><b>' + gbp(x.price) + '</b><div class="note">' + pax + ' traveller' + (pax > 1 ? 's' : '') + '</div></td><td><button class="btn btn-accent btn-sm" data-i="' + i + '">Choose (test)</button></td></tr>';
    }).join('') + '</table><p class="note" style="margin:10px 0 0">Illustrative quotes, worked out on this page. Real quotes need an FCA-authorised insurance partner; Wiley Fox would introduce, not sell, the policy.</p></div>';
  $('bResults').querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () {
    var x = q[+b.dataset.i], t = targetTrip(city, d1, d2, pax);
    t.ins = t.ins || {}; t.ins.travel = { provider: x.ins + ' (test)', policy: 'TEST-' + uid().slice(-6), phone: '+44 0000 000000 (test)', ends: d2, level: x.tier }; saveTrips();
    dlg('<h2>Test policy added</h2><p>' + esc(x.ins) + ' · ' + esc(x.tier) + ' · ' + gbp(x.price) + ' is saved to <b>' + esc(t.name) + '</b> under Insurance. Nothing was bought.</p><div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-close>Keep browsing</button><button class="btn btn-accent" id="toTrip">Open trip</button></div>');
    $('toTrip').onclick = function () { $('p2dlg').close(); curTrip = t.id; curTab = 'insurance'; p2Go('travel'); };
  }; });
}
function targetTrip(city, d1, d2, pax) {
  if (bPrefill && trips.some(function (t) { return t.id === bPrefill.id; })) return findTripById(bPrefill.id);
  var match = trips.filter(function (t) { return t.city && t.city.toLowerCase() === city.toLowerCase() && t.start === d1; })[0];
  if (match) return match;
  var ppl = profile().people.slice(0, pax).map(function (p) { return p.id; });
  var t = { id: uid('T'), name: titleCase(city) + ' · ' + new Date(d1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), city: titleCase(city), start: d1, end: d2, who: ppl, items: [], ins: {} };
  trips.unshift(t); saveTrips(); return t;
}
function findTripById(id) { return trips.filter(function (t) { return t.id === id; })[0]; }
function confirmBooking(city, d1, d2, items, label, pax) {
  dlg('<h2>Confirm test booking</h2><p>' + esc(label) + '</p><div class="banner demo">This is a test. No payment is taken and nothing is booked with an airline or hotel. The booking is saved to My travel so you can see how the itinerary works.</div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-accent" id="cbGo">Confirm (test)</button></div>');
  $('cbGo').onclick = function () {
    var t = targetTrip(city, d1, d2, pax); t.items = (t.items || []).concat(items); saveTrips();
    var nm = (p2City(city) || {}).name || titleCase(city);
    dlg('<h2>Added to ' + esc(t.name) + '</h2><p class="note">Test reference ' + esc(items[0].ref) + '</p>' + guideCardHTML(nm)
      + '<div class="stack" style="gap:8px;margin-top:12px"><button class="btn btn-ghost btn-sm" style="justify-content:flex-start" id="cbMap">Check ' + esc(nm) + ' on the safety map</button>'
      + (items[0].type === 'flight' ? '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" id="cbHot">Find a hotel in ' + esc(nm) + '</button>' : '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" id="cbIns">Travel insurance for ' + esc(nm) + '</button>')
      + '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start" data-shop="Wristbands">QR snap wristbands for the children</button></div>'
      + '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" data-close>Keep browsing</button><button class="btn btn-accent" id="toTrip">Open trip</button></div>');
    $('toTrip').onclick = function () { $('p2dlg').close(); curTrip = t.id; curTab = 'itinerary'; p2Go('travel'); };
    $('cbMap').onclick = function () { $('p2dlg').close(); p2ShowCity(nm); };
    var again = function (m) { return function () { $('p2dlg').close(); bPrefill = t; bMode = m; renderBookForm(); runSearch(); }; };
    if ($('cbHot')) $('cbHot').onclick = again('hotels'); if ($('cbIns')) $('cbIns').onclick = again('insurance');
  };
}

/* ======================================================================
   4. SHOP — Shopify catalogue snapshot (shop.json)
   ====================================================================== */
var SHOP = null, sFilter = 'All', cart = store.get('wf_p2_cart', []);
var FILTERS = [['All', null], ['Bundles', 'Bundles'], ['Travel accessories', 'Travel Accessories'], ['Wristbands', 'Wristbands'], ['Medical ID', 'Medical ID'], ['Stickers', 'Stickers and Labels'], ['Tags & keyrings', 'Tags and Keyrings']];
var BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5.5 8h13l-1.2 12H6.7L5.5 8z"/><path d="M9 8a3 3 0 016 0"/></svg>';
var CASE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 20v1.5M15 20v1.5"/></svg>';
function updateCartCount() { var n = cart.reduce(function (a, c) { return a + c.q; }, 0); $('cartCount').hidden = !n; $('cartCount').textContent = n; }
function renderShop() {
  if (!SHOP) { $('sGrid').innerHTML = '<div class="note">Loading catalogue…</div>'; fetch('shop.json').then(function (r) { return r.json(); }).then(function (d) { SHOP = d; renderShop(); }).catch(function () { $('sGrid').innerHTML = '<div class="empty">The catalogue could not be loaded.</div>'; }); return; }
  $('sSnap').textContent = new Date(SHOP.snapshot).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  $('sFilters').innerHTML = FILTERS.map(function (f) { return '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (sFilter === f[0]) + '">' + f[0] + '</button>'; }).join('');
  $('sFilters').querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { sFilter = b.dataset.f; renderShop(); }; });
  var type = FILTERS.filter(function (f) { return f[0] === sFilter; })[0][1];
  var list = SHOP.products.filter(function (p) { return !type || p.type === type; });
  $('sGrid').innerHTML = list.map(function (p) {
    var i = SHOP.products.indexOf(p), soon = p.status !== 'ACTIVE';
    return '<div class="card prod"><div class="img">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">' : (p.type === 'Travel Accessories' ? CASE : BAG)) + '</div>'
      + '<div class="row" style="gap:6px">' + (soon ? '<span class="pill pill-grey">Coming soon</span>' : '') + (p.tags.indexOf('hero') >= 0 ? '<span class="pill pill-accent">Bestseller</span>' : '') + '</div>'
      + '<div class="t">' + esc(p.title) + '</div><div class="bl">' + esc(p.blurb) + '</div>'
      + '<a class="note" href="https://www.thewileyfox.com" target="_blank" rel="noopener" style="text-decoration:none">www.thewileyfox.com</a>'
      + '<div class="ft"><span class="p">' + gbp(p.price) + '</span>' + (soon ? '<button class="btn btn-ghost btn-sm" disabled>Coming soon</button>' : '<button class="btn btn-accent btn-sm" data-add="' + i + '">Add to basket</button>') + '</div></div>';
  }).join('');
  $('sGrid').querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () {
    var p = SHOP.products[+b.dataset.add], c = cart.filter(function (x) { return x.h === p.handle; })[0];
    if (c) c.q++; else cart.push({ h: p.handle, t: p.title, p: p.price, q: 1 });
    store.set('wf_p2_cart', cart); updateCartCount(); b.textContent = 'Added'; setTimeout(function () { b.textContent = 'Add to basket'; }, 1200);
  }; });
}
$('sCart').onclick = function () {
  var tot = cart.reduce(function (a, c) { return a + c.p * c.q; }, 0);
  dlg('<h2>Basket</h2>' + (cart.length ? '<table class="t">' + cart.map(function (c, i) { return '<tr><td>' + esc(c.t) + '</td><td><input class="in" type="number" min="0" max="20" value="' + c.q + '" data-q="' + i + '" style="width:70px;height:34px"></td><td style="text-align:right"><b>' + gbp(c.p * c.q) + '</b></td></tr>'; }).join('') + '<tr><td><b>Total</b></td><td></td><td style="text-align:right"><b>' + gbp(tot) + '</b></td></tr></table>'
    + '<div class="banner warn" style="margin-top:12px">Checkout goes to the Wiley Fox Shopify store, which is password-protected until launch. At launch this button opens Shopify checkout with your basket.</div>'
    : '<div class="empty">Your basket is empty.</div>')
    + '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" data-close>Close</button>' + (cart.length ? '<a class="btn btn-accent" target="_blank" rel="noopener" href="' + (SHOP ? SHOP.store : 'https://thewileyfox.myshopify.com') + '/products/' + encodeURIComponent(cart[0].h) + '">Go to store</a>' : '') + '</div>');
  $('p2dlgBody').querySelectorAll('[data-q]').forEach(function (inp) { inp.onchange = function () { var i = +inp.dataset.q; cart[i].q = Math.max(0, Math.min(20, +inp.value || 0)); cart = cart.filter(function (c) { return c.q > 0; }); store.set('wf_p2_cart', cart); updateCartCount(); $('sCart').onclick(); }; });
};

/* ---------- start ---------- */
updateCartCount();
if (typeof qrcode === 'undefined') window.addEventListener('load', function () { if (!$('v-labels').hidden) renderLabel(); });
(function () { var v = null; try { v = sessionStorage.getItem('p2open'); sessionStorage.removeItem('p2open'); } catch (e) {} var h = (location.hash || '').slice(1); if (!v && P2_VIEWS.indexOf(h) >= 0) v = h; if (v) setTimeout(function () { p2Go(v); }, 300); })();
})();
