// Builds the editable Word version of a city guide. Usage: node build_city_docx.js <city_dir>
const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
        AlignmentType, BorderStyle, ExternalHyperlink, LevelFormat, PageBreak, Footer, PageNumber } = d;
const D = process.argv[2].replace(/\/$/, '');
const G = JSON.parse(fs.readFileSync(D + '/guide.json', 'utf8'));
const CITY = G.city, FN = CITY.replace(/ /g, '_') + '_Guide';
const WORDS = ['one','two','three','four','five','six','seven','eight','nine','ten']; let CH = 0;
const chap = t => label(`Chapter ${WORDS[CH++]} · ${t}`);
const C = G.creators;
const ORANGE = 'EA2E00', INK = '1A1A1A', MUTED = '6A6A64', CREAM = 'F0E7D6', SAGE = '9DBDB8';
const TIER = {1: 'Highest', 2: 'High', 3: 'Moderate', 4: 'Lower', 5: 'Lowest'};
const TIERCOL = {1: 'D7263D', 2: 'F46036', 3: 'C79A1E', 4: '6E9A2A', 5: '3FA34D'};
const W = 9026; // A4 content width in DXA with 1" margins

const p = (text, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o.para, children: [new TextRun({ text, ...o.run })] });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const label = t => new Paragraph({ spacing: { before: 240, after: 60 }, children: [new TextRun({ text: t.toUpperCase(), color: ORANGE, size: 16, bold: true, characterSpacing: 40 })] });
const link = (text, url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: 'Hyperlink' })] });
const credit = keys => {
  keys = (keys || []).filter(k => C[k]);
  if (!keys.length) return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Source: Wiley Fox data', size: 16, color: MUTED })] });
  const kids = [new TextRun({ text: 'Via ', size: 16, color: MUTED })];
  keys.forEach((k, i) => { if (i) kids.push(new TextRun({ text: ', ', size: 16, color: MUTED }));
    kids.push(new ExternalHyperlink({ link: C[k].url, children: [new TextRun({ text: C[k].name, size: 16, color: ORANGE })] })); });
  return new Paragraph({ spacing: { after: 160 }, children: kids });
};
const bullet = (bold, text) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 80 },
  children: [new TextRun({ text: bold, bold: true }), new TextRun({ text: text ? ' ' + text : '' })] });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D2C3' };
const cell = (children, w, fill) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
  borders: { top: border, bottom: border, left: border, right: border },
  shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
  children: Array.isArray(children) ? children : [new Paragraph({ children: [new TextRun({ text: String(children), size: 18 })] })] });
const table = (widths, header, rows) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths,
  rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell([new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })] })], widths[i], INK)) }),
         ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, widths[i])) }))] });
const cta = key => { const c = G.app_ctas.find(x => x.where === key);
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [
    cell([new Paragraph({ children: [new TextRun({ text: 'WILEY FOX  ', bold: true, color: ORANGE, size: 18 }), new TextRun({ text: c.text, size: 20 })] }),
          new Paragraph({ children: [link('thewileyfox.com', c.url)] })], W, CREAM)] })] }); };
const space = () => new Paragraph({ spacing: { after: 120 }, children: [] });

const S = G.safety;
const kids = [];
// Cover
kids.push(new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: 'THE WILEY FOX GUIDE TO', color: MUTED, size: 20, characterSpacing: 80 })] }));
kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: CITY, font: 'Georgia', italics: true, bold: true, size: 120 })] }));
kids.push(p('For families & solo travellers', { run: { font: 'Georgia', italics: true, size: 32 } }));
kids.push(p(G.cover_blurb, { run: { size: 22, color: MUTED } }));
kids.push(p(`Wiley Fox rating: ${S.wf_rating}/5 (${S.wf_label})  ·  Creator feeling: ${S.creator_feeling}/5 (${S.creator_feeling_label})`, { run: { bold: true, color: ORANGE } }));
kids.push(p(`${G.edition}  ·  Updated ${G.updated}  ·  ${G.status}`, { run: { size: 18, color: MUTED } }));
kids.push(new Paragraph({ children: [new PageBreak()] }));

// Overview
kids.push(chap('The city'), h1(CITY + ' at a glance'));
G.overview.forEach(t => kids.push(p(t)));
kids.push(table([2600, 6426], ['Fast facts', ''], Object.entries(G.facts)));
kids.push(space(), cta('before_booking'));
if (G.christmas) { const X = G.christmas;
  kids.push(new Paragraph({ children: [new PageBreak()] }), chap('Christmas'), h1('Christmas in ' + CITY), p(X.intro));
  const xi = t => { kids.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: t.name, bold: true, size: 26, font: 'Georgia', italics: true })] }),
    p([t.area, t.when, t.price, t.family ? 'Great for kids' : ''].filter(Boolean).join(' · '), { run: { size: 16, color: MUTED } }), p(t.why));
    if (t.crowds) kids.push(p('Crowds: ' + t.crowds, { run: { size: 18 } }));
    if (t.url) kids.push(new Paragraph({ children: [link('Details', t.url)] }));
    kids.push(credit(t.creators)); };
  kids.push(h2('Christmas markets')); X.markets.forEach(xi);
  kids.push(h2('Lights, rinks and festive sights')); X.sights.forEach(xi);
  kids.push(h2('Staying safe in the Christmas crowds')); X.safety.forEach(s => kids.push(bullet(s.title + '.', s.text), credit(s.creators)));
  if (X.plan) kids.push(p(X.plan, { run: { size: 18, color: MUTED } }));
  kids.push(space(), cta('families')); }

