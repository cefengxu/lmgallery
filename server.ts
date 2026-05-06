import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApi } from 'unsplash-js';

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

/** Advances on each Pexels 请求（/api/search/pexels）以便多 Key 轮流使用。 */
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

/** 单张作品的来源 */
export type GalleryStock = 'pexels' | 'unsplash';

/** 单次搜索响应层面的来源（合并接口为 mixed） */
export type GalleryImageProvider = GalleryStock | 'mixed';

/** Unsplash search 单页最多 30 条（官方限制）；与 PEXELS_PER_PAGE 取较小值 */
const UNSPLASH_SEARCH_PER_PAGE_CAP = 30;

/**
 * Unsplash `urls` 档位近似长边（用于与 PEXELS_IMAGE_MAX_EDGE 对齐选档）。
 * 见 https://unsplash.com/documentation#dynamically-resizable-images
 */
function pickUnsplashMainImage(
  photo: {
    width: number;
    height: number;
    urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  },
  maxEdgeLimit: number,
): { url: string; width: number; height: number } {
  const w = photo.width;
  const h = photo.height;
  const longEdge = Math.max(w, h, 1);
  const u = photo.urls;

  const noLimit =
    maxEdgeLimit === Number.POSITIVE_INFINITY ||
    maxEdgeLimit <= 0 ||
    !Number.isFinite(maxEdgeLimit);

  const fitLimited = [
    { url: u.raw, nominal: longEdge },
    { url: u.full, nominal: 2400 },
    { url: u.regular, nominal: 1080 },
    { url: u.small, nominal: 400 },
    { url: u.thumb, nominal: 200 },
  ] as const;

  if (noLimit) {
    return { url: u.regular, ...scaledDims(w, h, 1080) };
  }

  for (const { url, nominal } of fitLimited) {
    if (!url) continue;
    if (nominal <= maxEdgeLimit) {
      return { url, ...scaledDims(w, h, nominal) };
    }
  }

  return { url: u.thumb, ...scaledDims(w, h, 200) };
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

/** 与 UI / GET /api/search/pexels 共用：单张检索结果（image 为可直接下载的主图 CDN URL，须 hotlink）。 */
export type GallerySearchResultItem = {
  title: string;
  image: string;
  thumbnail: string;
  /** 作品在图库网站的页面（Unsplash / Pexels） */
  url: string;
  height: number;
  width: number;
  /** 摄影师显示名 */
  source: string;
  stock: GalleryStock;
  /** 摄影师个人页，用于「Photo by … on …」署名链到作者 */
  photographerUrl: string;
  /** 仅 Unsplash：须在用户下载时由服务端请求 trackDownload */
  unsplashDownloadLocation?: string;
};

type PexelsPhotosResponse = {
  photos?: Array<{
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url?: string;
    alt?: string;
    src: Record<string, string>;
  }>;
};

type SearchOk = {
  ok: true;
  query: string;
  results: GallerySearchResultItem[];
  provider: GalleryImageProvider;
  /** 仅合并搜索：本次分配的条数与比例模式 */
  mix?: {
    splitMode: '5:5' | '4:6';
    requestedPexels: number;
    requestedUnsplash: number;
  };
};
type SearchErr = {
  ok: false;
  status: number;
  body: { error: string };
};

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * 按总条数（PEXELS_PER_PAGE）随机选 5:5 或 4:6，并确保两端至少各 1 张（total≥2）。
 * Unsplash 请求条数不超过 UNSPLASH_SEARCH_PER_PAGE_CAP，超出部分划归 Pexels。
 */
function computeMixedSplit(total: number): {
  nPexels: number;
  nUnsplash: number;
  splitMode: '5:5' | '4:6';
} {
  const t = Math.min(80, Math.max(1, total));
  if (t <= 1) {
    const firstPexels = Math.random() < 0.5;
    return {
      nPexels: firstPexels ? 1 : 0,
      nUnsplash: firstPexels ? 0 : 1,
      splitMode: '5:5',
    };
  }

  const useEven = Math.random() < 0.5;
  let splitMode: '5:5' | '4:6';
  let nP: number;
  let nU: number;

  if (useEven) {
    splitMode = '5:5';
    nP = Math.ceil(t / 2);
    nU = t - nP;
  } else {
    splitMode = '4:6';
    const small = Math.max(1, Math.floor(t * 0.4));
    const large = t - small;
    if (Math.random() < 0.5) {
      nP = small;
      nU = large;
    } else {
      nP = large;
      nU = small;
    }
  }

  if (nP === 0) {
    nP = 1;
    nU = t - 1;
  }
  if (nU === 0) {
    nU = 1;
    nP = t - 1;
  }

  if (nU > UNSPLASH_SEARCH_PER_PAGE_CAP) {
    const overflow = nU - UNSPLASH_SEARCH_PER_PAGE_CAP;
    nU = UNSPLASH_SEARCH_PER_PAGE_CAP;
    nP = Math.min(80, nP + overflow);
  }
  if (nP > 80) {
    const overflow = nP - 80;
    nP = 80;
    nU = Math.min(UNSPLASH_SEARCH_PER_PAGE_CAP, nU + overflow);
  }

  return { nPexels: nP, nUnsplash: nU, splitMode };
}

async function runCombinedGallerySearch(query: string): Promise<SearchOk | SearchErr> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Missing search keyword (use q or keyword).' },
    };
  }

  const { nPexels, nUnsplash, splitMode } = computeMixedSplit(PEXELS_PER_PAGE);

  const pexelsP: Promise<SearchOk | SearchErr | null> =
    nPexels > 0
      ? runPexelsGallerySearch(trimmed, { perPage: nPexels })
      : Promise.resolve(null);
  const unsplashP: Promise<SearchOk | SearchErr | null> =
    nUnsplash > 0
      ? runUnsplashGallerySearch(trimmed, { perPage: nUnsplash })
      : Promise.resolve(null);

  const [pexelsOut, unsplashOut] = await Promise.all([pexelsP, unsplashP]);

  const merged: GallerySearchResultItem[] = [];
  let pexelsErr: SearchErr | null = null;
  let unsplashErr: SearchErr | null = null;

  if (pexelsOut !== null) {
    if (pexelsOut.ok === true) merged.push(...pexelsOut.results);
    else pexelsErr = pexelsOut;
  }
  if (unsplashOut !== null) {
    if (unsplashOut.ok === true) merged.push(...unsplashOut.results);
    else unsplashErr = unsplashOut;
  }

  shuffleInPlace(merged);

  if (merged.length === 0) {
    const fallback = pexelsErr ?? unsplashErr;
    if (fallback !== null) return fallback;
    return {
      ok: false,
      status: 500,
      body: { error: 'No images returned from Pexels or Unsplash.' },
    };
  }

  const onlyPexels =
    merged.length > 0 && merged.every((r) => r.stock === 'pexels');
  const onlyUnsplash =
    merged.length > 0 && merged.every((r) => r.stock === 'unsplash');
  const provider: GalleryImageProvider = onlyPexels
    ? 'pexels'
    : onlyUnsplash
      ? 'unsplash'
      : 'mixed';

  return {
    ok: true,
    query: trimmed,
    results: merged,
    provider,
    mix:
      provider === 'mixed'
        ? {
            splitMode,
            requestedPexels: nPexels,
            requestedUnsplash: nUnsplash,
          }
        : undefined,
  };
}

