# Wiley Fox — Dev Handoff (v1: UK-only)

**Status:** Ready for dev kickoff
**Scope:** UK England, Wales & Northern Ireland (Scotland deferred to v2)
**Date:** 2026-04-29 · **Last updated:** 2026-06-22 (prototype v1.1)
**Owner:** Barry Wilson

---

## 0. Changelog — June 2026 prototype update

The prototype was reworked in June 2026. The following changes supersede earlier descriptions in this document — read these before building:

- **Unified Wiley Fox Safety Score (0–100 + 1–5 band).** The rating is no longer a single density-bucket score. It now blends live police data (70%) with Numbeo resident perception (30%), is population-adjusted, and outputs a 0–100 headline score with the 1–5 colour band derived from it. **Section 5 is fully rewritten.**
- **Real Numbeo data + ONS population density** added as scoring inputs (Sections 5.1–5.2).
- **Map hex overlay re-aligned** to the brand 1–5 palette and the same scoring curve as the rating, replacing an off-brand 4-tier palette (Section 5.3).
- **Attraction pins** now fail over across three OpenStreetMap Overpass mirrors for reliability (Section 7.5).
- **Community traveller ratings** are now prototyped — a multi-step capture (overall → areas → per-area). **Now LIVE** against a dedicated Supabase project (`admin@thewileyfox.com` org); read/insert verified (Section 13).
- **Travel guide** requires the page to be served over HTTP, not opened via `file://` (Section 8). A `start-prototype.command` launcher is included in the folder.
- **Data sources & refresh strategy** documented in full (new Section 14).
- **Secrets & API key management** documented — where keys live and the production convention (new Section 15).

---

## 1. What's in this folder

| File | Purpose |
|------|---------|
| `wiley-fox-uk-prototype.html` | Working single-file prototype. Pulls live data from data.police.uk. Best run via the launcher below (the travel guide needs HTTP — see §8). |
| `start-prototype.command` | macOS launcher — serves the prototype over `localhost` so all features (incl. travel guide) work. Double-click (right-click → Open the first time). |
| `wileyfox-travel-guide-template.html` | `{{TOKEN}}` template the guide generator fills (§8). |
| `Wiley-Fox-Dashboard-PRD-Template.md` | Editable PRD scaffold (cross-reference with `PRD Document WF.docx`). |
| `Wiley-Fox-Dev-Handoff-v1.md` | This document. |
| `../WileyFox Shared/Crime stats and data/` | Reference datasets (UNODC, global sources for v2). |
| `../WileyFox Shared/PRD Document WF.docx` | Original product brief. |

The prototype is a reference implementation, not production code. Dev team rebuilds it properly in Next.js — but the rating algorithm, data shape, UX patterns, and brand application are all there to copy.

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

## Contact & sign-off

**Product owner:** Barry Wilson (`barry14wilson@gmail.com`)
**Brief reviewer:** _add dev lead name_
**Approved for build:** _date_
