# Wiley Fox — Claude Code Briefing

Read this before touching any code in this folder. It tells you who we are, what we're building, how it should look, and the rules of engagement.

---

## Who We Are

Wiley Fox is a travel-safety intelligence platform for people who want to explore the world confidently. We make crime data beautiful, useful, and actionable — not scary.

- **Founder:** Barry Wilson (barry14wilson@gmail.com / admin@thewileyfox.com)
- **Stage:** Pre-launch prototype → Phase 1 (£0–£100K ARR)
- **Ambition:** Lean unicorn. 5 humans + AI to £1B in 24 months. Every process automated by design.

---

## What's in This Repo

This repo contains two related but separately-architected pieces of the Wiley Fox product:

1. **`wiley-fox-uk-prototype.html`** — the flagship product. Single-file HTML, no build tools, no framework dependencies. Live UK crime map. **Keep it that way unless Barry explicitly asks to change the architecture.**
2. **The data pipeline** (`/connectors`, `/lib`, `/supabase`, eventual `/netlify/functions`) — a backend that ingests free/open crime data from around the world, scores it into H3 cells, and exposes a GeoJSON endpoint. **This is allowed to use npm + Supabase + Netlify Functions.** It's a server-side system; the prototype stays single-file and will eventually consume `/api/safety-tiles` instead of calling `data.police.uk` directly.

If a rule below mentions "the prototype", it applies to the HTML file. If it mentions "the pipeline", it applies to the backend.

---

## The Map Prototype

**File:** `wiley-fox-uk-prototype.html`

### What it does
- Fetches live crime data from data.police.uk (UK Home Office API, free, monthly updates).
- Covers England, Wales & Northern Ireland — Scotland is deferred to v2.
- Displays crime heat-map dots on a MapLibre GL map (OpenStreetMap tiles).
- Sidebar shows: city search, safety rating (1–5 scale), crime breakdown by category, hotel suggestions, and a link to the travel guide.
- Hotel cards link to Booking.com via affiliate URL (AID placeholder — `YOUR_AID_HERE` must be replaced with the live affiliate ID when approved).

### Key dependencies (CDN — do not change versions without checking)
- MapLibre GL 4.7.1 — map rendering
- Google Fonts: Fraunces (display/headings) + Inter (UI/body)

### Data sources
- Primary: `https://data.police.uk/api` — street-level crime by lat/lng and date
- Reference catalogue: `../Desktop/Wiley fox/WileyFox Shared/Crime stats and data/global_crime_data_sources.csv`
- London city guide data: drawn from `London_Travel_Guide.docx`

---

## Design System — Never Break These

### Brand colours (CSS variables already defined in the prototype)

| Variable        | Hex       | Use                          |
| --------------- | --------- | ---------------------------- |
| `--orange`      | `#FF7B14` | Primary CTA, active, logo    |
| `--orange-dark` | `#E2620A` | Hover                        |
| `--sage`        | `#AABA9F` | Accents, thumbnails          |
| `--cream`       | `#E5EBD3` | Card backgrounds             |
| `--cream-light` | `#F2F4E5` | Page background              |
| `--charcoal`    | `#232323` | Primary text, dark buttons   |

### Safety rating colours (prototype 1–5 scale)

| Rating | Colour    | Meaning       |
| ------ | --------- | ------------- |
| 1      | `#D7263D` | Highest crime |
| 2      | `#F46036` | High          |
| 3      | `#FFC857` | Moderate      |
| 4      | `#A4C957` | Low           |
| 5      | `#3FA34D` | Safest        |

### Pipeline band colours (4-band, per spec)

| Band   | Hex       | Meaning           |
| ------ | --------- | ----------------- |
| green  | `#2ECC71` | < 70th percentile |
| amber  | `#F39C12` | 70–85th           |
| red    | `#E74C3C` | 85–95th           |
| purple | `#8E44AD` | > 95th            |

> Phase 6 needs a mapping between the prototype's 1–5 and the pipeline's 4 bands. Likely: 5→green, 4→green, 3→amber, 2→red, 1→purple, with the marker bar interpolated from raw `score`. Decide with Barry before shipping.

### Typography
- Headings / display / ratings: **Fraunces** serif
- UI / body / labels: **Inter** sans-serif
- Never introduce a third font without Barry's approval.

### Tone of voice
- Professional but warm and approachable — like a well-travelled friend giving honest advice.
- Never alarmist. Data is presented factually, not scaremongeringly.
- Clean, classy, grown-up. **No emojis in UI labels.**

---

## Architecture Rules

### Prototype
1. **Single-file HTML.** All CSS and JS stay in `wiley-fox-uk-prototype.html`. Do not create separate `.css` or `.js` files unless Barry explicitly asks.
2. **No framework lock-in.** Vanilla JS only. No React, Vue, etc. unless Barry approves.
3. **CDN-only for libraries.** No npm, no build pipeline in the prototype.
4. **Mobile-first responsive.** The breakpoint is 900px (already in the CSS). Preserve it.
5. **data.police.uk is the authoritative data source for UK crime** until the pipeline ships. Do not swap it out.
6. **Affiliate links:** Booking.com links are monetisation-critical. Never remove them. The AID placeholder `YOUR_AID_HERE` is intentional — leave it until Barry provides the live ID.
7. **Scotland excluded** — `data.police.uk` does not cover Scotland. Do not add Scottish cities to the city grid without flagging this limitation.

### Pipeline
1. **npm + ESM JavaScript.** Modern Node 18+, `import`/`export`. TypeScript optional but JS is fine.
2. **All API keys via environment variables** — never hardcoded. See `.env.example`.
3. **Idempotent connectors.** Every connector uses `upsert` on `(source_api, source_record_id)`. Re-running is safe.
4. **Free / open data sources only.** No paid APIs at this stage.
5. **Graceful error handling.** A failed area / agency / year logs an error but does not crash the run.
6. **Pipeline runs are logged** to `pipeline_logs` (`source, records_fetched, records_inserted, errors, run_at`).

---

## Current City Coverage (Prototype)

London · Manchester · Birmingham · Liverpool · Leeds · Bristol · Newcastle · Cardiff · Belfast · Brighton

Hotel data (`SAMPLE_HOTELS`) exists for all 10 cities. Prototype placeholders — production will call the Booking.com Demand API.

---

## What to Work On Next (Priority Order)

Approach in this order if no specific task is given:

1. **Postcode / area-level search** — let users type a postcode (e.g. SW1A) and zoom to that specific area.
2. **Date range filter** — month/year range (`data.police.uk` supports `?date=YYYY-MM`).
3. **Crime category filter** — checkboxes to show/hide categories.
4. **Save / share a location** — shareable URL encoding city + view state.
5. **Travel guide modal** — in-app display of the curated city guide content (only London written so far).
6. **Scotland disclaimer** — friendly banner when a user searches for a Scottish city.
7. **Performance / offline** — cache API responses in sessionStorage.

Pipeline-side priorities are tracked in the project spec (Phases 1–7).

---

## Business Context

- **Phase 1 is solo founder + AI.** Keep solutions lean.
- **Tool spend budget:** £300–£800 / month max at this stage.
- **Revenue streams in the map:** affiliate hotel bookings, travel guide content, future premium subscription.
- The unicorn thesis depends on **automation-first thinking**. If a process needs a human, flag it and suggest how an AI agent could handle it instead.
- When suggesting enhancements, briefly note if it's a candidate for a Claude skill (repeatable automated task).

---

Last updated: May 2026 · Maintained by Cowork AI