type PerProviderSearchOpts = { perPage?: number };

/**
 * 执行一次与前端检索相同的 Pexels 查询（per_page、orientation、主图档位等与 GET /api/search/pexels 一致）。
 */
async function runPexelsGallerySearch(
  query: string,
  opts?: PerProviderSearchOpts,
): Promise<SearchOk | SearchErr> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Missing search keyword (use q or keyword).' },
    };
  }

  const perPage = Math.min(
    80,
    Math.max(1, opts?.perPage ?? PEXELS_PER_PAGE),
  );

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
          per_page: perPage,
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
          source: photo.photographer || 'Photographer',
          stock: 'pexels',
          photographerUrl:
            (photo.photographer_url && photo.photographer_url.trim()) ||
            photo.url,
        };
      });

      return { ok: true, query: trimmed, results, provider: 'pexels' };
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

/**
 * 使用官方 unsplash-js（search.getPhotos）拉取图片；结果字段与 Pexels 路径一致。
 * Access Key：https://unsplash.com/oauth/applications
 */
async function runUnsplashGallerySearch(
  query: string,
  opts?: PerProviderSearchOpts,
): Promise<SearchOk | SearchErr> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Missing search keyword (use q or keyword).' },
    };
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    return {
      ok: false,
      status: 500,
      body: {
        error:
          'UNSPLASH_ACCESS_KEY is not set. Create an app at https://unsplash.com/oauth/applications',
      },
    };
  }

  const unsplash = createApi({ accessKey });
  const imageMaxEdge = pexelsImageMaxEdgeFromEnv();
  const perPage = Math.min(
    UNSPLASH_SEARCH_PER_PAGE_CAP,
    Math.max(1, opts?.perPage ?? PEXELS_PER_PAGE),
  );

  try {
    const result = await unsplash.search.getPhotos(
      {
        query: trimmed,
        page: 1,
        perPage,
        orientation: 'landscape',
      },
      { signal: AbortSignal.timeout(30_000) },
    );

    if (result.type === 'error') {
      const msg = result.errors[0] ?? 'Unsplash search failed';
      const status =
        result.status === 401 || result.status === 403 ? 401 : 500;
      return { ok: false, status, body: { error: msg } };
    }

    const photos = result.response.results;
    const results: GallerySearchResultItem[] = photos.map((photo) => {
      const main = pickUnsplashMainImage(photo, imageMaxEdge);
      const title =
        (photo.alt_description && photo.alt_description.trim()) ||
        (photo.description && photo.description.trim()) ||
        `Photo by ${photo.user.name}`;
      return {
        title,
        image: main.url,
        thumbnail: photo.urls.thumb || photo.urls.small,
        url: photo.links.html,
        height: main.height,
        width: main.width,
        source: photo.user.name || 'Photographer',
        stock: 'unsplash',
        photographerUrl: photo.user.links.html,
        unsplashDownloadLocation: photo.links.download_location,
      };
    });

    return { ok: true, query: trimmed, results, provider: 'unsplash' };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        body: { error: 'Unsplash request timed out.' },
      };
    }
    console.error('Unsplash search error:', err.message);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to fetch images from Unsplash.' },
    };
  }
}