// Safety
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('Safety'), h1('How it feels, and what the numbers show'));
kids.push(h2('The data'), p(S.wf_summary), h2('The creators'), p(S.creator_summary), p(S.data_note, { run: { size: 18, color: MUTED } }));
if (G.official_crime && G.official_crime.length) {
  kids.push(h2('What the official figures say'));
  G.official_crime.forEach(o => kids.push(bullet(o.number + ' — ' + o.label + '.', o.desc || '')));
}
if (G.compare) { const X = G.compare; kids.push(h2(X.title), p(X.intro));
  kids.push(table([3400, ...X.cols.map(() => Math.floor(5626 / X.cols.length))], ['', ...X.cols], X.rows.map(r => [r.name + (r.me ? '  ◀' : ''), ...r.vals.map(v => v.toLocaleString('en-GB'))])));
  kids.push(p(X.note + ' Source: ' + X.source.name + ' (' + X.unit + ').', { run: { size: 16, color: MUTED } })); }
const ct = Object.entries(G.crime_table || {}).sort((a, b) => a[1].avg_month - b[1].avg_month);
if (ct.length) kids.push(h2('Recorded crime by area'), table([3000, 1600, 1500, 1500, 1426], ['Area', 'Crimes / month', 'Theft share', 'Violence share', 'Level'],
  ct.map(([k, v]) => [k, v.avg_month.toLocaleString('en-GB'), v.theft_share + '%', v.violence_share + '%',
    [new Paragraph({ children: [new TextRun({ text: TIER[v.tier], bold: true, size: 18, color: TIERCOL[v.tier] })] })]])));
kids.push(h2('Areas to take extra care'), p('None of these are no-go areas. Know the pattern, and plan your timing and your route home.'));
G.caution.forEach(c => { kids.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: c.area, bold: true, size: 24 })] }),
  p('Take most care: ' + c.when, { run: { color: ORANGE, size: 18 } }), p(c.note),
  ...(c.crime ? [p(`${c.crime.avg_month.toLocaleString('en-GB')} crimes a month nearby · top: ${c.crime.top_categories.join(', ')}`, { run: { size: 16, color: MUTED } })] : []), credit(c.creators)); });
kids.push(cta('night'), h2('Scams and tricks creators keep seeing'));
G.scams.forEach(s => { kids.push(bullet(s.title + '.', s.text), credit(s.creators)); });

// Stay
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('Where to base yourself'), h1('Where to stay'));
kids.push(p(G.crime_table ? 'Pick an area first, then a hotel. Every area shows the latest recorded crime within about a mile, so you can compare busy against calm.' : 'Pick an area first, then a hotel.'));
G.stay.forEach(s => { kids.push(new Paragraph({ spacing: { before: 200, after: 40 }, children: [new TextRun({ text: s.area, font: 'Georgia', italics: true, bold: true, size: 28 }),
    ...(s.crime ? [new TextRun({ text: `   ${TIER[s.crime.tier]} recorded crime`, size: 16, bold: true, color: TIERCOL[s.crime.tier] })] : [])] }),
  p(s.for.join(' · '), { run: { size: 16, color: ORANGE } }), p(s.why),
  ...(s.crime ? [p(`${s.crime.avg_month.toLocaleString('en-GB')} crimes a month nearby · ${s.crime.theft_share}% theft · ${s.crime.violence_share}% violence or robbery`, { run: { size: 16, color: MUTED } })] : []), credit(s.creators)); });
kids.push(h2("Hotels we'd start with"), p('Wiley Fox may earn a small commission if you book through these links. Your price stays the same.', { run: { size: 18, color: MUTED } }));
kids.push(table([2600, 1500, 3526, 1400], ['Hotel', 'Area / for', 'Why', 'Book'], G.hotels.map(h => [
  [new Paragraph({ children: [new TextRun({ text: h.name, bold: true, size: 18 })] }), new Paragraph({ children: [new TextRun({ text: h.band + ' · ' + (C[h.source] ? 'via ' + C[h.source].name : h.source), size: 16, color: MUTED })] })],
  `${h.area} · ${h.for}`, h.why, [new Paragraph({ children: [link('See prices', h.url)] })]])));
kids.push(space(), cta('families'));

