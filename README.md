# Astro BirdWorks

Astro rebuild of [wasatchbirdworks.com](https://wasatchbirdworks.com) — live bird detections from the Wasatch Front, powered by BirdNET-Pi and the Bitworks CMS Birds API.

**Deployed:** https://astro-birdworks.netlify.app (parallel run; wasatchbirdworks.com still points at the Eleventy site until the DNS swap).

See [astro_birds.md](astro_birds.md) for the migration plan, architecture decisions, parity audit, /live failure-mode handling, and the remaining pre-swap checklist.

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build to `./dist/` |
| `npx netlify serve` | Preview the production build locally (Netlify CLI; `astro preview` is not supported by the Netlify adapter) |
| `npm run verify:live` | Headless-browser check of /live failure modes (CMS down, server-island failure + watchdog). Pass a base URL to run against a deploy. |

## Environment

- `BIRDS_API_BASE` — Birds API base URL (default: `https://cms.wasatchbitworks.com/api/birds`)
