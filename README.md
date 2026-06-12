# Astro BirdWorks

Astro rebuild of [wasatchbirdworks.com](https://wasatchbirdworks.com) — live bird detections from the Wasatch Front, powered by BirdNET-Pi and the Bitworks CMS Birds API.

See [astro_birds.md](astro_birds.md) for the migration plan and architecture decisions.

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build to `./dist/` |
| `npx netlify serve` | Preview the production build locally (Netlify CLI; `astro preview` is not supported by the Netlify adapter) |

## Environment

- `BIRDS_API_BASE` — Birds API base URL (default: `https://cms.wasatchbitworks.com/api/birds`)