// See
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('The sights'), h1('Ten things worth your time'));
G.top.forEach((t, i) => { kids.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: String(i + 1).padStart(2, '0') + '  ', color: ORANGE, bold: true, size: 28, font: 'Georgia' }),
  new TextRun({ text: t.name, bold: true, size: 26, font: 'Georgia', italics: true })] }),
  p(`${t.area} · ${t.price}${t.family ? ' · Great for kids' : ''}`, { run: { size: 16, color: MUTED } }), p(t.why),
  new Paragraph({ children: [link(t.url.includes('getyourguide') ? 'Book on GetYourGuide' : 'Details', t.url)] }), credit(t.creators)); });
kids.push(h2('If you only have one day'));
G.itinerary['1day'].forEach(([t, a, b]) => kids.push(bullet(`${t}  ${a}.`, b)));
kids.push(h2('Three days, grouped by area'));
G.itinerary['3day'].forEach(([dname, am, pm, eve]) => { kids.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: dname, bold: true })] }),
  bullet('Morning.', am), bullet('Afternoon.', pm), bullet('Evening.', eve)); });

// Eat
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('The table'), h1('Where to eat'));
kids.push(p(G.eat_intro || 'Every place is credited to the creator who recommended it.'));
kids.push(table([2300, 1900, 3726, 1100], ['Restaurant', 'Area · type', 'Why', 'Price'], G.eat.map(r => [
  [new Paragraph({ children: [new ExternalHyperlink({ link: r.url, children: [new TextRun({ text: r.name, bold: true, size: 18, style: 'Hyperlink' })] })] }),
   new Paragraph({ children: [new TextRun({ text: (r.family ? 'Family friendly' : 'Grown-ups') + ' · via ' + r.creators.map(k => C[k].name).join(', '), size: 16, color: MUTED })] })],
  `${r.area} · ${r.type}`, r.why, r.price])));
kids.push(space(), p(G.grown_ups + ' Opening times and menus change, so check before you travel.', { run: { size: 18, color: MUTED } }));

// Practical
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('Getting around & costs'), h1('Getting around ' + CITY));
G.transport.forEach(t => kids.push(bullet(t.title + '.', t.text), credit(t.creators)));
kids.push(h2('What it costs'), table([4300, 2400, 2326], ['Item', 'Price', 'Date · source'], G.costs.map(c => [c.item, c.price, `${c.date} · ${C[c.source] ? C[c.source].name : c.source}`])));
kids.push(p('Creator prices carry the video date. Anything older than 18 months is marked to check.', { run: { size: 16, color: MUTED } }));
kids.push(h2('Quick tips'));
G.tips.forEach(t => kids.push(bullet(t.title + '.', t.text)));
kids.push(space(), cta('community'));

// Local tips (verified)
const LT = JSON.parse(fs.readFileSync(D + '/tips.json', 'utf8')).tips;
const CATS = [['transport_payment','Paying for transport'],['water_snacks','Water & snacks'],['toilets','Toilets'],['parks_play','Parks & play'],
  ['money_tipping','Money & tipping'],['phone_data','Phones & data'],['safety_habits','Safety habits'],['local_ways','Local ways']];
kids.push(new Paragraph({ children: [new PageBreak()] }), chap('Local tips'), h1('Local tips for ' + CITY));
kids.push(p(G.tips_intro || 'Every tip was checked against an official or trusted source in September 2026. Rules and prices change, so check the link before you travel.', { run: { size: 18, color: MUTED } }));
CATS.forEach(([k, lab]) => { const ts = LT.filter(t => t.category === k); if (!ts.length) return; kids.push(h2(lab));
  ts.forEach(t => kids.push(bullet(t.worry, t.tip), new Paragraph({ indent: { left: 620 }, spacing: { after: 80 }, children: [new ExternalHyperlink({ link: t.verified_url, children: [new TextRun({ text: 'Source', style: 'Hyperlink', size: 16 })] })] }))); });

// Sources
kids.push(new Paragraph({ children: [new PageBreak()] }), label('Credits'), h1('Our sources'));
kids.push(p('This guide summarises these creators’ videos in our own words. Crime data: ' + ((G.crime_source && G.crime_source.name) || 'data.police.uk') + '. ' + ((G.crime_source && G.crime_source.citation) || ''), { run: { size: 18, color: MUTED } }));
G.sources.forEach(s => kids.push(new Paragraph({ numbering: { reference: 'n', level: 0 }, spacing: { after: 60 },
  children: [new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.title, style: 'Hyperlink', size: 18 })] }), new TextRun({ text: `  ${s.creator} · ${s.date}`, size: 16, color: MUTED })] })));

const doc = new Document({
  creator: 'Wiley Fox', title: 'Wiley Fox ' + CITY + ' Guide', description: 'Creator + data travel guide',
  styles: { default: { document: { run: { font: 'Arial', size: 21, color: '2B2B2B' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 44, bold: true, italics: true, color: INK }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 30, bold: true, italics: true, color: INK }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } }] },
  numbering: { config: [
    { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
    { reference: 'n', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: 'Wiley Fox · ' + CITY + ' guide · thewileyfox.com · page ', size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED })] })] }) },
    children: kids }] });
Packer.toBuffer(doc).then(b => { fs.writeFileSync(D + '/' + FN + '.docx', b); console.log('docx ok', b.length); });
