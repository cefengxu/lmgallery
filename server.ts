import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';

/** Env keys must be named PEXELS_API_KEY_1, PEXELS_API_KEY_2, … (numeric suffix). Re-read on every request. */
function collectPexelsApiKeys(): string[] {
  const entries: { order: number; key: string }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    const m = /^PEXELS_API_KEY_(\d+)$/.exec(name);
    if (!m || value == null) continue;
    const key = String(value).trim();
    if (!key) continue;
    entries.push({ order: Number.parseInt(m[1], 10), key });
  }
  entries.sort((a, b) => a.order - b.order);
  return entries.map((e) => e.key);
}

/** Advances on each /api/search so keys are used in rotation. */
let pexelsKeyRoundRobin = 0;

function pexelsPerPageFromEnv(): number {
  const parsed = parseInt(process.env.PEXELS_PER_PAGE ?? '3', 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(80, Math.max(1, parsed));
}

const PEXELS_PER_PAGE = pexelsPerPageFromEnv();

/**
 * 下载/展示主图的最长边上限（像素）。不设或空 = 不强制压缩档位，优先 large2x → large → original。
 * Pexels 只提供离散尺寸的 URL，实际文件会长边约 ≤ 对应档位（见官方文档 photo src）。
 */
function pexelsImageMaxEdgeFromEnv(): number {
  const raw = process.env.PEXELS_IMAGE_MAX_EDGE?.trim();
  if (raw === undefined || raw === '') return Number.POSITIVE_INFINITY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(parsed, 8192);
}

/** 按原图比例近似缩放后的宽高（与所选 CDN 档位对应）。 */
function scaledDims(
  width: number,
  height: number,
  variantLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height, 1);
  const scale = Math.min(1, variantLongEdge / longEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 选择主图 URL：在限制内选尽可能清晰的档位（Pexels 离散档位）。
 */
function pickPexelsMainImage(
  photo: { width: number; height: number; src: Record<string, string> },
  maxEdgeLimit: number,
): { url: string; width: number; height: number } {
  const src = photo.src ?? {};
  const w = photo.width;
  const h = photo.height;
  const longEdge = Math.max(w, h, 1);

  const noLimit =
    maxEdgeLimit === Number.POSITIVE_INFINITY ||
    maxEdgeLimit <= 0 ||
    !Number.isFinite(maxEdgeLimit);

  const preferWhenUnlimited = [
    { key: 'large2x', nominal: 1280 },
    { key: 'large', nominal: 650 },
    { key: 'original', nominal: longEdge },
    { key: 'landscape', nominal: 1200 },
    { key: 'medium', nominal: 350 },
    { key: 'small', nominal: 130 },
    { key: 'tiny', nominal: 35 },
  ] as const;

  if (noLimit) {
    for (const { key, nominal } of preferWhenUnlimited) {
      const url = src[key];
      if (!url) continue;
      return { url, ...scaledDims(w, h, nominal) };
    }
  } else {
    const fitLimited = [
      { key: 'original', nominal: longEdge },
      { key: 'large2x', nominal: 1280 },
      { key: 'landscape', nominal: 1200 },
      { key: 'large', nominal: 650 },
      { key: 'medium', nominal: 350 },
      { key: 'small', nominal: 130 },
      { key: 'tiny', nominal: 35 },
    ] as const;
    for (const { key, nominal } of fitLimited) {
      const url = src[key];
      if (!url) continue;
      if (nominal <= maxEdgeLimit) {
        return { url, ...scaledDims(w, h, nominal) };
      }
    }
  }

  const fallback =
    src.tiny ||
    src.small ||
    src.medium ||
    src.large ||
    src.large2x ||
    src.original ||
    src.landscape ||
    '';
  return { url: fallback, width: w, height: h };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get('/api/search', async (req, res) => {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }

    const keys = collectPexelsApiKeys();
    if (keys.length === 0) {
      return res.status(500).json({
        error:
          'No Pexels API keys. Set PEXELS_API_KEY_1 (and optionally PEXELS_API_KEY_2, …) in .env.',
      });
    }

    const startSlot = pexelsKeyRoundRobin % keys.length;
    pexelsKeyRoundRobin += 1;

    const imageMaxEdge = pexelsImageMaxEdgeFromEnv();

    type PexelsPhotosResponse = {
      photos?: Array<{
        id: number;
        width: number;
        height: number;
        url: string;
        photographer: string;
        alt?: string;
        src: Record<string, string>;
      }>;
    };

    for (let offset = 0; offset < keys.length; offset++) {
      const apiKey = keys[(startSlot + offset) % keys.length];

      try {
        const { data } = await axios.get<PexelsPhotosResponse>(PEXELS_SEARCH, {
          params: {
            query,
            per_page: PEXELS_PER_PAGE,
            page: 1,
            // https://www.pexels.com/api/documentation/#photos-search — landscape | portrait | square
            orientation: 'landscape',
          },
          headers: {
            Authorization: apiKey,
          },
          timeout: 30_000,
        });

        const photos = data.photos ?? [];
        const images = photos.map((photo) => {
          const main = pickPexelsMainImage(photo, imageMaxEdge);
          return {
            title:
              (photo.alt && photo.alt.trim()) ||
              `Photo by ${photo.photographer}`,
            image: main.url,
            thumbnail:
              photo.src.tiny || photo.src.small || photo.src.medium,
            url: photo.url,
            height: main.height,
            width: main.width,
            source: photo.photographer || 'Pexels',
          };
        });

        return res.json({ results: images });
      } catch (error: unknown) {
        const err = error as {
          message?: string;
          response?: { status?: number; data?: { error?: string } };
        };
        const status = err.response?.status;
        const retryWithNextKey = status === 429 || status === 401;
        if (retryWithNextKey && offset < keys.length - 1) {
          console.warn(
            `[pexels] HTTP ${status} with key slot ${((startSlot + offset) % keys.length) + 1}, trying next key…`,
          );
          continue;
        }

        const detail =
          err.response?.data?.error || err.message || 'Request failed';
        console.error('Search error:', detail);

        if (status === 401) {
          return res.status(401).json({
            error: 'Invalid or unauthorized Pexels API key (all keys exhausted).',
          });
        }
        return res.status(500).json({ error: 'Failed to fetch images from Pexels.' });
      }
    }

    return res.status(500).json({ error: 'Failed to fetch images from Pexels.' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
