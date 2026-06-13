# Astro BirdWorks — Migration Plan

**Goal:** Rebuild [wasatchbirdworks.com](https://wasatchbirdworks.com) (currently Eleventy, at `~/wasatch_bitworks/birdworks`) as an idiomatic Astro project. Feature and visual parity with the current site is the definition of done; the implementation is fully Astro-native, not a port of Eleventy patterns.

**Backend:** Unchanged. The site consumes the Bitworks CMS Birds API (`~/wasatch_bitworks/bitworks_cms`, Sinatra app at `birds/app.rb`). No CMS changes are required for parity.

---

## Decisions (made 2026-06-12)

| Decision | Choice |
|---|---|
| Build approach | Idiomatic Astro from day one; parity with birdworks is the target, not the implementation |
| Rendering | Static (prerendered) site + **server islands** for fresh data on `/live` |
| Adapter | `@astrojs/netlify` (required for server islands; everything else stays prerendered) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`, CSS-first `@theme` config) |
| Client JS | Port logic from the three vanilla JS files, restructured as scoped scripts inside components/islands — not rewritten, not dumped in `public/` |
| Language | TypeScript throughout (`src/lib`, component frontmatter) |
| Deploy | New Netlify site on a preview domain, run in parallel with the Eleventy site; point wasatchbirdworks.com at it once parity is verified, then retire birdworks |
| Rebuilds | Reuse the hourly GitHub Actions → Netlify build hook pattern (6am–10pm MT) with a new hook for this site |

---

## Reference: the current site

### Pages (all must reach parity)

| URL | Source (birdworks) | Notes |
|---|---|---|
| `/` | `src/index.html` (356 ln) | Stats cards, featured photos, Activity Overview (daily + hourly charts, top species w/ thumbnails), recent detections, BirdNET intro |
| `/live` | `src/live.html` (249 ln) | Day stats cards, daily detections summary chart (top 15 + hourly heatmap), detections table w/ pagination + audio, refresh |
| `/species` | `src/species.html` (181 ln) | Species card grid: photo header, confidence stats, last seen |
| `/species/:slug` | `src/species-detail.html` (303 ln) | One page per species. Stats, photo viewer, presence grid (365-day calendar), hourly activity patterns chart, today's detections |
| `/photos` | `src/photos.html` (115 ln) | Featured + recent photo galleries |
| `/explore` | `src/explore.html` (209 ln) | Daily hourly activity patterns chart, 30-day timeline, top species activity table |
| `/about` | `src/about.html` (321 ln) | Static content about BirdNET-Pi |
| `/404` | `src/404.html` | |
| `/sitemap.xml`, `/robots.txt` | `src/sitemap.njk`, `src/robots.txt` | |

### Client JS to port

| File | Loaded on | Responsibilities |
|---|---|---|
| `src/js/charts.js` (1398 ln) | `/`, `/explore` | Daily detections summary (bar ranking + hourly heatmap), 30-day timeline, hourly activity bars, day-of-week patterns, top species table. SVG, no chart library, table fallbacks for no-JS |
| `src/js/live-refresh.js` (943 ln) | `/live` | Manual/auto refresh: parallel fetch of `/latest?limit=200` + `/hourly?date=today`, updates stats cards, heatmap chart, detections table; client-side pagination (20/page); audio playback via pre-signed URLs, one-at-a-time |
| `src/js/species-detail.js` (1064 ln) | `/species/:slug` | GitHub-style 365-day presence grid (fetches `/species/:slug/presence`), species hourly activity patterns (fetches `/detections/recent?days=30`, filters client-side) |

### Eleventy filters → `src/lib/` utilities

| Eleventy filter | Astro equivalent |
|---|---|
| `toMountainTime`, `toMountainTimeShort`, `toMountainDate` | `src/lib/datetime.ts` — same `toLocaleString` + `timeZone: "America/Denver"` approach (never manual offsets); also needed client-side (live-refresh already has `formatMountainTime`) |
| `findPhotoBySpecies`, `filterPhotosBySpecies` | `src/lib/photos.ts` — featured-first matching by `common_name` |
| `slugify` | `src/lib/slug.ts` — **must reproduce Eleventy output exactly** (see URL-preservation risk below) |
| `json`, `slice`, `reverse`, `shuffle` | Native JS in component frontmatter — no filters needed |

### Design system (carry over verbatim)

- Inter font (400/600/800), Google Fonts with `display=swap`
- Nature palette → Tailwind v4 `@theme` tokens: forest `#2D5016`, leaf `#4A7C2C`, sky `#7BB3E8`, earth `#8B6F47`, sun `#F4A261`, charcoal `#1E293B`
- Confidence badges: ≥90% green, 70–89% yellow, <70% gray
- Sticky header with hide-on-scroll-down/show-on-scroll-up, mobile menu w/ overlay
- Empty states everywhere: zero data renders friendly messaging, never errors

---

## API contract (Bitworks CMS Birds API)

Base: `https://cms.wasatchbitworks.com/api/birds`, slug `wasatch-bitworks`. Override via `BIRDS_API_BASE` env var (keep the same name as birdworks).

**Build-time fetches** (replaces `src/_data/birds.js`):

| Endpoint | Used for |
|---|---|
| `/:slug/latest?date=today&limit=200` | Today's detections (home, live initial render) |
| `/:slug/detections/species` | Species + detection counts → drives `getStaticPaths` for species pages |
| `/:slug/daily?days=30` | Daily aggregates (charts) |
| `/:slug/hourly?date=today` | Full-day hourly species breakdown (live chart/stats) |
| `/:slug/detections/recent?days=30` | Individual detections for hourly-pattern charts |
| `/:slug/photos?per_page=100` | All photos w/ variant redirect URLs |
| `/:slug/photos/featured` | Featured subset |

**Client-side / server-island fetches:**

| Endpoint | Used by |
|---|---|
| `/:slug/latest?limit=200` + `/:slug/hourly?date=today` | Live refresh + `/live` server island |
| `/:slug/audio/:id` | Pre-signed S3 audio URL (CORS enabled) |
| `/:slug/species/:species_slug/presence?days=365` | Presence grid on species pages |

Photo URLs: always the stable redirect form `/:slug/photos/:id/file?variant={thumbnail|medium|large}` — never the raw S3 URL. Timestamps: API returns UTC; display Mountain Time (canonical reference: CMS `docs/birds/BIRDS.md`).

---

## Target architecture

```
astro_birds/
├── astro.config.mjs          # netlify adapter, sitemap integration, tailwind vite plugin
├── netlify.toml              # build cmd, security headers (port from birdworks)
├── src/
│   ├── styles/global.css     # Tailwind v4 @theme: nature palette, Inter
│   ├── lib/
│   │   ├── api.ts            # typed client for all Birds endpoints + response types
│   │   ├── birds.ts          # build-time aggregate (the `birds` object: today, species, daily, hourly, recent, photos, featuredPhotos, generatedAt)
│   │   ├── datetime.ts       # Mountain Time formatters (shared server/client)
│   │   ├── photos.ts         # species↔photo matching
│   │   └── slug.ts           # Eleventy-compatible slugify
│   ├── layouts/Base.astro    # head/SEO/OG, header, footer, Plausible
│   ├── components/
│   │   ├── Header.astro, Footer.astro, MobileMenu (scoped script)
│   │   ├── StatsCard.astro, ConfidenceBadge.astro, EmptyState.astro
│   │   ├── DetectionsTable.astro (+ pagination/audio script)
│   │   ├── PhotoCard.astro, PhotoGallery.astro, SpeciesCard.astro
│   │   ├── charts/           # DailySummary, ThirtyDayTimeline, HourlyActivity,
│   │   │                     #   TopSpecies, ActivityPatterns (ported from charts.js)
│   │   ├── live/LiveStats.astro        # server island (server:defer) — fresh per request
│   │   ├── live/LiveDetections.astro   # server island + client refresh script
│   │   └── species/PresenceGrid, SpeciesActivityPatterns (ported from species-detail.js)
│   └── pages/
│       ├── index.astro, live.astro, species/index.astro,
│       ├── species/[slug].astro        # getStaticPaths from detections/species
│       ├── photos.astro, explore.astro, about.astro, 404.astro
│       └── robots.txt (static) — sitemap via @astrojs/sitemap
└── public/                   # favicon, logo, og images (copied from birdworks src/images)
```

**Rendering model:** everything prerendered (default) except the server-island components on `/live`, which use `server:defer` — static shell loads instantly, fresh stats/detections stream in per request. The existing client refresh logic stays on top of that for in-page updates. Net effect: `/live` is always fresh on load instead of up to an hour stale.

**Data fetching at build:** `src/lib/birds.ts` fetches all seven endpoints in parallel once per build (module-level memoization so every page shares one fetch). No eleventy-fetch-style disk cache needed — builds are hourly and a fresh fetch each build is the desired behavior. On fetch failure, return the empty-fallback shape (same contract as birdworks) so a CMS outage produces an empty-but-valid site rather than a failed build. Log counts like birds.js does.

---

## Risks / parity traps

1. **Species URLs must not change.** Current permalinks are `/species/{{ common_name | slugify }}/` using Eleventy's slugify (e.g. "Woodhouse's Scrub-Jay" → `woodhouses-scrub-jay`). `src/lib/slug.ts` must match exactly or we break indexed URLs and the presence-grid API calls. Verify by diffing generated paths against birdworks `_site/species/*/`.
2. **Tailwind v4 ≠ v3 in a few defaults** (border color, ring width, etc.). The palette moves from `tailwind.config.js` to `@theme`. Visual diff each page against production.
3. **Charts are hand-rolled SVG with table fallbacks.** Port carefully; the no-JS fallback behavior is a parity requirement, not an extra.
4. **Empty states are a hard requirement** — every page must render sensibly with zero detections/photos (CLAUDE.md in birdworks documents this as critical).
5. **Server islands change `/live` semantics** — the build-time snapshot is replaced by per-request data inside the islands. Make sure the "Data updated: {timestamp}" footer reflects the right source (build time for static pages, request time inside islands).
6. **Photos pagination**: API caps at 100/page; currently ~23 photos. Fine for now; `api.ts` should note the limit so >100 photos doesn't silently truncate later.
7. **Plausible on the preview domain** won't record (script is pinned to `data-domain="wasatchbirdworks.com"`) — expected; verify it fires after the domain swap.
8. **Mountain Time everywhere** — use `toLocaleString` with `timeZone: "America/Denver"`, never manual UTC offsets (DST).

Dropped intentionally: `netlify/functions/verify-turnstile.js` and Netlify Forms wiring (documented in birdworks INTEGRATIONS.md as not active — no contact form on the live site).

---

## Phases

### Phase 1 — Scaffold & foundation
- `npm create astro@latest` (minimal, TypeScript strict), add `@astrojs/netlify`, `@astrojs/sitemap`, Tailwind v4 via `@tailwindcss/vite`
- `global.css` with `@theme` nature palette + Inter
- `src/lib/`: `api.ts` (typed endpoints + response types), `birds.ts`, `datetime.ts`, `slug.ts`, `photos.ts`
- `Base.astro` layout: SEO/OG/Twitter/canonical meta, header (hide-on-scroll + mobile menu as scoped script), footer, Plausible
- Copy static assets (logo, favicon, OG images, robots.txt) from birdworks
- **Checkpoint:** `npm run dev` renders a styled shell with live API data logged at build

### Phase 2 — Static pages, simple → complex
1. `404.astro`, `about.astro` (static content)
2. `photos.astro` (PhotoGallery/PhotoCard components)
3. `species/index.astro` (SpeciesCard grid)
4. `species/[slug].astro` (getStaticPaths; stats + photo viewer; presence grid + activity patterns as client components ported from species-detail.js)
- **Checkpoint:** species slugs diff clean against birdworks `_site/species/`

### Phase 3 — Chart-heavy pages
- Port `charts.js` into `src/components/charts/` (one component per chart, shared SVG helpers, table fallbacks)
- `index.astro` (stats, featured photos, Activity Overview, recent detections, BirdNET intro)
- `explore.astro`
- **Checkpoint:** side-by-side visual diff of `/` and `/explore` against production

### Phase 4 — `/live` with server islands
- `LiveStats` + `LiveDetections` as `server:defer` islands fetching fresh data per request
- Layer ported live-refresh logic (refresh button, auto-refresh, pagination, audio playback) on top
- Verify on a Netlify deploy (server islands need the adapter runtime — test deployed, not just `astro dev`)

### Phase 5 — Parity audit & deploy
- Page-by-page checklist against production: content, empty states, no-JS fallbacks, Mountain Time formatting, SEO meta/sitemap/canonical, Lighthouse
- New Netlify site + preview domain, env vars, security headers in `netlify.toml`
- Hourly rebuilds via a Netlify build hook (ended up triggered by Heroku Scheduler, not the originally planned GitHub Actions workflow)
- Run in parallel; when satisfied: point wasatchbirdworks.com DNS at the new site, confirm Plausible, retire the Eleventy site

---

## Build status (2026-06-12)

All five phases are built. Phases 1–4 committed per phase; see git log.

**Parity audit results:**
- Every URL in birdworks `_site/` exists in `dist/` (0 missing, incl. all 99 species slugs)
- Page titles match on all pages (species pages also fix birdworks' doubled "| Wasatch BirdWorks" title bug)
- Sitemap: 105 URLs at `/sitemap-index.xml`; `/sitemap.xml` 301-redirects to it (netlify.toml); robots.txt updated
- `astro check`: 0 errors, 0 warnings
- Server island verified against the dev server: fresh per-request data (361 detections at request vs 355 at build), script payload included

**Deliberate deviations from birdworks (improvements, all noted in commits):**
1. Nature palette classes (`text-forest-green` etc.) now actually exist — birdworks referenced them without defining them in Tailwind config, so they silently no-opped
2. `detections/species?limit=500` — birdworks used the default limit of 100 and the site is at 99 species (one away from silent truncation)
3. Hourly-average + activity-patterns charts fetch `/detections/recent?days=30` client-side instead of embedding 25k detections as a JSON attribute (multi-MB HTML → ~30KB)
4. `/live` renders stats/chart/table fresh per request via a server island; refresh controls still layer on top
5. Species page `<title>` no longer doubles the site name
6. Turnstile function + Netlify Forms wiring dropped (documented as inactive in birdworks)

**/live failure modes (the one new moving part):**

The server island on /live is the only runtime dependency in the site; both of its failure modes are handled and verified in a headless browser (`npm run verify:live`, scripts/verify-live-failure-modes.mjs):

| Failure | Behavior |
|---|---|
| CMS API unreachable (island function fine) | The island itself renders "Live Data Temporarily Unavailable" with the rest of the page intact (`LiveFeed.astro` catches its fetch errors). Watchdog stays quiet. |
| Island route/function failure (non-200, network error, misdeploy) | Astro's runtime leaves the fallback skeleton and the island's script (incl. refresh handlers) never arrives. A **watchdog in the static shell** (live.astro) waits 10s, then swaps the skeleton for a "Live Data Couldn't Load" error state, sets the status text, and wires both "Reload Page" and "Refresh Now" to a full page reload. If the island arrives late (slow cold start), a MutationObserver undoes the watchdog. |

Verification: `npm run verify:live` runs three scenarios locally (happy path; island requests aborted via Playwright routing; dev server with a dead `BIRDS_API_BASE`). After deploying, run `node scripts/verify-live-failure-modes.mjs https://<preview-domain>` to re-check the first two against the real Netlify runtime.

**Deploy status (2026-06-12):** ✅ Live on Netlify at **https://astro-birdworks.netlify.app** (site `astro-birdworks`, Wasatch Bitworks team, deploys from `main`). Clean first deploy; no environment variables set — `BIRDS_API_BASE` defaults to the production CMS in code.

**DNS swap complete (2026-06-13):** ✅ wasatchbirdworks.com now points at the Astro site. Domain transferred from the Eleventy Netlify site to `astro-birdworks`; fresh Let's Encrypt cert issued; HTTPS enforced. Repo made public at https://github.com/WasatchBitworks/astro-birdworks.

~~**Remaining steps before DNS swap:**~~
1. ✅ (2026-06-12) Deployed /live verified on the real function runtime
2. ✅ (2026-06-12) Hourly rebuilds live via Heroku Scheduler
3. ✅ (2026-06-13) DNS swapped — wasatchbirdworks.com live on Astro
4. ✅ (2026-06-13) Repo made public; README rewritten for public consumption

## Open items (decide during build, none blocking)

- View transitions (`<ClientRouter />`): nice polish for species↔photos navigation; try in Phase 5, drop if it fights the scripts
- Whether home-page stats also become a server island later (post-parity enhancement, not in scope now)
- `astro:assets` applies only to local images (logo, OG); CMS photos stay `<img>` against redirect URLs