function parseSearchKeywordBody(
  body: { q?: unknown; keyword?: unknown } | undefined,
): string {
  if (typeof body?.q === 'string') return body.q;
  if (typeof body?.keyword === 'string') return body.keyword;
  return '';
}

/** GET/POST 共用响应：results 项与前端 SearchResult 一致；image 为主图 CDN 直链（可与 UI 下载行为一致）。 */
function jsonSearchPayload(
  query: string,
  results: GallerySearchResultItem[],
  provider: GalleryImageProvider,
  mix?: SearchOk['mix'],
) {
  return {
    query,
    count: results.length,
    results,
    provider,
    ...(mix ? { mix } : {}),
  };
}

async function startServer() {
  const app = express();
  const PORT = listenPortFromEnv();
  const publicUrl = appPublicBaseUrl(PORT);

  app.use(express.json());

  /** Pexels：GET/POST /api/search/pexels，仅查询 Pexels */
  app.get('/api/search/pexels', async (req, res) => {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }
    const out = await runPexelsGallerySearch(query);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  app.post('/api/search/pexels', async (req, res) => {
    const qRaw = parseSearchKeywordBody(
      req.body as { q?: unknown; keyword?: unknown } | undefined,
    );
    const out = await runPexelsGallerySearch(qRaw);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  /** 合并：并行请求 Pexels + Unsplash，条数按随机 5:5 或 4:6 分配（总数来自 PEXELS_PER_PAGE），结果打乱混合 */
  app.get('/api/search/combined', async (req, res) => {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }
    const out = await runCombinedGallerySearch(query);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  app.post('/api/search/combined', async (req, res) => {
    const qRaw = parseSearchKeywordBody(
      req.body as { q?: unknown; keyword?: unknown } | undefined,
    );
    const out = await runCombinedGallerySearch(qRaw);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  /** Unsplash：GET/POST 与 /api/search/pexels 参数形态一致，仅数据源为 Unsplash */
  app.get('/api/search/unsplash', async (req, res) => {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter q' });
    }
    const out = await runUnsplashGallerySearch(query);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  app.post('/api/search/unsplash', async (req, res) => {
    const qRaw = parseSearchKeywordBody(
      req.body as { q?: unknown; keyword?: unknown } | undefined,
    );
    const out = await runUnsplashGallerySearch(qRaw);
    if (out.ok === false) {
      return res.status(out.status).json(out.body);
    }
    return res.json(
      jsonSearchPayload(out.query, out.results, out.provider, out.mix),
    );
  });

  /**
   * Unsplash：用户实际下载／使用图片时触发（对应 unsplash-js photos.trackDownload）。
   * Body: { "downloadLocation": "<photo.links.download_location>" }
   */
  app.post('/api/unsplash/track-download', async (req, res) => {
    const raw = (req.body as { downloadLocation?: unknown } | undefined)
      ?.downloadLocation;
    const downloadLocation =
      typeof raw === 'string' ? raw.trim() : '';
    if (!downloadLocation) {
      return res.status(400).json({ error: 'Missing downloadLocation' });
    }
    const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
    if (!accessKey) {
      return res.status(500).json({ error: 'Unsplash is not configured.' });
    }
    const unsplash = createApi({ accessKey });
    try {
      const result = await unsplash.photos.trackDownload(
        { downloadLocation },
        { signal: AbortSignal.timeout(15_000) },
      );
      if (result.type === 'error') {
        const msg = result.errors[0] ?? 'Unsplash trackDownload failed';
        return res.status(502).json({ error: msg });
      }
      return res.status(204).send();
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error('[unsplash] trackDownload:', err.message);
      return res.status(502).json({ error: 'Unsplash trackDownload failed.' });
    }
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
