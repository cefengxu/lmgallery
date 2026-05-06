# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Express + Vite HMR) on port 3738
npm run build        # Production build → dist/
npm run preview      # Serve production build locally
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run clean        # Remove dist/
```

No test framework is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```
PORT=3738
PEXELS_API_KEY_1=<required>
PEXELS_API_KEY_2=<optional>   # additional keys for round-robin rotation
PEXELS_PER_PAGE=3             # results per search
PEXELS_IMAGE_MAX_EDGE=        # optional pixel limit for CDN variant selection
APP_BASE_URL=                  # optional public URL
```

## Architecture

**Full-stack SPA** — React frontend + Express backend, both served from one Node process.

### Backend (`server.ts`)

Express server exposes `/api/search` (GET `?q=` and POST `{ q | keyword }`). It:
- Rotates across multiple `PEXELS_API_KEY_N` env vars using round-robin to stay within rate limits
- Calls the Pexels v1 search API via axios
- Picks the optimal image CDN variant based on `PEXELS_IMAGE_MAX_EDGE`
- Transforms Pexels response to `GallerySearchResultItem` shape before returning JSON

In production, Express also serves the static `dist/` build with SPA fallback.

### Frontend (`src/`)

Single-component app (`App.tsx`) with:
- Search input → `GET /api/search?q=`
- Three-tier results layout: feature image (7/12 cols), secondary pair (5/12 cols), grid of remaining items
- Lightbox modal for expanded view
- Client-side file download

`src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge) for class merging.

### Build

Vite handles React + TypeScript compilation. Path alias `@/*` maps to the repo root. `GEMINI_API_KEY` can be injected at build time via Vite define. HMR can be disabled via `DISABLE_HMR=true`.
