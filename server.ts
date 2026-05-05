import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';

/** 监听端口：云端可在 .env 中设置 PORT（<1024 需具备绑定特权端口权限）。 */
function listenPortFromEnv(): number {
  const raw = process.env.PORT?.trim();
  if (raw === undefined || raw === '') return 3738;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return 3738;
  return n;
}

/**
 * 应用的对外访问基准 URL（无则回退为 http://localhost:<PORT>），用于启动日志等。
 * 云端示例：APP_BASE_URL=http://18.222.221.196:3738
 */
function appPublicBaseUrl(port: number): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) return `http://localhost:${port}`;
  return raw.replace(/\/+$/, '');
}

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

/** 与 UI / GET /api/search 共用：单张检索结果（image 为可直接下载的主图 CDN URL）。 */
export type GallerySearchResultItem = {
  title: string;
  image: string;
  thumbnail: string;
  url: string;
  height: number;
  width: number;
  source: string;
};

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

type SearchOk = { ok: true; query: string; results: GallerySearchResultItem[] };
type SearchErr = {
  ok: false;
  status: number;
  body: { error: string };
};

/**
 * 执行一次与前端检索相同的 Pexels 查询（per_page、orientation、主图档位等与 GET /api/search 一致）。
 */
async function runGalleryImageSearch(query: string): Promise<SearchOk | SearchErr> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Missing search keyword (use q or keyword).' },
    };
  }

  const keys = collectPexelsApiKeys();
  if (keys.length === 0) {
    return {
      ok: false,
      status: 500,
      body: {
        error:
          'No Pexels API keys. Set PEXELS_API_KEY_1 (and optionally PEXELS_API_KEY_2, …) in .env.',
      },
    };
  }

  const startSlot = pexelsKeyRoundRobin % keys.length;
  pexelsKeyRoundRobin += 1;

  const imageMaxEdge = pexelsImageMaxEdgeFromEnv();

  for (let offset = 0; offset < keys.length; offset++) {
    const apiKey = keys[(startSlot + offset) % keys.length];

    try {
      const { data } = await axios.get<PexelsPhotosResponse>(PEXELS_SEARCH, {
        params: {
          query: trimmed,
          per_page: PEXELS_PER_PAGE,
          page: 1,
          orientation: 'landscape',
        },
        headers: {
          Authorization: apiKey,
        },
        timeout: 30_000,
      });

      const photos = data.photos ?? [];
      const results: GallerySearchResultItem[] = photos.map((photo) => {
        const main = pickPexelsMainImage(photo, imageMaxEdge);
        return {
          title:
            (photo.alt && photo.alt.trim()) ||
            `Photo by ${photo.photographer}`,
          image: main.url,
          thumbnail: photo.src.tiny || photo.src.small || photo.src.medium,
          url: photo.url,
          height: main.height,
          width: main.width,
          source: photo.photographer || 'Pexels',
        };
      });

      return { ok: true, query: trimmed, results };
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
        return {
          ok: false,
          status: 401,
          body: {
            error:
              'Invalid or unauthorized Pexels API key (all keys exhausted).',
          },
        };
      }
      return {
        ok: false,
        status: 500,
        body: { error: 'Failed to fetch images from Pexels.' },
      };
    }
  }

  return {
    ok: false,
    status: 500,
    body: { error: 'Failed to fetch images from Pexels.' },
  };
}

/** GET/POST 共用响应：results 项与前端 SearchResult 一致；image 为主图 CDN 直链（可与 UI 下载行为一致）。 */
function jsonSearchPayload(query: string, results: GallerySearchResultItem[]) {
  return {
    query,
    count: results.length,
    results,
  };
}

async function startServer() {
  const app = express();
  const PORT = listenPortFromEnv();
  const publicUrl = appPublicBaseUrl(PORT);

  app.use(express.json());

  app.get('/api/search', async (req, res) => {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }
    const out = await runGalleryImageSearch(query);
    if (!out.ok) {
      return res.status(out.status).json(out.body);
    }
    return res.json(jsonSearchPayload(out.query, out.results));
  });

  app.post('/api/search', async (req, res) => {
    const body = req.body as { q?: unknown; keyword?: unknown } | undefined;
    const qRaw =
      typeof body?.q === 'string'
        ? body.q
        : typeof body?.keyword === 'string'
          ? body.keyword
          : '';
    const out = await runGalleryImageSearch(qRaw);
    if (!out.ok) {
      return res.status(out.status).json(out.body);
    }
    return res.json(jsonSearchPayload(out.query, out.results));
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
    console.log(`Server listening on 0.0.0.0:${PORT}`);
    console.log(`Public base URL: ${publicUrl}`);
  });
}

startServer();
