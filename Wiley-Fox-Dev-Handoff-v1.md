# Wiley Fox — Dev Handoff (v1: UK-only)

**Status:** Ready for dev kickoff
**Scope:** UK England, Wales & Northern Ireland (Scotland deferred to v2)
**Date:** 2026-04-29 · **Last updated:** 2026-10-01 (v1.6 — city content pipeline, travel guides and live advice, §20)
**Owner:** Barry Wilson

---

## 0. Changelog

The prototype was reworked in June 2026. The following changes supersede earlier descriptions in this document — read these before building:

- **Unified Wiley Fox Safety Score (0–100 + 1–5 band).** The rating is no longer a single density-bucket score. It now blends live police data (70%) with Numbeo resident perception (30%), is population-adjusted, and outputs a 0–100 headline score with the 1–5 colour band derived from it. **Section 5 is fully rewritten.**
- **Real Numbeo data + ONS population density** added as scoring inputs (Sections 5.1–5.2).
- **Map hex overlay re-aligned** to the brand 1–5 palette and the same scoring curve as the rating, replacing an off-brand 4-tier palette (Section 5.3).
- **Attraction pins** now fail over across three OpenStreetMap Overpass mirrors for reliability (Section 7.5).
- **Community traveller ratings** are now prototyped — a multi-step capture (overall → areas → per-area). **Now LIVE** against a dedicated Supabase project (`admin@thewileyfox.com` org); read/insert verified (Section 13).
- **Travel guide** requires the page to be served over HTTP, not opened via `file://` (Section 8). A `start-prototype.command` launcher is included in the folder.
- **Data sources & refresh strategy** documented in full (new Section 14).
- **Secrets & API key management** documented — where keys live and the production convention (new Section 15).
- **Architecture reconciliation (2026-06-23):** the production backend already exists as the `WF-mapping` repo pipeline (Node + 9 connectors + H3 scoring + **Neon Postgres** + Netlify, live at `wiley-fox.netlify.app`). Crime data is in Neon; **Supabase holds only community ratings.** See the new **§0.5** and the prototype→pipeline **scoring port plan (§16)**.
- **City content pipeline, guides and live advice (2026-09-23 → 30):** the §17 synthesis layer now exists — an append-only Neon content DB (`wf_*` tables), daily YouTube discovery in focus-city mode, LLM fact extraction, admin and public city-guide APIs, a live US State Dept advisory feed as the single official advice source, a reusable city-guide template (web/PDF/Word + Christmas chapter + Eurostat/FBI comparison table), and the redesigned prototype live at `/new`. Published guides: London, Nuremberg, Munich; Cologne and New York in review. New **§20**; full commit list in `CHANGELOG.md`.
- **Portal build plan (2026-09-03):** element-by-element gap analysis of W1–W6 against the working prototype and the app backend, four design/product contradictions, the live-location (Life360) capability spec, merged Premium, and twelve sequenced work packages with estimates. New **§19**. Redesigned prototype deployed for testing at `wiley-fox-redesign.netlify.app` (production site untouched).
- **Web portal redesign (2026-09-02):** six screens for **thewileyfox.com** — the signed-in tag/tracker portal — were designed and built as a static HTML handover file (`WileyFox-Portal-Screens-v1.html`). This is a **separate product surface** from the UK map covered by §§0–17; only the map screen overlaps. Front end only, no data wiring. New **§18**.
- **YouTube city-intelligence corpus (2026-06-26):** a harvested corpus of **162 cities / 1,315 video transcripts (~2.8M words)** of local travel advice now lives in the repo (`city_knowledge/`, `city_guides/`). It is the source for a planned **LLM-synthesised qualitative intelligence layer** that feeds the ratings panel, travel guides and a map overlay — **without** affecting the numeric Safety Score. Documented as a first-class data resource in the new **§17**; integration approach in `Wiley-Fox-YouTube-Intel-Integration-Options.md`.

---

## 0.5 Architecture reality — READ FIRST (2026-06-23 reconciliation)

This document was originally written **prototype-first**. In reality Wiley Fox is **two separate pieces**, and the dev should treat the *repo* as the production source of truth:

**1. The production backend — GitHub `barry14wilson/WF-mapping` (the real product).**
A Node pipeline that ingests open crime data and serves it to the map:
- **9 connectors** (`connectors/`): `uk-police`, `us-fbi`, `eu-eurostat`, `mexico-hoyodecrimen`, `australia-abs`, `canada-statcan`, `acled-conflict`, `unodc-global`, `worldbank-global`.
- **Scoring engine** (`scoring/scoring-engine.js`): aggregates incidents into **Uber H3 cells** (res 7/9/11) and scores `0.30·volume + 0.35·severity + 0.20·recency + 0.15·population`, banded by percentile.
- **Storage = Neon Postgres** (`DATABASE_URL`). The `supabase/migrations/` folder name is historical — the SQL is plain Postgres on Neon.
- **Netlify scheduled functions** (`netlify/functions/scheduled-*.js`) ingest on a cadence; **API** `GET /api/safety-tiles` + `POST /api/route-safety-check`.
- **Live:** `https://wiley-fox.netlify.app` (root serves the prototype; `/api/safety-tiles` serves data).
- Documented in the repo's own `README.md`, `DEPLOY.md`, `CLAUDE.md` — **the authoritative pipeline docs.**

**2. The single-file prototype — `wiley-fox-uk-prototype.html` (a standalone demo).**
Client-side; calls `data.police.uk` directly (UK only); holds the unified-score UI, hex overlay, travel-guide generator and community-ratings UX. It is **not** wired to the pipeline's API yet.

**Two databases, by design:**
- **Crime/pipeline data → Neon Postgres** (`DATABASE_URL`).
- **Community `area_ratings` → Supabase** (`admin@thewileyfox.com` project `kicfftbhbrvphlyvpywt`). This is the *only* thing in Supabase.

**Known divergence:** the prototype's scoring (70/30 police+Numbeo, ONS population adjustment, 5-band brand palette, absolute thresholds) is **not** in the pipeline, which scores differently (no Numbeo, 4 coarse severity buckets, percentile bands, 4-colour palette). Sections 5 and 16 cover this and the port plan. **Where this doc conflicts with the repo's README/DEPLOY, the repo wins** for the pipeline; this doc remains the reference for the prototype/UX, data-source catalogue, secrets, and the scoring port.

---

## 1. What's in this folder

| File | Purpose |
|------|---------|
| `wiley-fox-uk-prototype.html` | Working single-file prototype. Pulls live data from data.police.uk. Best run via the launcher below (the travel guide needs HTTP — see §8). |
| `start-prototype.command` | macOS launcher — serves the prototype over `localhost` so all features (incl. travel guide) work. Double-click (right-click → Open the first time). |
| `wileyfox-travel-guide-template.html` | `{{TOKEN}}` template the guide generator fills (§8). |
| `Wiley-Fox-Dashboard-PRD-Template.md` | Editable PRD scaffold (cross-reference with `PRD Document WF.docx`). |
| `wiley-fox-uk-prototype-redesign.html` | **v9 (3 Sep).** v7 (top-right nav) and v8 (horizontal expanded strip) were both **reverted**; v9 = v6 plus one change. The safety panel **expands to the vertical right-hand panel** exactly as before (366 px, full height, Community reports + collapsible UK / Global city lists with rating badges + Save a Spot + sources), and **minimises to a small horizontal pill in the top-right** carrying the shield, "Safety in this area", and — once an area is loaded — its name and colour band. **Minimised by default** on a first visit (`wf_panel_min` persisted after that); the map's data-source pill and top row reclaim the width while minimised. Left rail unchanged. Originally **v8/v7:** v7's top-right nav experiment was **reverted** (the labelled left rail is back, unchanged). The change in v8 is the **safety panel orientation**: it is now a **horizontal strip across the top of the map** — every section of the old vertical panel becomes a column (header, route result, community reports, city lists in a 3-across grid, Save a Spot, sources), scrolling left→right with fade arrows on each edge. It **minimises to a small pill in the top-right** showing the loaded area and its band, and it is **minimised by default** so the map is clean and wide open. The map's search/mode/route/SOS row and left stack drop below the strip while it is open and return to the top when it is minimised. Originally **v7:** Adds to v6: **the left rail is gone** — replaced by one expandable pill bar in the top-right corner (`.wf-topnav`, rendered into `.wf-views`). Collapsed: fox mark + current section name + chevron + Account avatar. Expanded: every section from the old rail (icons + labels, Inbox and Saved places badges mirrored from the hidden rail), Premium link, close ×. Click a section to switch (drives the hidden rail's buttons, so all wiring is unchanged); Esc / outside click collapses; on wide screens it stays open as a tab bar; under 1180 px it shows icons only and auto-collapses after a choice; state in `wf_topnav_open`. On the Map view, opening the bar pushes the search/mode/route/SOS row down 60 px so nothing is covered; the safety panel starts at 76 px; mock views get a 76 px top strip. Home top bar's duplicate avatar removed. Originally **v6:** Adds to v5: the whole floating safety panel **minimises to a 56 px bar** (chevron in the panel header; the bar carries the shield icon, a vertical label and an expand chevron; click anywhere on it to expand); state persisted in `wf_panel_min`; a MutationObserver on `#ratingHost` re-opens the panel automatically when new area data loads; the data-source pill and top row reflow when minimised. Originally **v5:** Adds to v4: UK / global city lists in the safety panel are **collapsible accordions, collapsed by default** (state persisted); every city chip carries a **1–5 rating badge** (global from the static index, UK from a per-city cache filled as live data loads); anywhere Wiley Fox has no crime data (global city with no index entry, country with no World Bank homicide figure, free-text search) a **provisional rating derived from Gov.uk FCDO `alert_status`** is shown above the FCDO panel — mapping: all travel/whole country → 1, all-but-essential/whole → 2, all travel/parts → 2, all-but-essential/parts → 3, no alerts → 4 (never 5) — labelled *Provisional · from Gov.uk FCDO advice · travel advice, not incident data*. Static global index tags 'Generally safe'/'Very safe' patched at runtime. Originally **v4:** Adds to v3: **tag detail sheet** (click any tag → edit name/type/person, per-tag Medical & ICE field checkboxes, scan history, Report missing / Mark found, unlink; state in localStorage `wf_mock_tags`, Home and Tags lists render from it); **Link a new tag** (camera via getUserMedia + BarcodeDetector where supported, or typed code `WF-XXX-XXX`, 3-step assign flow); real product photo of the yellow snap wristband in the Shop; **SOS chip on the Map** (shared overlay); **community reports** (+ Report → click the map → category chips Pickpockets / Anti-social behaviour / Robbery / Harassment / Poor lighting / Drug activity / Vehicle crime / Other + note → pin marker with popup, `wf_reports` in localStorage, Community layer toggle, "Community reports nearby" block in the safety panel within 1.5 km of map centre, noted as pending moderation and feeding the rating); example Missing-child banner on the map linking to the Child Alert thread. Originally **v3:** Adds to v2: **live safest-route routing** (OSRM road network + `data.police.uk` poly query, severity-weighted exposure within 100 m of the path, direct + via-point detours compared, best drawn green); SOS (hold-to-send, static); community **Child Alert** inbox thread (tap-to-reveal photo, sighting form, guardian reply, all static); create-a-group with Guardian / Emergency contact / Member roles (localStorage, example); Medical & ICE profile with per-field "shown on scan" toggles and a live scan-page preview; medic bracelet SKU; collapsible sidebar. Originally **v2:** The working prototype wearing the redesign — nav shell 2a, floating safety panel, labelled chips. **All original functionality intact.** Static, QR-corrected mock views for Your people (W1), Inbox (W2), Tags & items, Family + invite (W4), Shop (W5, catalogue preview, no prices), Account (W6) — every one labelled *Example data*; **Saved places is live**, reading the prototype's Save a Spot pins. Bluetooth, live tracking and battery elements removed per Barry's 3 Sep decision; `RATING_LABELS` 4/5 and `#globalLegend` patched at runtime to "Low incident" / "Very low incident". Prototype code untouched — everything is additive. Live at `https://wiley-fox-redesign.netlify.app` (`/original.html`, `/screens.html` alongside). |
| `WileyFox-Portal-Screens-v1.html` | **Web portal redesign, screens W1–W6.** Static front end, no data wiring — see §18. Different product surface to the map prototype. |
| `Wiley-Fox-Dev-Handoff-v1.md` | This document. |
| `../WileyFox Shared/Crime stats and data/` | Reference datasets (UNODC, global sources for v2). |
| `../WileyFox Shared/PRD Document WF.docx` | Original product brief. |

