# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Express + Vite HMR) on port 3738
npm run build        # Production build → dist/
npm run preview      # Serve production build via Vite (not Express)
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run clean        # Remove dist/
```

No test framework is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```
PORT=3738                          # server port (default 3738)
PEXELS_API_KEY_1=<required>       # at least one Pexels key required
PEXELS_API_KEY_2=<optional>       # additional keys for round-robin rotation
PEXELS_PER_PAGE=3                 # results per search (1–80)
PEXELS_IMAGE_MAX_EDGE=            # optional pixel limit for CDN variant selection
UNSPLASH_ACCESS_KEY=<required>    # Unsplash API access key (combined search won't work without it)
APP_BASE_URL=                     # optional public URL for startup log
GEMINI_API_KEY=                   # injected at build time via Vite define
DISABLE_HMR=true                  # disable Vite HMR (e.g. in AI Studio)
```

## Architecture

**Full-stack SPA** — React frontend + Express backend, both served from one Node process.

### Backend (`server.ts`)

Single-file Express server. Key API routes:

| Route | Method | Description |
|---|---|---|
| `/api/search/pexels` | GET/POST | Pexels-only search (`?q=` or body `{q, keyword}`) |
| `/api/search/unsplash` | GET/POST | Unsplash-only search |
| `/api/search/combined` | GET/POST | Parallel Pexels + Unsplash — used by the SPA |
| `/api/unsplash/track-download` | POST | Unsplash download tracking (body: `{downloadLocation}`) |

**Combined search logic:** total count from `PEXELS_PER_PAGE` is randomly split 5:5 or 4:6 between Pexels and Unsplash. Results are merged and shuffled. Unsplash per-page is capped at 30 (API limit).

**Pexels key rotation:** env keys `PEXELS_API_KEY_1`, `PEXELS_API_KEY_2`, … are re-read from `process.env` on every request. Round-robin advances per request; on 429/401, the next key is tried.

**Image variant selection:** `pickPexelsMainImage` / `pickUnsplashMainImage` choose the best CDN variant within the `PEXELS_IMAGE_MAX_EDGE` limit. Without the limit, Pexels prefers `large2x` → `large` → `original`; Unsplash defaults to `regular` (1080px).

**Unified response shape:** all search endpoints return `{ query, count, results, provider }` where each result is a `GallerySearchResultItem` (title, image, thumbnail, url, width, height, source, stock, photographerUrl, unsplashDownloadLocation?).

In production (`NODE_ENV=production`), Express serves `dist/` with SPA fallback. In development, Vite middleware handles HMR.

### Frontend (`src/`)

**Routing:** hash-based — `#/documentation` or `#/docs` shows the Documentation page; otherwise the home/search page. No router library.

**App.tsx** — single component with all UI logic:
- Search input → `GET /api/search/combined?q=`
- Three-tier results layout: feature image (7/12 cols), secondary pair (5/12 cols), grid of remaining items
- Lightbox modal with history API integration (`pushState`/`popstate` for back-button support)
- Client-side file download via `<a>` element; Unsplash downloads call `/api/unsplash/track-download` first

**Documentation.tsx** — static content page rendered when hash matches `documentation`/`docs`.

**UI libraries:** `lucide-react` (icons), `motion` (Framer Motion animations), `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge).

**Fonts:** Inter (sans), Playfair Display (serif), JetBrains Mono (mono) — loaded via Google Fonts in `index.html`.

### Build

Vite handles React + TypeScript compilation. Path alias `@/*` maps to the repo root. `GEMINI_API_KEY` is injected at build time via Vite define. HMR can be disabled via `DISABLE_HMR=true`.
