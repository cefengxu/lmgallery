# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Express + Vite (tsx server.ts) on PORT (default 3738)
npm run build        # Production build → dist/
npm run preview      # Serve production build via Vite only (not Express)
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run clean        # Remove dist/
```

No test framework is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```
PORT=3738                          # server port (default 3738; binds 0.0.0.0)
APP_BASE_URL=                      # optional public URL for startup log (no trailing slash)

UNSPLASH_ACCESS_KEY=<required>     # combined/Unsplash search needs this
UNSPLASH_APPLICATION_ID=           # optional (OAuth / dashboard; search does not use it)
UNSPLASH_SECRET_KEY=               # optional (same)

PEXELS_API_KEY_1=<required>        # at least one numbered key required
PEXELS_API_KEY_2=<optional>        # _2, _3, … round-robin; re-read from env per request
SEARCH_PEXELS_PER_PAGE=3           # /api/search/pexels only (1–80)
SEARCH_UNSPLASH_PER_PAGE=3         # /api/search/unsplash only (1–30)
SEARCH_COMBINED_PER_PAGE=3         # /api/search/combined total before split (1–80)
PEXELS_IMAGE_MAX_EDGE=             # optional max long-edge px for CDN variant pick

ALLOWED_HOSTS=true                 # optional; Vite allowedHosts: true (nginx reverse-proxy)
GEMINI_API_KEY=                    # optional; injected at build time via Vite define
DISABLE_HMR=true                   # optional; disable Vite HMR (e.g. AI Studio)
```

`GEMINI_API_KEY` / `DISABLE_HMR` are read by `vite.config.ts` (not listed in `.env.example`).

## Key paths

```
server.ts              # Express API + Vite middleware / static SPA
vite.config.ts         # React, Tailwind v4 plugin, path alias, HMR / hosts
index.html             # HTML shell + Google Fonts
src/main.tsx           # React entry
src/App.tsx            # Home search UI, lightbox, hash routing shell
src/Documentation.tsx  # Static docs page (#/documentation | #/docs)
src/lib/utils.ts       # cn() (clsx + tailwind-merge)
src/index.css          # Global / Tailwind entry
.env.example           # Env template
docs/                  # Task notes (optional; not part of the app runtime)
```

Do not maintain a full tree here — only paths that matter for orientation.

## Architecture

**Full-stack SPA** — React frontend + Express backend, both served from one Node process (`npm run dev` → `tsx server.ts`).

### Backend (`server.ts`)

Single-file Express server. Key API routes:

| Route | Method | Description |
|---|---|---|
| `/api/search/pexels` | GET/POST | Pexels-only (`?q=` or body `{q, keyword}`) |
| `/api/search/unsplash` | GET/POST | Unsplash-only |
| `/api/search/combined` | GET/POST | Parallel Pexels + Unsplash — used by the SPA |
| `/api/unsplash/track-download` | POST | Unsplash download tracking (`{downloadLocation}`) |

**Combined search:** `SEARCH_COMBINED_PER_PAGE` total is randomly split 5:5 or 4:6 between Pexels and Unsplash; results merged and shuffled. Does not use the single-source per-page vars. Unsplash share capped at 30 (API limit). Response may include `mix` (`splitMode`, requested counts).


**Pexels key rotation:** `PEXELS_API_KEY_1`, `_2`, … collected from `process.env` each request (numeric suffix order). Round-robin advances per request; on 429/401 the next key is tried.

**Image variant selection:** `pickPexelsMainImage` / `pickUnsplashMainImage` pick the best CDN URL within `PEXELS_IMAGE_MAX_EDGE`. Without the limit: Pexels prefers `large2x` → `large` → `original`; Unsplash defaults toward `regular` (~1080px).

**Types / response shape:** searches return `{ query, count, results, provider }` (and optional `mix`). Each item is `GallerySearchResultItem`: `title`, `image`, `thumbnail`, `url`, `width`, `height`, `source`, `stock` (`pexels` \| `unsplash`), `photographerUrl`, optional `unsplashDownloadLocation`. Provider is `GalleryImageProvider` (`pexels` \| `unsplash` \| `mixed`).

In production (`NODE_ENV=production`), Express serves `dist/` with SPA fallback. In development, Vite middleware handles HMR.

### Frontend (`src/`)

**Routing:** hash-based — `#/documentation` or `#/docs` → Documentation; otherwise home/search. No router library.

**App.tsx** — main UI:
- Search → `GET /api/search/combined?q=`
- Three-tier layout: feature image (7/12), secondary pair (5/12), grid of the rest
- Lightbox with history API (`pushState` / `popstate`) for back-button close
- Client download via `<a>`; Unsplash downloads POST `/api/unsplash/track-download` first

**Documentation.tsx** — static content for the docs hash route.

**UI:** `lucide-react`, `motion` (Framer Motion), `cn()` from `src/lib/utils.ts`. Styling: Tailwind CSS v4 via `@tailwindcss/vite`.

**Fonts:** Inter (sans), Playfair Display (serif), JetBrains Mono (mono) — Google Fonts in `index.html`.

### Build

Vite compiles React + TypeScript. Alias `@/*` → repo root. `GEMINI_API_KEY` injected via Vite `define`. HMR off when `DISABLE_HMR=true`. `ALLOWED_HOSTS=true` sets Vite `server.allowedHosts: true` for reverse-proxy Host headers.