The prototype is a reference implementation, not production code. **The production backend already exists** as the `WF-mapping` pipeline (see §0.5) — so this isn't a from-scratch rebuild. The prototype carries the rating UX, brand application, and the unified-score logic that still needs porting into the pipeline (§16). Section 3 below describes one option for a *future frontend* rebuild; it does **not** override the existing Node/Netlify/Neon backend.

---

## 2. v1 Scope (locked)

**In:**
- UK map (England, Wales, NI)
- Live crime data from data.police.uk
- Wiley Fox safety rating (1–5, colour-coded)
- City search + click-to-fetch
- Side panel with crime breakdown
- Booking.com referral integration on hotel pins
- TripAdvisor venue overlay
- Email capture → mailer
- Travel guide generator (city-level, PDF download)

**Out (deferred to v2):**
- Scotland (Police Scotland doesn't publish to data.police.uk — separate integration needed)
- International coverage (we have the source list ready — see `Crime stats and data/global_crime_data_sources.csv`)
- User-generated reports / hotspot crowdsourcing *(community area ratings now prototyped — see §13; persistence still to be wired)*
- Multi-language
- Native mobile apps
- Authenticated partner portal (phase 1.5)

---

## 3. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router) + TypeScript                       │
│  ├─ /app                                                    │
│  │  ├─ (public)/                  Public marketing surface  │
│  │  │  ├─ page.tsx                Homepage / map            │
│  │  │  ├─ city/[slug]/            City pages (SEO)          │
│  │  │  └─ guide/[slug]/           Travel guides             │
│  │  └─ (partner)/                 (Phase 1.5)               │
│  ├─ /components                                             │
│  │  ├─ Map/                       MapLibre wrapper          │
│  │  ├─ RatingCard/                Wiley Fox rating UI       │
│  │  └─ ui/                        shadcn/ui primitives      │
│  ├─ /lib                                                    │
│  │  ├─ api/police.ts              data.police.uk client     │
│  │  ├─ api/booking.ts             Booking.com affiliate     │
│  │  ├─ api/tripadvisor.ts         TripAdvisor content API   │
│  │  └─ rating.ts                  Wiley Fox algorithm       │
│  └─ /server                                                 │
│     ├─ cron/refresh-crime.ts      Monthly data sync         │
│     └─ db/schema.ts               Supabase schema           │
└─────────────────────────────────────────────────────────────┘
```

**Stack:**
- **Framework:** Next.js 14 (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Map:** MapLibre GL JS (open source — no Mapbox key needed)
- **API state:** TanStack Query
- **Database:** Supabase (Postgres + auth + storage)
- **Hosting:** Vercel
- **Analytics:** Plausible (GDPR-friendly)
- **Errors:** Sentry
- **Email:** Resend or Klaviyo (Klaviyo plugin is already in your tooling — recommend)

---

## 4. Data Source: data.police.uk

**Base URL:** `https://data.police.uk/api`
**Auth:** None (public API)
**Rate limit:** ~15 req/sec, fair use
**Coverage:** England + Wales + Northern Ireland
**Refresh:** Monthly, ~6-8 weeks lag (i.e. data published in March covers January)

### Key endpoints

| Purpose | Endpoint |
|---------|----------|
| Latest data month | `GET /crime-last-updated` |
| Crimes near a point | `GET /crimes-street/all-crime?lat={}&lng={}&date=YYYY-MM` |
| Crimes in a polygon | `POST /crimes-street/all-crime` (body: `poly` + `date`) |
| Crime categories | `GET /crime-categories?date=YYYY-MM` |
| Force list | `GET /forces` |
| Stop & search | `GET /stops-street?lat={}&lng={}&date=YYYY-MM` |

### Response shape (single record)
```json
{
  "category": "violent-crime",
  "location": {
    "latitude": "51.510433",
    "longitude": "-0.140455",
    "street": { "id": 1676487, "name": "On or near Parking Area" }
  },
  "month": "2024-01",
  "id": 116086038,
  "context": "",
  "outcome_status": null
}
```

### Important constraints
- The point-radius query returns crimes within a **1-mile (~1.6km) radius** — fixed, not configurable.
- Locations are **anonymised to "snap points"** (~750k snap points across UK), not raw GPS — so multiple crimes share coordinates.
- The polygon endpoint takes max 10,000 points and **may return 503** if too many crimes match — chunk by sub-area for big cities.
- Some forces lag — Greater Manchester has been intermittent. Build a "feed health" indicator.

### Caching strategy
- The data is monthly; cache aggressively.
- Recommended: nightly cron job refreshes data per major city (and on-demand for searches), stored in Supabase as normalised `crimes` table:

```sql
create table crimes (
  id bigint primary key,
  category text not null,
  month date not null,
  latitude double precision not null,
  longitude double precision not null,
  street_name text,
  force text,
  geom geography(point, 4326),
  inserted_at timestamptz default now()
);
create index crimes_geom_idx on crimes using gist (geom);
create index crimes_month_idx on crimes (month);
create index crimes_category_idx on crimes (category);
```

---

## 5. Wiley Fox Safety Score (unified, June 2026)

The score is a **0–100 headline (higher = safer)** with a **1–5 colour band** derived from it. It blends two independent signals and degrades gracefully when one is missing.

```
Unified Safety Score (0–100, higher = safer)
   = 0.70 × P   (live police sub-score, population-adjusted)
   + 0.30 × N   (Numbeo Safety Index)
   → bandFromScore() → 1–5 colour band

If only P available → score = P            (e.g. arbitrary map clicks)
If only N available → score = N            (e.g. < 30 live incidents)
If neither          → unranked ("Low incident count")
```

### 5.0 Live police sub-score (P)

Severity weighting is unchanged. The crude density buckets are replaced by a smooth exponential curve, then population-adjusted:

```ts
const SEVERITY: Record<string, number> = {
  'violent-crime': 3, 'robbery': 3, 'possession-of-weapons': 3,
  'burglary': 2, 'theft-from-the-person': 2, 'drugs': 2,
  'criminal-damage-arson': 1.5, 'vehicle-crime': 1.5,
  'other-theft': 1, 'shoplifting': 1, 'bicycle-theft': 1,
  'public-order': 1, 'anti-social-behaviour': 0.8, 'other-crime': 1,
};
const AREA_KM2 = Math.PI * 1.6 * 1.6;        // ~8.04 km² (1-mile radius)
const MIN_INCIDENTS_FOR_RATING = 30;          // below this, P is null

// Severity-weighted crime density → 0–100 safety (higher = safer).
// Anchors: ~25/km² → 90, ~75 → 74, ~200 → 45, ~400 → 20, ~800 → 4.
const policeSafetyScore = (d: number) => Math.round(100 * Math.exp(-d / 250));

const bandFromScore = (s: number) =>
  s >= 80 ? 5 : s >= 60 ? 4 : s >= 40 ? 3 : s >= 20 ? 2 : 1;
```

### 5.1 Numbeo sub-score (N)

- Source: **Numbeo Crime/Safety Index** (`numbeo.com/crime`). `N` = Numbeo **Safety Index** (0–100, higher = safer; Crime Index = 100 − Safety Index).
- The prototype ships a hardcoded lookup table. **UK city values were refreshed from Numbeo's UK page on 17 Apr 2026.** Production should pull these via the Numbeo API (paid/licensed — see §9) or a periodic refresh job, not a static table.
- City-name aliases are handled (e.g. `Newcastle` → `newcastle upon tyne`).
- Numbeo is **perception data**, deliberately weighted at only 30% — it adjusts the score at the margin rather than driving it.

### 5.2 Population adjustment (ONS density)

Raw crime density over-penalises busy city centres. A **bounded** adjustment using ONS/NISRA resident density softens this:

```ts
const POP_DENSITY_REF = 4000;                 // typical UK core-city density /km²
const f = Math.min(1.5, Math.max(0.7, Math.pow(pop / POP_DENSITY_REF, 0.25)));
const adjustedDensity = weightedDensity / f;  // feed this into policeSafetyScore()
```

- Static table of LA-level density for the 10 prototype cities (ONS Mid-2024; StatsWales/NISRA for Cardiff/Belfast).
- This is a **city-level approximation**. The cap (0.7–1.5×) keeps it a fairness nudge, not a takeover. **Footfall-weighted LSOA population is the proper fix** and is the recommended production upgrade — it would also make arbitrary postcode searches as fair as the named cities.

### Rating scale (UI tokens — unchanged)

| Band | 0–100 range | Label | Hex |
|------|-------------|-------|-----|
| 5 | 80–100 | Very safe | `#3FA34D` |
| 4 | 60–79 | Generally safe | `#A4C957` |
| 3 | 40–59 | Stay aware | `#FFC857` |
| 2 | 20–39 | Caution | `#F46036` |
| 1 | 0–19 | High caution | `#D7263D` |

### 5.3 Map hex overlay (must match the rating)

The hexagon overlay colours each hex by running its severity-weighted density through the **same** `policeSafetyScore()` → `bandFromScore()` and painting with the brand palette above (so "green hex" = "green rating"). Numbeo and population are city-level inputs and are **intentionally not applied per-hex** — the map shows raw live crime density. Hexes with < 3 incidents render as a neutral "Low incident count" state (`#9ED2B2`), making no safety claim.

> **Single source of truth:** severity weights, the density→score curve, the band thresholds, and the 70/30 blend now drive the rating card, the hexes, the safety report and the travel guide. Keep them in one module (`lib/rating.ts`) so any tweak stays consistent everywhere. Strong candidate for a documented "WF scoring methodology" reference.

### Tuning notes for the dev team
- The `exp(-d/250)` constant and the 70/30 blend are first-pass — **calibrate** against known-safe and known-busy areas.
- **Replace the static Numbeo + population tables** with live/periodic data sources in production.
- Consider **time-weighted decay** (recent months count more) once historic data is loaded.
- Watch **low-data fallbacks**: Greater Manchester's thin feed makes some city-centre months drop below the 30-incident floor and fall back to 100% Numbeo — surface this state honestly in the UI.
- The score is **legally sensitive** — never present it as definitive. UI must always carry the "prototype rating, not a definitive safety judgement" disclaimer until reviewed.

> **YouTube intelligence does NOT enter this score.** The qualitative traveller-intelligence layer (§17) is presented as a separate, clearly-labelled panel and **must not** be blended into the 70/30 number. If a third signal is ever wanted, it is a deliberate `lib/rating.ts` change (see §13), not a side-effect of the intel layer.

---

## 6. Brand Tokens (extracted from existing assets)

```css
--orange:   #FF7B14;  /* Primary, CTAs, brand accent */
--sage:     #AABA9F;  /* Secondary surfaces */
--cream:    #E5EBD3;  /* Light backgrounds */
--charcoal: #232323;  /* Text */

/* Type */
--font-display: 'Fraunces', Georgia, serif;     /* H1/H2, rating numbers */
--font-body:    'Inter', system-ui, sans-serif; /* Everything else */
```

**Reference files:** `Colour scheme.png`, `Current Logo 1.png`, the Travel Guide docx/pdf in the workspace folder. Lock these as Tailwind theme tokens in `tailwind.config.ts`.

---

## 7. Integration Points

### 7.1 Booking.com (hotels — referral revenue)
- Affiliate ID required (apply via [partners.booking.com](https://partners.booking.com)).
- Use the **Demand API** (B2B) for live availability/pricing where available, otherwise use deep-links with affiliate ID appended.
- Display "Powered by Booking.com" attribution next to every price.
- Cache pricing for max 15 minutes — pricing changes fast.

**What's in the prototype:**
- `BOOKING_AFFILIATE_ID = 'YOUR_AID_HERE'` placeholder — **dev: replace with live AID** once approved.
- Search deep-links built via `bookingSearchUrl(city)` helper.
- Sample featured hotels per city in `SAMPLE_HOTELS` constant — **dev: replace with Demand API call** keyed off the search city, returning live availability + pricing.
- Hotel cards link to Booking with `rel="sponsored"` (correct affiliate disclosure for SEO).
- "Powered by Booking.com" disclosure rendered under every list.

### 7.2 TripAdvisor (venues, reviews)
- **Content API** (free tier, 5,000 calls/day) — apply at [tripadvisor.com/developers](https://tripadvisor.com/developers).
- Use for restaurants, attractions, hotels — pull rating, review count, photo, link.
- Required: TripAdvisor logo + "Read N reviews" deep-link on every card (terms of service).

### 7.3 Email signup (Klaviyo recommended)
- Klaviyo plugin already available in your Cowork tooling.
- On signup: trigger welcome flow, tag with city of interest, push to "UK Travellers" list.
- Double opt-in for GDPR.

### 7.4 Geocoding (search bar)
- Prototype uses Nominatim (free, no key, attribution required).
- Production: switch to **Mapbox Geocoding** or **Google Places** for better autocomplete UX. Budget ~$50/mo at moderate traffic.

### 7.5 Attraction pins (★ markers)
- Pulled live from the **OpenStreetMap Overpass API** by lat/lng (tourism/historic/leisure tags) and plotted as orange ★ markers; each links to a GetYourGuide search (affiliate `WXZGXR9`).
- Overpass is heavily rate-limited and frequently times out. The prototype now **fails over across three mirrors** (`overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru/.../overpass`) before giving up silently.
- **Production:** pre-fetch and cache attraction POIs per city in Supabase (nightly), don't hit Overpass on every page load. Long-term, replace with the **TripAdvisor / GetYourGuide** content APIs for richer, monetisable data.

---

## 8. Travel Guide Generator

**What's in the prototype:**
The "Download travel guide" button on each city's rating card opens a new browser tab with a fully-styled, print-friendly travel guide. User saves as PDF via Cmd+P / browser print. The guide includes:
- Cover page with city name, Wiley Fox rating orb, reporting period
- "Lay of the land" lede + KPI tile grid
- Most-reported offences breakdown (top 8 categories)
- Streets with most recorded incidents (top 5 — proxy for "areas to be cautious")
- Featured hotels (Booking.com deep-links with referral)
- Smart-traveller checklist (5 generic UK safety tips)
- Sources, disclaimer, generation date

Implemented in `generateTravelGuide()`, which `fetch()`es a template file (`wileyfox-travel-guide-template.html`) and fills `{{TOKEN}}` placeholders.

> **Local-server requirement (prototype only):** because it uses `fetch()` for the template, the guide button **fails when the page is opened via `file://`** (browsers block local-file fetches) — the user sees a red "Travel guide needs the local server" banner. Serve over HTTP instead: double-click the included **`start-prototype.command`** (runs `python3 -m http.server` and opens `localhost`). In production this is a non-issue (everything is served over HTTP); if you keep any `fetch()`-based templating, inline or bundle the template so there's no `file://` dependency.

**Production upgrade path:**
1. Replace the inlined HTML template with a server-rendered React component using **@react-pdf/renderer** (reliable, no Puppeteer infra needed) or **Puppeteer** if you need full HTML/CSS fidelity.
2. Capture the user's email before downloading — feeds the Klaviyo "UK Travellers" list (lawful basis: consent at point of capture).
3. Email the PDF to the user post-generation (Resend or Klaviyo flow).
4. Replace the "top streets" proxy with **proper LSOA-level analysis** (top 5 safest LSOAs and 5 to avoid by Wiley Fox rating, not raw street counts).
5. Layer in TripAdvisor's "best restaurants" and "top experiences" once API access is approved.
6. Match typography, photography, and editorial voice to the existing `London_Travel_Guide.docx` and `Manchester Travel Guide.pdf` reference docs in the Wileyfox folder.
7. **Populate "best areas to stay" / "what to skip" / "know before you go" from the YouTube intelligence layer (§17)** instead of the hand-written/Wikivoyage fallback. This extends bespoke-guide coverage from ~4 cities to all 162, each claim sourced to *"N traveller guides"*. See `Wiley-Fox-YouTube-Intel-Integration-Options.md`.

---

## 9. Compliance & Legal

- **Open Government Licence (OGL v3)** — data.police.uk requires attribution. Prototype carries it; production must too.
- **Disclaimer** — Wiley Fox rating must always be accompanied by "based on recorded crime data; not a definitive safety judgement". Get legal sign-off on wording before launch.
- **GDPR** — UK GDPR + cookie consent banner (use `cookie-consent` lib or similar). Email capture needs lawful basis (consent for marketing).
- **Booking.com & TripAdvisor terms** — display attribution as required, don't cache pricing beyond their TTL, don't scrape.
- **Numbeo licensing** — Numbeo data requires a **commercial licence / paid API** for production use. The prototype's static table is for demo only. Secure a licence (or replace Numbeo with an alternative perception source) before launch, and attribute as their terms require.
- **OpenStreetMap (Overpass + Nominatim)** — ODbL attribution required ("© OpenStreetMap contributors"); respect Nominatim/Overpass usage policies (no heavy per-request load — cache server-side).

---

## 10. v1 Build Roadmap (suggested)

| Sprint | Goal |
|--------|------|
| 1 | Project scaffold, Tailwind theme, MapLibre wrapper, data.police.uk client + Supabase schema |
| 2 | City page + rating algorithm + crime breakdown UI |
| 3 | Booking.com integration, hotel pins, click-through tracking |
| 4 | TripAdvisor venues, side panel polish |
| 5 | Travel guide PDF generator + email signup (Klaviyo) |
| 6 | SEO pass, accessibility audit (WCAG AA), performance (LCP < 2.5s), launch |

---

## 11. Known issues / open questions

- [ ] Manchester data submission has been thin — confirm with GMP comms whether ongoing or transient. (Now triggers the Numbeo-only fallback for some months — see §5.)
- [ ] Is the Booking.com affiliate account already set up, or does dev team apply?
- [ ] TripAdvisor API access — Barry to apply now (5–10 day approval).
- [ ] **Numbeo commercial licence** — secure before launch, or pick an alternative perception source (§9).
- [ ] Wire **community area ratings** to Supabase so they persist beyond the browser (§13).
- [ ] Confirm domain (thewileyfox.com? wileyfox.travel?).
- [ ] Hosting budget — Vercel Pro + Supabase Pro ≈ $45/mo to start.
- [ ] Legal: who reviews the rating disclaimer wording?

---

## 12. v2 Wishlist (so the team can plan ahead)

- Scotland (Police Scotland integration)
- Republic of Ireland (CSO Ireland)
- Europe (data.gouv.fr, Berlin, Italy ISTAT, Eurostat) — all free APIs
- US (data.police.uk equivalents: NYC, Chicago, LA Socrata APIs)
- Globally: ACLED + GDELT for political/conflict overlay
- Authenticated partner portal (hotels, tour ops dashboard)
- User-submitted hotspots / reports
- Mobile app (React Native sharing the codebase)

The full source catalogue lives at `WileyFox Shared/Crime stats and data/global_crime_data_sources.csv` — 60+ sources already documented.

---

## 13. Community traveller ratings (prototyped June 2026)

> **LIVE as of 2026-06-23.** The `area_ratings` table is deployed and the prototype writes to it (read + insert verified).

A lightweight, opt-in capture that builds area-level intelligence over time.

### Canonical Wiley Fox database

| | |
|---|---|
| **Supabase account / org** | `admin@thewileyfox.com` (separate org — its own active-project quota, so it does **not** consume slots in the `barry14wilson` org) |
| **Project URL** | `https://kicfftbhbrvphlyvpywt.supabase.co` |
| **Client key** | publishable key `sb_publishable_…` — public by design, gated by RLS; lives in the prototype's `RATINGS_BACKEND`. The `service_role`/secret key is **not** in the client. |
| **Schema** | `supabase-area-ratings.sql` (in the repo) — `area_ratings` table + RLS (anon insert ≤ rating 1–5, anon read). |

**Other Supabase projects (do not confuse):** PropertyCompass lives in `supabase-lime-zebra` (separate product, live data); `Hard 75` is a separate fitness app; `Wiley Fox Maps` is an old paused project under the `barry14wilson`/Vercel org — **not** the canonical WF DB. (Minor drift to tidy later: the PropertyCompass project also contains an empty duplicate set of `h75_` tables.)

**Flow** (the card that appears after closing a Safety Report):
1. **Overall feel** — "Been to {city}? How safe did it feel?" 1–5.
2. **Which parts did you visit?** — tappable chips of the city's known neighbourhoods (drawn from the `CITY_INTEL` safe/alert lists) plus a free-text "add an area" box.
3. **Rate each** — a quick 1–5 for every area they selected.

**Storage:** ratings go through `RatingsStore`, which currently falls back to **`localStorage`** (per-device only). Overall ratings are keyed by city; per-area ratings by `"<city> — <area>"` so they aggregate per area. A point-click (no named areas) finishes after step 1.

**To make it real (production):**
- Wire `RATINGS_BACKEND` to a Supabase project — the `area_ratings` table SQL + RLS policies are already commented in the prototype. Until then the richer per-area data stays on each user's device.
- Add light abuse protection (rate-limit per session/IP, sanity-cap text length — partial checks already in the RLS policy).
- These community ratings are a strong candidate to become a **third input into the Safety Score** (alongside live data and Numbeo) once volume builds — design `lib/rating.ts` so a third weighted signal can be slotted in.

---

## 14. Data sources & refresh strategy

Everything that feeds a city view, and whether it is fetched **live** at runtime or **baked into the prototype** as a static table.

### 14.1 Live APIs (fetched on demand)

| Data | Source | Auth | Used for |
|---|---|---|---|
| **UK crime** (street-level) | `data.police.uk/api` | none | Core map + Safety Score (England, Wales, NI) |
| US crime | Socrata: `data.cityofnewyork.us`, `data.cityofchicago.org`, `data.sfgov.org`, `data.lacity.org` | app token (optional) | US city live data |
| US national crime | `api.usa.gov/crime/fbi/cde` (FBI CDE) | api.data.gov key | US context |
| EU crime stats | Eurostat API (`ec.europa.eu/eurostat`) | none | European city context |
| Attractions (★) | OpenStreetMap **Overpass** (3 mirrors) | none | Map attraction markers |
| Notable places | **Wikipedia** API (geosearch) | none | "Show Places" POI layer |
| City guide text | **Wikivoyage** API | none | In-app guide panel |
| Search / geocoding | **Nominatim** (OSM) | none | Search bar |
| UK travel advisory | **gov.uk** FCDO API | none | Global-mode advisory |
| Global advisory | `data.international.gc.ca` (Canada) | none | Global-mode choropleth |
| Map tiles + fonts | OpenStreetMap, Google Fonts, CDNs (MapLibre, GetYourGuide) | none | Base map / UI |

### 14.2 Static data baked into the prototype (NOT live)

| Data | Constant | Production action |
|---|---|---|
| **Numbeo** crime/safety index | `NUMBEO` | UK refreshed 17 Apr 2026. **Move to licensed Numbeo API / refresh job** (licence required — §9). |
| **ONS/NISRA** population density | `POP_DENSITY` | 10 cities. Replace with ONS dataset; upgrade to LSOA footfall (§5.2). |
| Hotels | `SAMPLE_HOTELS` | Placeholders → **Booking.com Demand API**; replace `YOUR_AID_HERE`. |
| Editorial guide content | `CITY_DATA` | Hand-written. Keep curated or move to CMS/Supabase. |
| Safe/alert neighbourhoods | `CITY_INTEL` | Curated; also powers area-rating chips (§13). |
| Global cities + homicide | `GLOBAL_CITIES` | Attributed to UNODC / World Bank / FBI; refresh annually. |
| Organised Crime Index | `OC_INDEX` | From ocindex.net; refresh annually. |
| **YouTube city corpus** | `city_knowledge/`, `city_guides/` (repo files, not a JS constant) | 162-city transcript corpus → synthesised qualitative intel layer (§17). Monthly re-harvest + LLM re-synthesis. **Qualitative only — never feeds the numeric score.** |

> **For the UK product, the only live authoritative source is `data.police.uk`.** Everything that makes a city feel "rich" (Numbeo, population, hotels, guide copy) is currently static and must be turned into live/licensed feeds for production.

### 14.3 Recommended refresh strategy

- **Crime (data.police.uk):** nightly cron → Supabase `crimes` table (§4). Monthly publication, so daily is ample.
- **Numbeo / OC Index / homicide:** monthly or quarterly refresh job into a `city_indices` table.
- **Population (ONS):** static reference, re-pull on each annual ONS release.
- **Hotels/attractions:** cache per city in Supabase (nightly); never call Booking/Overpass/TripAdvisor on every page load.

---

## 15. Secrets & API key management

**Golden rule: no secret values in the repo, ever.** Only key *names*, *locations*, and *how to obtain them* are documented.

### 15.1 Where keys live today (prototype)

| Secret | Held in | Status |
|---|---|---|
| `YOUTUBE_API_KEY` | `.env.pipeline` (local, **gitignored**) | Used by the content/social pipeline, not the map. |
| `GITHUB_TOKEN` | `.env.pipeline` (local, **gitignored**) | Repo automation. |
| Booking.com `AID` | hardcoded placeholder `YOUR_AID_HERE` in the prototype | **Move to env var before any real deploy.** |
| GetYourGuide partner id `WXZGXR9` | hardcoded in prototype | Public partner id (not secret), but parameterise. |

`.gitignore` already excludes `.env`, `.env.*` and `.env.pipeline` — confirmed. **Never** commit these.

### 15.2 Production secret handling

- **Local dev:** `.env.local` (gitignored). Commit a **`.env.example`** with key *names only* (empty values) so devs know what's needed.
- **Hosting (Vercel):** store as Project → Environment Variables (Production / Preview / Development scopes). Server-only keys must **not** use the `NEXT_PUBLIC_` prefix.
- **Supabase:** service-role key is server-only (never shipped to the browser); only the anon/publishable key is client-side.
- **Rotation:** rotate any key that has ever touched a chat, screenshot, or non-gitignored file. Treat the current `.env.pipeline` token as rotate-on-handover.

### 15.3 Secure key handover (how the dev gets working credentials)

Real secret values are **never** shared via this doc, the repo, email, or chat. Use one of these channels:

1. **Project invitations (preferred — dev never sees raw values).**
   - Invite the dev to the **Vercel** project → they get the env vars scoped to their access; rotate on offboarding.
   - Invite the dev to the **Supabase** project → they use project keys from the dashboard; the service-role key stays server-side.
2. **Shared password manager** (1Password / Bitwarden) for any standalone keys (YouTube, pipeline tokens) — gives an audit trail and easy revocation.
3. **Each dev provisions their own** keys for the third-party services in §15.3 wherever possible (own Booking/TripAdvisor/Klaviyo accounts under the org).

**Rules of thumb:**
- Give each person their **own scoped credentials** — never share one personal token.
- **Rotate on handover/offboarding.** Treat the current `.env.pipeline` `GITHUB_TOKEN` as rotate-when-a-dev-joins, and issue the dev their own (a fine-grained PAT or repo collaborator access).
- Server-only keys (Supabase service role) must never reach the browser or a `NEXT_PUBLIC_` var.

### 15.4 Keys the dev team needs to obtain

| Key | Where to get it |
|---|---|
| Booking.com affiliate `AID` | partners.booking.com |
| TripAdvisor Content API | tripadvisor.com/developers |
| Numbeo API licence | numbeo.com (commercial licence) |
| Klaviyo API key | Klaviyo account |
| Mapbox/Google Places (if used for geocoding) | respective consoles |
| Supabase URL + keys | Supabase project settings |

---

## 16. Scoring port — prototype → pipeline

The prototype's unified score and the pipeline's scorer differ by design, so this is a **reconcile, not a copy/paste**. Side-by-side:

| | Prototype (`wiley-fox-uk-prototype.html`) | Pipeline (`scoring/scoring-engine.js`) |
|---|---|---|
| Direction | **Safety** score 0–100 (higher = safer) | **Risk** score (higher = worse) |
| Inputs | 70% live police + 30% Numbeo, ONS pop-adjust | volume 0.30 + severity 0.35 + recency 0.20 + population 0.15 |
| Numbeo | yes (30%) | **none** |
| Severity | ~14 fine UK categories | 4 buckets (violent 3 / sexual 4 / property 1 / asb 1) |
| Population | bounded area-density adjust (city) | per-capita, **country-level** |
| Bands | absolute thresholds, **5-band brand palette** | per-country **percentile**, 4-colour palette |
| Geography | ~1-mile radius + local hexes, UK live | H3 r7/9/11, all sources, server-side |

**Decisions to make first (they shape the work):**
- **D1 — Direction.** Pick safety-up vs risk-up for the product. Recommend: keep risk internally, expose `safety = 100 − score` in the API/UI so it reads like Numbeo (higher = safer). Low effort.
- **D2 — Banding.** Pipeline bands are *relative* (per-country percentile) so "green" isn't comparable across countries and colours shift as data lands. For a travel product, **absolute thresholds** (the prototype's approach) are more honest and stable. Moving to absolute means scoring on a fixed 0–100 scale instead of min-max-per-cohort. Medium effort.
- **D3 — Numbeo blend.** Add a city-level Numbeo layer blended into the final cell score (e.g. `final = 0.7·pipeline + 0.3·Numbeo_for_enclosing_city`). Needs a city→Numbeo table + cell→city mapping. Medium effort.

**Port items, sequenced:**
1. **Brand palette + 5 bands (quick win).** Update `lib/bands.js` to the 5 brand colours; add a migration to change `h3_safety_scores.band` CHECK from 4→5 values; update the band thresholds in `scoring-engine.js`. *(Schema change required — `band` is a CHECK-constrained column.)*
2. **D1 + D2.** Implement direction + absolute 0–100 banding in `scoring-engine.js`.
3. **D3.** Add the Numbeo table + blend step.
4. **Wire the prototype to the API.** The prototype currently calls `data.police.uk` directly; point it at `/api/safety-tiles` so demo and production agree. This is the real fix for "the two disagree."
5. **Population refinement (future).** Pipeline pop-normalisation is country-level; move toward sub-national (LSOA / H3 population grid) — supersedes the prototype's bounded city adjustment.

**Deliberately NOT ported:** the prototype's fine UK severity weights. The pipeline keeps 4 coarse buckets because international sources (FBI/ICCS/Eurostat) only map to coarse categories — finer weights can't generalise. Optionally apply finer weighting *inside* `connectors/uk-police.js` for UK only, if desired.

---

## 17. YouTube city-intelligence corpus (data resource)

> **Added 2026-06-26.** A harvested, transcript-level corpus of local travel advice for 162 cities. It is the source for a planned **qualitative intelligence layer** — local-voice "where to stay / what to avoid / tourist traps" — that enriches the ratings panel, travel guides and a map overlay. Full integration plan: **`Wiley-Fox-YouTube-Intel-Integration-Options.md`** (companion to this handoff).

### 17.1 What's in the repo

| Path | Contents | Scale |
|---|---|---|
| `city_knowledge/*.json` | Safety corpus — YouTube videos + full transcripts + a (legacy) regex `knowledge` block per city | **162 cities**, 1,390 videos, 1,315 transcripts (~2.8M words) |
| `city_guides/*.json` | Curated guide corpus — allowlisted channels, subscriber floors, max 2 videos/channel | **11 tier-1 cities** (London, Paris, NYC, Bangkok, Amsterdam, Dubai, Istanbul, Seoul, Antalya, Hong Kong, KL) |
| `youtube_city_pipeline.js` | Node harvester for the safety corpus | quota-aware (~10 cities/day) |
| `youtube_guide_pipeline.js` | Node harvester for the guide corpus | same tiering + allowlist |
| `city_intel_pipeline.py` | **Single-city LLM extractor** — already uses Claude to synthesise `CITY_INTEL`-shaped JSON | the pattern to scale |

API key: `YOUTUBE_API_KEY` in `.env.pipeline` (gitignored — §15.1).

### 17.2 Known limitation — the regex extraction is unusable

The harvesters store a `knowledge` block (places / bestAreas / pitfalls / safetyNotes) produced by a cheap regex pass. **It does not work** for a customer-facing product: an audit of all corpus files found 54,883 "place" tags whose most common values are sentence-openers and CTAs — `The`, `You`, `Things`, `Subscribe`, `And`, `Get`. Treat the regex `knowledge` block as scratch only. **The value is in the raw `transcript` field**, not the structured block.

### 17.3 Recommended use — an LLM synthesis layer

Scale `city_intel_pipeline.py` into a batch step that reads the corpus and writes clean, **attributed**, geocodable JSON per city (`safeAreas[]`, `avoidAreas[]`, `touristTraps[]`, `neighbourhoods[]`, `tips[]`, `sentiment{}`, each tagged with source videos and mention counts). Run **Haiku** for the 162-city bulk pass (cost is low single-digit £ for the whole corpus — YouTube data is already harvested, so no extra quota) and a **Sonnet** pass for tier-1 cities where guide copy is customer-facing. Strong candidate for a reusable Claude skill (`wf-city-intel-synth`) on a monthly schedule.

### 17.4 How it feeds the three surfaces

- **Ratings (§5):** a separate, clearly-labelled *"Local & traveller intelligence"* panel; replaces/extends the hand-curated `CITY_INTEL` safe/alert lists across all 162 cities. **Never enters the 70/30 numeric score.**
- **Guides (§8.7):** powers "best areas to stay / what to skip / know before you go", extending bespoke coverage from ~4 cities to all 162.
- **Map:** geocode the named areas (Nominatim/Mapbox) and render as sentiment markers **visually distinct from the crime hexes** — additive annotation, never overriding the data-driven overlay. Tier-1 first (geocodes cleanly), expand once proven.

### 17.5 Guardrails

- YouTube is **opinion**: keep it out of the numeric score, attribute every claim, label it "traveller intelligence, not crime data".
- **Recency-weight** synthesis and refresh monthly — old videos name closed venues.
- LLM prompt must **ignore sponsor segments** (transcripts contain mid-video ad reads).
- Store our own **synthesised** intel + creator attribution; check YouTube ToS before showing transcript text verbatim (synthesised summaries are the safer default).

---

## 18. Web portal redesign — screens W1–W6 (September 2026)

**Read this first: §18 is a different product surface to the rest of this document.**
Sections 0–17 describe the **UK travel-safety map** — `data.police.uk`, the unified safety score, the hex
overlay, travel guides, Booking.com. Section 18 describes **thewileyfox.com**, the signed-in
**tag / tracker portal**: family group, tagged items, inbox, SOS, shop, account. The two share a brand and
a company and nothing else. The only genuine overlap is the map screen (W3), which reuses the safety-score
panel defined in §5.

The portal's own codebase is **not** in this folder and is not covered here. §18 is the design layer only.

### 18.1 The deliverable

`WileyFox-Portal-Screens-v1.html` — one self-contained file holding the nav shell and all six screens.

- **Static front end only.** No API calls, no state, no storage, no build step. Every figure, name and
  timestamp on screen is placeholder content — see 18.4 before treating any of it as a spec.
- **Nav shell 2a (labelled sidebar) is the chosen shell.** Shell 2b (top nav, map-forward) was drawn and
  rejected: it runs out of room at five items, and the inbox badge has nowhere to live once Saved places
  and Account move into an overflow menu. 2a also carries Shop as a permanent nav item.
- Open the file in any browser. The sidebar and the chips in the black bar switch screens. **The black bar
  is handover chrome, not product UI** — delete `.handover` and its markup when porting.
- The map imagery is one JPEG embedded as a base64 data URI in the CSS custom property `--map-img` and
  reused by all three screens that show a map. Replace it with the live map component.
- Baseline **1280×800, fluid to 1920**. Below 1180px the grids collapse to a single column as a fallback
  only — mobile web is **not designed** (see 18.4).
- Type is Plus Jakarta Sans from Google Fonts; the palette is defined once as CSS custom properties in
  `:root`. Both diverge from the brand tokens in §6 — see 18.3.

### 18.2 The screens

| Ref | Screen | Route | What it does |
|---|---|---|---|
| W1 | Home — your people | `/home` | Answers "is everyone OK" in words, not pins. Status banner, family cards with an invite card in the grid, tagged-items list, a supporting map panel, and a **Needs you** block replacing the notification bell. |
| W2 | Inbox | `/inbox/:thread` | Alerts and messages merged into one list, three-pane on desktop (nav / list / thread). Finder conversation, a pinned map of where the item was found, and a handover confirmation issuing a one-time collection code. Replaces the current raw-email notifications and their "sent" delivery badge. |
| W3 | Map | `/map` | The map as a view, not the home screen. Labelled control chips replace the unlabelled circles; the safety panel shows band, rate per 1,000, three named categories and the data month. The floating "+" is removed — "Report something lost" lives in the top bar of every screen instead. |
| W4 | Family &amp; invite | `/family/invite` | The family group as its own page rather than a Profile row. One invite dialog with three routes in: link, email/SMS, QR. QR is the important one — it is the bridge from the desktop portal to a family member's phone. |
| W5 | Shop | `/shop` | The portal has no store today. Product grid, a Premium offer, and a contextual prompt generated from the user's own routine. **See 18.4 — the checkout model is an open decision.** |
| W6 | Account | `/account` | The redesigned Profile page. Two columns grouped by meaning: security, a notification channel matrix, plan. The unset SOS contact becomes a task at the top rather than a grey row. The matrix is also where the duplicate emails get switched off. |

Two sidebar items — **Tags &amp; items** and **Saved places** — have no screen in this set. The file renders a
labelled placeholder for each so the shell is complete.

### 18.3 Design tokens — divergence from §6

The screens were drawn on their own system and the file reproduces it as drawn:

| | Portal redesign (this file) | Brand tokens (§6, live prototype) |
|---|---|---|
| Display / body type | Plus Jakarta Sans | Fraunces (display) + Inter (UI) |
| Page ground | `#EDE4D6` | `#FEF6E4` |
| Primary accent | `#E0380D` | `#D7263D` / `#F46036` |
| Avatar | `#7C3AED` | not in the brand palette |

The safety bands on W3 do use the brand 1–5 palette (`#D7263D` `#F46036` `#FFC857` `#A4C957` `#3FA34D`),
so the map screen is already consistent with §5.3.

**Recommendation:** reconcile to one token set before either surface is built again, and hold it in a
single shared file both the portal and the prototype import. Left unreconciled, the portal and the map
drift into two visually different products.

### 18.4 Open decisions — settle these before build

1. **Checkout model (W5).** The screen is drawn with `Add` buttons and an implied basket. Building that
   means cart, checkout, SCA, UK VAT, refunds and order state on our own stack — against the standing rule
   that merch is Shopify print-on-demand, dropshipped, no manual touch, and it moves the EU-shipping
   control out of Shopify's territory settings, where the UK-only position depends on it. Recommended:
   Shopify Buy Button or a deep link to the Shopify PDP. Premium is a recurring product and should not
   share a row with physical goods.
2. **"Safe" language (W1).** The banner reads "Everyone is safe" and Zoe's card carries a green **Safe**
   pill, both derived from a GPS ping. This contradicts the June 2026 ruling that areas are never labelled
   safe (green = "Low incident"). Recommended replacement: "Everyone checked in", and pills reading
   **Checked in · 08:42** / **Moving** / **No signal** — state the observation, not the conclusion.
3. **Safety vocabulary (W3).** W3's legend reads *1–2 be careful / 3 be aware / 4–5 low*. The prototype
   ships `RATING_LABELS = { 1:'High caution', 2:'Caution', 3:'Stay aware', 4:'Generally safe', 5:'Very safe' }`
   — so two of the five live bands still say "safe". Agree one label set and purge the prototype's in the
   same pass. Direction is consistent in both: 5 is the best score.
4. **Data month (W3).** The panel is dated "August 2026". Home Office data publishes roughly two months in
   arrears, so that month will not exist on the day it is shown. Label it "Latest available: <month>" and
   design the failed-load state.
5. **Finder safety (W2).** As drawn, the finder sees the child's first name ("Zoe's bag"), a school-bag
   description, a pin 1.2 km from home and an agreed handover time. Recommended: a finder-side alias
   ("Navy backpack"), templated opening messages, block and report on every thread, and handovers pinned
   to the finder's public location only. Keep the one-time collection code exactly as drawn.
6. **Children's-data defaults (W4, W6).** W4 handles under-13 approval well. W6 shows 2FA **off** on an
   account sharing a child's location, and offers 7-day / 90-day location history. Under the ICO Age
   Appropriate Design Code this service needs high-privacy defaults, data minimisation and a DPIA. 2FA
   should default on for any account with a minor in the group.
7. **Placeholder figures presented as claims.** "1,840 nearby members can help" and "Bracknell: 12% fewer
   reported thefts than August" read as product copy. At launch the real nearby count will be small.
   Recommended: "we'll alert Wiley Fox members within 2 km", no count until density justifies one.
8. **Plan and pricing.** £3.99/month, 2 km radius, unlimited history, 4 tags free, 7-day free history are
   all placeholders and appear across W1, W5 and W6. These are also marketing claims — confirm before build.
9. **Global Mode.** The current portal has a UK / Global toggle, which is where the "No Data · New York"
   state comes from. The redesign drops it silently. Recommended: drop it in both surfaces to match the
   UK-only v1 scope, rather than leaving portal and prototype disagreeing.

### 18.5 Screens not yet designed

Four states are missing from the set, two of them high-traffic:

- **Logged-out / first visit.** Social is the acquisition channel, so most visitors arrive logged out on a
  phone. Nothing in this set covers that page.
- **First run — zero family, zero tags.** Every new account starts here; W1 is composed entirely of full
  states.
- **Mobile web below 768px.** The collapse behaviour of the sidebar, the three-pane inbox and the map
  panel needs deciding, not discovering in build.
- **Orders &amp; delivery, and Privacy &amp; data export.** Both are linked from W6 and neither exists. Data
  export is not optional — a subject access request carries a statutory deadline.

---

## 19. Portal build plan — making W1–W6 functional (September 2026)

**Target:** the full functionality of the original crime-map prototype **plus** every new behaviour drawn on the six
portal screens. Assumes one senior full-stack developer and one mobile developer. Estimates are developer-weeks
and assume the Supabase schema matches the App Store submission's feature inventory — WP0 confirms that first.

### 19.1 What is functional today

| Layer | State | Contains |
|---|---|---|
| **Crime-map prototype** | Fully functional, live | data.police.uk fetch, city search, click-to-fetch, unified Safety Score + 1–5 band, hex overlay, Safety Report + PDF, travel guides, Booking.com / GetYourGuide / Wikivoyage / POI, Save a Spot, community area ratings (Supabase), Global mode with FCDO fallback |
| **App backend (Supabase)** | Built, per App Store submission 17 Aug | Accounts, phone number, Family Group, SOS contacts/guardians, one-press SOS (family + optional nearby users), Child Alert (pin to nearby users), QR tags with owner-published fields, **scan log**, **contact relay** (no phone/email reveal), tag off-switch, medical profile, Protected Person, community pins/reviews, block & report |
| **Redesign files** | Static, nothing wired | `WileyFox-Portal-Screens-v1.html`; placeholder views in the redesigned prototype |

**Note on backend access:** the app's Supabase project lives in the `admin@thewileyfox.com` org, which is not the org the
connected Supabase tooling can see (that org holds "Wiley Fox Maps" — paused — Hard 75 and PropertyCompass). Direct REST
to `kicfftbhbrvphlyvpywt` is also blocked by egress policy. The schema has **not** been inspected; every "wire up" below
is an interface to confirm in WP0.

### 19.2 Element by element

Status key — **LIVE** works now in the prototype · **WIRE** backend has it, portal must call it · **NEW** nothing exists ·
**CHANGE** the drawing contradicts the real product.

| Screen | Element | Status | What it takes |
|---|---|---|---|
| W1 | Status banner "3 people, 4 tags checked in" | NEW | Needs presence (WP7). Interim: "3 in your group · 4 tags active · last scan Mon 16:20" |
| W1 | Family cards — location, arrival, battery | NEW | The Life360 build (WP7). Until then: name, role, sharing level, last SOS/Child Alert event |
| W1 | "Safe" / "En route" pills | CHANGE | Never label a person safe. Use **Checked in · 08:42** / **Moving** / **No signal** |
| W1 | Add a family member | WIRE | Opens W4 dialog (WP3) |
| W1 | Tagged items list | WIRE | Tags + scan log exist → "last scanned · place · time". "Lost · 2 replies" = lost flag + thread count (WP6) |
| W1 | "Keys · Home · 1h ago", "Rusty · Garden · live" | CHANGE | Impossible with QR — a tag has a location only when scanned. Drop "live" |
| W1 | Map panel pins | WIRE / NEW | Tag pins from scan log now; people pins after WP7 |
| W1 | Needs you — finder reply | NEW | WP4 + WP6 |
| W1 | Needs you — no SOS contact | WIRE | One query |
| W1 | Search people / tags / places | NEW | Small aggregate search |
| W1 | Report something lost | WIRE | Lost-item reporting exists; portal form + 2 km alert (WP10) |
| W2 | Unified alert list | NEW | `notifications` table + Realtime + read state (WP4). Retires the raw "TheWileyfox Alert:" emails |
| W2 | Finder conversation thread | NEW | Relay is one-way today. `threads`/`messages`, finder alias, realtime, rate limits, block/report (WP6). Makes WF a user-to-user service under the Online Safety Act |
| W2 | Pinned "found here" card | WIRE | From scan log if finder granted location at scan — confirm the scan page captures it |
| W2 | Handover + one-time collection code | NEW | WP6 |
| W2 | "Mia's tag battery is low" | CHANGE | QR tags have no battery — remove |
| W2 | Weekly safety digest | NEW | Scheduled job over pipeline crime data (WP10) |
| W3 | Map, panel, hex, search, report, guides | LIVE | All working. §16 pipeline port unchanged |
| W3 | "Safety layer on" chip | LIVE | Wired to `setHexVisibility()` |
| W3 | "People N" chip + pins, "Follow Zoe" | NEW | WP7; a followed child's device must show a visible indicator (Children's Code) |
| W3 | "Tags N" chip + pins | WIRE | Last-scan pins |
| W3 | Lost-item card, 2 km radius, member count | NEW | Extends Child Alert's nearby-users mechanism (WP10). No member count until density justifies it |
| W3 | "Bracknell Forest · August 2026" | CHANGE | Prototype derives the real month — label "Latest available: <month>"; add failed-load state |
| W3 | Legend vocabulary | CHANGE | One label set; purge "Generally safe"/"Very safe" from `RATING_LABELS` and `#globalLegend` (WP0) |
| W4 | Family page, member cards, sharing level | WIRE | Confirm per-member sharing setting in schema |
| W4 | Invite by link / email / SMS / QR | WIRE | `invites` table: single-use, 24 h, high-entropy; QR render; email/SMS sender (WP3) |
| W4 | Under-13 parent approval | WIRE | Protected Person exists; confirm approval + age gate are enforced server-side |
| W5 | Product grid, prices, Add buttons | CHANGE | Drawn SKUs aren't the Phase 1 catalogue (stickers, luggage stickers, PU name tags, disposable + silicone wristbands, keyrings — all QR). Render from Shopify; drop the native cart |
| W5 | Shopify store + POD | NEW | Store, dropship POD supplier, UK-only shipping, Buy Button (WP5) |
| W5 | Premium promo "£3.99" | CHANGE | Submitted price is £2.99/mo, £24.99/yr, 7-day trial — see 19.4 |
| W5 | "Zoe walks home on Thursdays" nudge | NEW | Needs routine detection from WP7 — defer; ship a static card |
| W6 | Profile, SOS task card, phone verify | WIRE | Exists; phone = Supabase Auth OTP |
| W6 | Two-factor authentication | WIRE | Supabase Auth TOTP MFA; **default on** when the group contains a minor |
| W6 | Active sessions | WIRE | Supabase Auth sessions list + revoke |
| W6 | Notification matrix | NEW | `notification_prefs` + single dispatch function (WP4). The only real fix for duplicate emails |
| W6 | Plan card / Compare with Premium | NEW | Entitlements + web checkout (WP9) |
| W6 | Orders & delivery | NEW | Shopify customer-account link (WP5) |
| W6 | Privacy & data export | NEW | Export job → expiring download. SARs carry a one-month statutory clock |

### 19.3 Four places the drawings contradict the product

1. **Tags are QR, not Bluetooth** (W1, W3, W5). Canvas: "Bluetooth + QR, two-year battery", live tag locations, battery levels. Reality: Phase 1 is QR-only (NFC is Phase 2, still no radio). Every tag location becomes *last scanned*; no "live", no battery. The finder network is the scan + the relay, not a radio mesh.
2. **Premium is drawn as a different product** (W1, W5, W6). Submitted: £2.99/mo or £24.99/yr, 7-day trial — offline maps, advanced filters, hourly route updates, ad-free; Play copy adds larger Family Group, full guides. Drawn: £3.99 — 2 km alerts, 90-day history. **Decision (Barry, 3 Sep): merge** — keep the submitted price, add the drawn features. See 19.4.
3. **The SKUs and prices are invented** (W5). Shop content must come from Shopify, never hand-written; the price list follows the POD supplier's cost floor.
4. **Live family location doesn't exist yet** (W1, W2, W3). The app shares location at the moment of SOS or Child Alert only. Continuous tracking, arrivals, ETAs and "Follow" are a separate product with their own mobile work, server work and a defensible child-tracking privacy position. Specified as WP7; everything else ships before it.

### 19.4 Premium, merged — £2.99 / month · £24.99 / year · 7-day trial

| Feature | Source | Build reality |
|---|---|---|
| Ad-free | App Store | Entitlement flag hides ad slots |
| Offline safety maps | App Store | Mobile tile packs per city; not a portal feature |
| Advanced filters (category, date range) | App Store | Unbuilt on launch checklist; Map view UI work |
| Hourly route updates | App Store | Depends on pipeline `route-safety-check`; mobile |
| Larger Family Group, full guides | Play | A limit check and a content gate |
| 2 km lost-item alerts | Canvas | WP10 — free 500 m, Premium 2 km, same query |
| 90-day location history | Canvas | Only meaningful after WP7; absent from comparison card until then |
| **Buying on the web** | needed for W6 | Apple requires IAP in-app; web uses Stripe. Both write the same `entitlements` row — RevenueCat does the cross-platform sync; hand-rolling is the risky option. IAP products still to be created (submission review item 7). Digital-services VAT from the first sale |

### 19.5 Live location — what replicating Life360 takes

**Mobile.** Background location (iOS "Always" + Background Modes; Android foreground service + `ACCESS_BACKGROUND_LOCATION`
with the Play policy declaration and demo video). Battery-aware sampling via significant-change and motion-activity APIs.
Batched uploads with an offline queue; each report carries battery, speed, activity. Client-side geofences for saved places
(iOS caps at 20 regions) with server reconciliation. Manual check-in; pause sharing; per-person visibility. A persistent
visible "sharing with your family" indicator — and on a child's device, "a parent can see your location".

**Server (Supabase).** `locations` (PostGIS, time-partitioned, RLS by family group), `places`, `geofence_events`, `presence`
(last fix, status, battery). Edge function: ingest → dedupe → update presence → evaluate geofences → write `notifications`.
Realtime channel per family group. ETA via routing call (OSRM / Mapbox) when status is "moving". Retention job: 7 days free,
90 days Premium, hard delete. Push via APNs / FCM for arrivals, departures, "no signal for N hours". Nearby-users query
(`ST_DWithin` on opted-in last fixes) shared with lost-item alerts. Cost model: one fix per minute per person ≈ 500k rows
per person per year — partition and purge from day one.

**Compliance before the first commit.** DPIA addendum for continuous child location (already "Critical" on the compliance
checklist). Children's Code: high-privacy defaults, no covert tracking, transparency to the child. Explicit revocable consent
per member; a child cannot be added without the guardian flow. App Store 5.1.1 and Play location-policy reviews — budget a
rejection cycle. Location history included in the W6 export bundle.

### 19.6 Work packages

| WP | Name | Steps | Depends on | Estimate |
|---|---|---|---|---|
| **WP0** | Foundations | (1) Grant team + tooling access to the `admin@thewileyfox.com` Supabase org; document every table the portal touches. (2) One shared tokens file imported by portal and prototype; decide brand vs canvas palette once. (3) Purge "Generally safe"/"Very safe"; apply "Checked in" vocabulary. (4) FBI API key → env var; Netlify CD on `main`. (5) DPIA addendum for finder messaging (OSA) and, if approved, live location. | — | 1–1.5 wk (full-stack + Barry) |
| **WP1** | Map view | (1) Mount the prototype map inside the portal's authenticated shell at `/map`, data functions intact. (2) Tag pins from scan log; "Tags N" chip. (3) Real data-month label; failed-load state; one label set. (4) Decide Global mode. (5) §16 pipeline port stays a separate track. | WP0 | 2 wk |
| **WP2** | Account (W6) | (1) Profile edit; phone OTP. (2) TOTP MFA + recovery codes, default on with a minor in the group. (3) Sessions list + remote sign-out. (4) Data-export job → expiring link. (5) SOS task card; shortcuts. | WP0 | 2 wk |
| **WP3** | Family (W4) | (1) Family page from existing members. (2) `invites`: single-use 24 h tokens; accept endpoint. (3) Copy link / email+SMS send / QR. (4) Under-13 guardian approval enforced server-side; age assurance. | WP0 | 1.5 wk |
| **WP4** | Notifications (W2 pt 1, W6) | (1) `notifications` table with RLS. (2) Every event source writes a row instead of mailing. (3) `notification_prefs` + single dispatch function. (4) Inbox list, filters, unread, Realtime; rail badge. (5) Turn off the legacy mailer. | WP0 | 2.5 wk |
| **WP5** | Shop (W5) | (1) POD supplier per fulfilment rule; load Phase 1 SKUs. (2) UK-only shipping zones (DSA / Art. 27 position). (3) Buy Button embed; cards rendered from Shopify. (4) Orders link + order-shipped notification. (5) Premium promo links to WP9, own row. | WP0; supplier = Barry | 1.5 wk |
| **WP6** | Finder threads (W2 pt 2) | (1) `threads`/`messages`; finder by session token from scan page, no account. (2) Item alias, never the owner's/child's name; templated opener; rate limits. (3) Realtime thread view; push via WP4. (4) Block/report per thread; moderation queue; OSA risk assessments cover this surface. (5) Handover: agreed time, reminders, single-use code, "Mark recovered". | WP4 | 3 wk |
| **WP7** | Live location | (1) Mobile: background location, sampling, batched upload, geofences, indicators, consent — both platforms. (2) Server tables, ingest, geofence evaluation, presence Realtime, retention. (3) Portal: people pins, Follow, W1 cards, banner. (4) Store policy reviews + demo video; DPIA sign-off. | WP4 + DPIA | 6–8 wk (mobile + full-stack) |
| **WP8** | Home (W1) | (1) Compose banner, cards, items, map panel, Needs you from existing queries. (2) Aggregate search. (3) First-run empty state, invite as hero. (4) Degraded mode without WP7. | WP2–6 | 1.5 wk |
| **WP9** | Premium billing | (1) Create IAP products (App Store Connect, Play). (2) Stripe Checkout at price parity → `entitlements`. (3) RevenueCat cross-platform sync. (4) Plan card, comparison, trial, cancel. (5) Feature flags read the entitlement. | WP2 | 2 wk |
| **WP10** | Community alerts | (1) Report-lost form; nearby-users query reusing Child Alert; 500 m / 2 km. (2) Silent push; "It's been found" / "Widen radius". (3) Weekly digest scheduled function. (4) Routine nudge deferred until WP7 has data. | WP4 (WP7 for positions; falls back to last SOS/scan) | 1.5 wk |
| **WP11** | Missing screens | Logged-out landing; mobile-web breakpoints; Orders, Data export, Tags & items, Saved places pages; error/offline/empty states. | design first | 2 wk |
| **WP12** | Hardening | Accessibility pass; rate limits on scan pages, invites, threads; monitoring; solicitor review of DPIA, OSA assessments, finder terms. | last | 1.5 wk |

### 19.7 Sequence (two developers, calendar weeks)

| Phase | Weeks | Packages | Outcome |
|---|---|---|---|
| 1 | 1–3 | WP0, WP1 | Original functionality fully preserved inside the portal shell |
| 2 | 3–6 | WP2, WP3, WP5 | Revenue live, security fixed, invites working |
| 3 | 6–9 | WP4, WP9 | Duplicate emails gone; Premium purchasable on web |
| 4 | 9–13 | WP6, WP10 | A lost bag comes home in one screen |
| 5 | 12–16 | WP8, WP11, WP12 | Portal complete **without** live location |
| 6 | 6–20 | WP7 | Mobile dev starts week 6 in parallel; portal integration lands last |

### 19.8 Five decisions before the first ticket

1. **Give the team the admin-org Supabase project.** Every WIRE estimate assumes the schema matches the submission.
2. **Approve the live-location product, or park it.** WP7 is a third of the effort and the whole of the privacy exposure; the portal is complete without it.
3. **Pick the print-on-demand supplier.** WP5 can't start without a catalogue, and prices follow the cost floor.
4. **Confirm Premium at £2.99 / £24.99 with the merged feature list**, then create the IAP products and correct the canvas copy.
5. **Brand palette or canvas palette — once.** WP0's tokens file makes either a one-line change, but it must be a choice.

---

## 20. City content pipeline, travel guides and live advice (September 2026)

> **Added 2026-10-01.** Everything built between 23 and 30 September 2026. It replaces the "planned" parts of §17 (the LLM synthesis layer now exists) and extends §8 (travel guides). Commits are listed in `CHANGELOG.md` in the repo.

### 20.1 What exists now (summary)

| Piece | Where | Status |
|---|---|---|
| Append-only city content database (videos, transcripts, facts, tips, photos, runs, config) | Neon tables `wf_*` — schema in `lib/wf-content-schema.js` | **Live** |
| Daily YouTube discovery (focus-city mode) | `netlify/functions/scheduled-youtube-discovery.js` | **Live**, daily |
| Admin API for the pipeline | `netlify/functions/wf-admin.js` → `POST /api/wf-admin` (bearer `WF_ADMIN_TOKEN`) | **Live** |
| Public city-guide API (facts, tips, photos, sources for the map panel) | `netlify/functions/wf-city-guide.js` → `GET /api/city-guide?city=<slug>` | **Live** |
| Live US State Dept advisories (single official advice source, all countries) | `netlify/functions/us-advisories.js` → `GET /api/us-advisories` (6-hour CDN cache) | **Live** |
| FBI proxy (key server-side) | `netlify/functions/fbi-state.js` → `GET /api/fbi-state?state=XX` (env `FBI_API_KEY`) | **Live** |
| City-guide template (web page + PDF + Word, Christmas chapter, comparison table) | `scripts/city-guides/` | In use |
| Redesigned prototype | `new/index.html` → `wiley-fox.netlify.app/new/` (classic homepage unchanged) | **Live** |
| Published guides | `new/guides/{london,nuremberg,munich}/` | **Live** |
| Guides in review (preview site only) | Cologne, New York → `wiley-fox-redesign.netlify.app/guides/<slug>/` | Awaiting approval |

### 20.2 Content pipeline (how a city gets its facts)

1. **Discovery** (`scheduled-youtube-discovery.js`, daily): YouTube Data API searches. **Focus mode** reads `wf_cities.focus_rank` / `guide_status` and `wf_config['discovery']` (`daily_searches`, `background_share`, `season`, `season_until`, `min_views_focus`, `min_views_background`). The current focus city gets base + seasonal (Christmas) queries in three sort orders with page tokens stored in `wf_config['disc_state:<slug>']`, so each day goes deeper. Videos under 120 s (Shorts) are filtered out. Background collection is paused (`background_share: 0`) until the Christmas guides are done.
2. **Transcripts**: YouTube blocks cloud IPs, so transcripts are fetched on Barry's Mac with `scripts/city-db/wf_transcripts.mjs <n> <parallel>` (reads `.env.pipeline`) and written via `put_transcripts`. Focus city first.
3. **Extraction**: an LLM agent reads transcripts (first ~15k chars) and writes structured **facts** (`kind`: stay, hotel, visit, caution, transport, cost, safety_feeling, food, tip, scam, christmas; one standard neighbourhood per fact + `data.borough`) and practical **tips** (8 categories). Rules: only what the creator says, no names/faces of individuals, skip sponsored segments, re-tag videos about other places (`set_city`). Nothing is deleted — wrong rows are superseded with `set_status`.
4. **Photos**: Wikimedia Commons, free licences only (no NC/ND), fetched on the Mac (Commons rate-limits cloud IPs) with `scripts/city-db/wf_photo_fetch.mjs`; every photo is **checked visually** before use and credited (`img/credits.json`).

`wf-admin` operations: `migrate, stats, upsert_cities, upsert_creators, update_creator, list_creators, add_sources, pending_transcripts, put_transcripts, pending_extraction, get_transcripts, put_facts, put_tips, put_photos, list_rows, set_status, get_focus, set_focus, set_config, mark_extracted, set_city, exclude_source, run_discovery, log_run`.

Queue (1 Oct 2026): Nuremberg (done) → **Berlin (current focus)** → Munich (live) → Cologne (review) → Chicago.

### 20.3 Official safety data per guide (honesty rules)

- Use the **most detailed official source per country**, with plain caveats: data.police.uk (UK, street level); NYPD / city open-data portals (US, point level, anchored to each dataset's latest record and rated within 1 mile per month); German police **PKS** reports (city level only — no street data is published, so German guides show a pins map instead of a hex map).
- **Comparison table** in every guide (`scripts/city-guides/data/make_compare.py`):
  - EU cities: **Eurostat `crim_gen_reg`** (police-recorded offences per 100k by NUTS 3 region, 2024) — compared **within the same country only** (countries record assault/burglary differently). Dataset snapshot: `scripts/city-guides/data/eu_crime_nuts3.json`, refresh with `eu_fetch.py`.
  - US cities: **FBI Crime Data Explorer** agency summaries vs state and US average (use the server-side key; the public DEMO_KEY rate-limits).
- Considered and **not used**: UNODC national violent/sexual crime counts (national only, to 2023, not comparable across countries); extra advisory sources (decision: US State Dept is the single official advice source).
- Every guide states what is *not* published (e.g. 2026 dates not yet announced) rather than guessing. Prices carry the year and source.

### 20.4 Guide template

`scripts/city-guides/`: `render_city.py <dir>` (HTML), `build_city_docx.js <dir>` (Word), `make_pdf.py <dir>` (PDF via Playwright, forces lazy images), `guide.css`. Input is `<dir>/guide.json` (+ `tips.json`, `img/credits.json`, optional `hexdata.json`). Per-city build scripts live in `scripts/city-guides/<city>/build_guide.py`; they pull `/api/city-guide`, add researched official content, and write `guide.json`. Supports hex-map cities (UK/US) and no-street-data cities (`official_crime` + `map_pins`).

### 20.5 Prototype (`/new`) changes

- City guide panel reads `/api/city-guide`; **"What travellers say"** placeholder on every card.
- Official advice = **live US State Dept** for every country (`renderUSAdvisoryPanel`); the old FCDO band now derives from the US level.
- Clicking a map point names the suburb (Nominatim reverse geocode, `cgReverseArea`, London boroughs list) and focuses the guide on that area → borough → city.
- US cities rated like the UK (crimes within 1 mile per month). NYC uses NYPD Current YTD `5uac-w243`; SF moved to `data.sf.gov`.
- `GUIDE_LINKS` + `GLOBAL_CITIES` entries added for each published guide (Nuremberg, Munich).

### 20.6 Deploy & push process (as used)

- Netlify sites: production `da04da9b-ff4d-49bd-8ba8-e0d997577f88` (`wiley-fox.netlify.app`, has functions + `DATABASE_URL`); preview `63d27f14-ee08-485d-824d-2575a24bfa87` (`wiley-fox-redesign.netlify.app`, static review copy).
- Guides go to **preview first**, then to `/new` only after Barry approves.
- GitHub pushes run from Barry's Mac clone (token in `.env.pipeline`, never printed). The cloud git proxy cannot push to this repo.
- Secrets (env, never in code): `DATABASE_URL`, `WF_ADMIN_TOKEN`, `FBI_API_KEY`, `YOUTUBE_API_KEY`.

### 20.7 Open items for the dev

1. Booking.com affiliate ID — guide hotel links still carry `aid=YOUR_AID_HERE`.
2. Preview-only prototype edits (Cologne in the city list; New York guide link) move to `/new` when those guides are approved.
3. Quarterly refresh job for the Eurostat and FBI comparison data (both APIs are free).
4. Optional: a `/api/fbi-agency` proxy op so guide builds can use the server-side FBI key.
5. Two Claude sessions published guides in parallel on 30 Sept; only one session should own guide publishing (the queue status in `wf_cities.guide_status` is the source of truth).

---

## Contact & sign-off

**Product owner:** Barry Wilson (`barry14wilson@gmail.com`)
**Brief reviewer:** _add dev lead name_
**Approved for build:** _date_
