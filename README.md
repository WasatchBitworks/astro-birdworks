# Wasatch BirdWorks

**Real-time bird detection from the Wasatch Front in Utah**

A public web application displaying live bird detections, species activity, and wildlife photography powered by AI-driven acoustic monitoring and field photography. Built with Astro, TypeScript, and Tailwind CSS v4.

**Live Site:** [wasatchbirdworks.com](https://wasatchbirdworks.com)

---

## What is Wasatch BirdWorks?

Wasatch BirdWorks uses [BirdNET](https://birdnet.cornell.edu/), an AI system developed by Cornell Lab of Ornithology and Chemnitz University of Technology, to continuously monitor bird activity in the Wasatch Front region of Utah. A Raspberry Pi 5 captures 24/7 audio and identifies thousands of birds weekly across 30+ local species.

The site displays real-time detections, species trends, and curated bird photography—giving visitors insight into the rich avian community of our region. This repository is the Astro frontend. The detection hardware and backend CMS are separate systems described in [Architecture](#architecture--data-flow).

---

## Features

### For Visitors
- **Live Stats Dashboard** — Total detections, unique species, hourly activity patterns
- **Audio Playback** — Listen to actual bird calls with confidence indicators
- **Species Index** — Browse all detected species with photos and detection history
- **Photo Gallery** — Curated bird photography with metadata
- **Activity Charts** — Daily trends, hourly patterns, 30-day timelines
- **Data Freshness** — Rebuilds hourly to keep information current
- **Accessible Design** — Responsive, semantic HTML optimized for all devices

### For Developers
- **Astro Server Islands** — `/live` page renders fresh per-request; everything else is prerendered static
- **TypeScript Throughout** — Typed API client, utility libraries, and component frontmatter
- **Hand-Rolled SVG Charts** — No chart library dependency; table fallbacks for no-JS
- **Failure-Mode Testing** — Headless browser verification of server island error states (`npm run verify:live`)
- **Hourly Rebuilds** — Heroku Scheduler triggers Netlify builds to keep static pages fresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Astro v6 (static-first + server islands) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme` config) |
| **Language** | TypeScript (strict) |
| **Adapter** | `@astrojs/netlify` (required for server islands) |
| **Hosting** | Netlify (CDN + automatic deploys) |
| **Backend API** | Bitworks CMS (Sinatra/Ruby, public endpoints) |
| **Rebuilds** | Heroku Scheduler → Netlify build hook |
| **Analytics** | Plausible (self-hosted) |

---

## Getting Started

### For Visitors
Visit [wasatchbirdworks.com](https://wasatchbirdworks.com) to explore live bird detections, species data, and photos.

### For Developers

**Prerequisites:** Node.js 18+, npm 9+

```bash
git clone https://github.com/WasatchBitworks/astro-birdworks.git
cd astro-birdworks

npm install
npm run dev        # Dev server at localhost:4321
```

To preview against the real Netlify runtime (required for testing server islands):

```bash
npm run build
npx netlify serve  # Production build at localhost:8888
```

---

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build to `./dist/` |
| `npx netlify serve` | Preview production build locally (Netlify CLI) |
| `npm run verify:live` | Headless browser check of `/live` failure modes |

### `verify:live`

The server island on `/live` is the only runtime dependency in the site. `npm run verify:live` runs three scenarios using Playwright: happy path, island function failure (non-200), and dead API backend. Pass a deployed URL to test against a real Netlify runtime:

```bash
node scripts/verify-live-failure-modes.mjs https://your-deploy-url.netlify.app
```

---

## Pages

| Page | URL | Description |
|---|---|---|
| **Home** | `/` | Overview with real-time stats, featured photos, activity trends, and BirdNET intro |
| **Live Feed** | `/live` | Today's detections — fresh per-request via server island, with hourly chart, audio, and client-side refresh |
| **Photo Gallery** | `/photos` | Curated bird photography with featured and recent sections |
| **Species Index** | `/species` | Browse all detected species with detection counts and habitat photos |
| **Species Detail** | `/species/:name` | Per-species page: photos, 1-year activity calendar, hourly patterns, and recordings |
| **Explore** | `/explore` | Advanced data visualization: hourly activity patterns, 30-day timeline, top species |
| **About** | `/about` | Field station tech, hardware specs, and how acoustic monitoring works |

---

## Architecture & Data Flow

### System Overview

```
┌─────────────────────────────────────────┐
│    BirdNET-Pi Device (Raspberry Pi 5)   │
│     3-mic array, 24/7 audio capture     │
└──────────────┬──────────────────────────┘
               │ Syncs every 5 minutes
               ▼
┌─────────────────────────────────────────┐
│    Bitworks CMS (Heroku)                │
│    Stores detections, manages photos    │
│    Public API: cms.wasatchbitworks.com  │
└──────────────┬──────────────────────────┘
               │ Build-time + per-request fetches
               ▼
┌─────────────────────────────────────────┐
│    Wasatch BirdWorks (This Repo)        │
│    Astro — static site + server island  │
│    Deployed to Netlify CDN              │
└──────────────┬──────────────────────────┘
               │ Served globally
               ▼
┌─────────────────────────────────────────┐
│    wasatchbirdworks.com                 │
│    Public website for bird enthusiasts  │
└─────────────────────────────────────────┘
```

### How It Works

1. **BirdNET-Pi Device** (Raspberry Pi 5) continuously analyzes audio from a 3-mic field array
2. **Detections sync** to Bitworks CMS every 5 minutes
3. **Netlify rebuild** triggered hourly to fetch fresh build-time data
4. **Static pages** generated with current detection data; `/live` island fetches fresh data on every request
5. **CDN delivery** provides fast page loads worldwide

### Data Freshness

| Source | Freshness |
|---|---|
| Static pages (Home, Species, Explore…) | Rebuilt hourly; data max 1 hour old |
| `/live` server island | Fresh per-request from CMS |
| In-page refresh | Client-side 5-minute auto-refresh on `/live` |

### Rendering Model

Everything is prerendered (static) except the `LiveStats` and `LiveDetections` components on `/live`, which use Astro's `server:defer` server islands. The static shell loads instantly from the CDN; fresh stats and detections stream in per request. Client-side refresh logic layers on top for in-page updates.

Both server island failure modes are handled and tested:

| Failure | Behavior |
|---|---|
| CMS API unreachable (island function runs) | Island renders "Live Data Temporarily Unavailable"; rest of page is intact |
| Island function/route failure | Static shell watchdog (10s timeout) swaps skeleton for an error state with reload controls |

---

## API

The site fetches from public Bitworks CMS endpoints — no authentication required.

### Birds API

**Base URL:** `https://cms.wasatchbitworks.com/api/birds` (override via `BIRDS_API_BASE`)

**Client slug:** `wasatch-bitworks` (the CMS client record, defined in `src/lib/api.ts`)

| Endpoint | Used for |
|---|---|
| `/:slug/latest` | Recent detections |
| `/:slug/detections/species` | Species list + detection counts |
| `/:slug/daily?days=30` | Daily aggregates for charts |
| `/:slug/hourly?date=today` | Full-day hourly species breakdown |
| `/:slug/detections/recent?days=30` | Individual detections for activity pattern charts |
| `/:slug/photos` | Photo metadata with variant URLs |
| `/:slug/species/:slug/presence?days=365` | 365-day presence grid per species |
| `/:slug/audio/:id` | Pre-signed S3 audio URL |

### SEO API

**Base URL:** `https://cms.wasatchbitworks.com/api/seo`

**Site slug:** `wasatch-birdworks` (the CMS *site* record — different from the client slug above)

| Endpoint | Used for | When |
|---|---|---|
| `/wasatch-birdworks/robots.txt` | Generates `robots.txt` content | Build time only |

> **Note:** The birds API uses the *client* slug (`wasatch-bitworks`); the SEO API uses the *site* slug (`wasatch-birdworks`). These are two different concepts in the CMS data model. Do not swap them.

---

## CMS Integration

This site is the presentation layer for two CMS subsystems:

### Birds API (runtime + build-time)
Detection data, species records, and photos are fetched from the CMS both at build time (static pages) and at request time (the `/live` server island).

### SEO Settings (build-time only)
`robots.txt` is generated at Netlify build time by fetching `/api/seo/wasatch-birdworks/robots.txt`. The CMS controls:

- **`Allow: /` vs `Disallow: /`** — set via the robots directive in CMS SEO Settings (`/admin/seo/settings`)
- **`Sitemap:` line** — overridden in `robots.txt.ts` to `/sitemap-index.xml` (Astro's actual path)

The deployed `robots.txt` is a normal static file — the CMS is only involved during builds, not at request time.

**Pre-launch / launch-day workflow:**
1. Set robots directive to `noindex, nofollow` in CMS SEO settings
2. Trigger a Netlify build → `robots.txt` becomes `Disallow: /`
3. On launch day, set directive to `index, follow` → trigger build → crawlers allowed in

No changes to this repo needed for that workflow.

---

## Environment

| Variable | Default | Description |
|---|---|---|
| `BIRDS_API_BASE` | `https://cms.wasatchbitworks.com/api/birds` | Birds API base URL |

---

## About BirdNET

[BirdNET](https://birdnet.cornell.edu/) is an AI-powered bird sound recognition system developed by [Cornell Lab of Ornithology](https://www.birds.cornell.edu/) and Chemnitz University of Technology. It uses deep learning to identify bird species from audio with high accuracy across 6,000+ global species.

Our installation runs continuously on a Raspberry Pi 5, analyzing audio from the Wasatch Front. The system filters detections below 70% confidence to reduce false positives and has been active since December 22, 2025.

**Hardware:**
- 3-microphone array with Primo EM272Z1 capsules (phantom-powered)
- Alesis MultiMix 8 USB audio interface
- 16-bit PCM stereo, 48kHz, 15-second segments
- Location: 40.5608°N, 111.8460°W, ~4,500 ft elevation

---

## License & Attribution

Built with:
- [BirdNET](https://birdnet.cornell.edu/) — Acoustic bird monitoring (Cornell Lab of Ornithology + Chemnitz University of Technology)
- [BirdNET-Pi](https://github.com/Nachtzuster/BirdNET-Pi) — Open source Raspberry Pi implementation
- [Astro](https://astro.build/) — Web framework
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [Plausible Analytics](https://plausible.io/) — Privacy-first analytics

**Created by:** Zach Kane / [Wasatch Bitworks](https://wasatchbitworks.com)
**Active since:** December 2025
