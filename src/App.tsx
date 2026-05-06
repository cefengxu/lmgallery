import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, ExternalLink, Image as ImageIcon, Loader2, Compass, MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

type GalleryStock = 'pexels' | 'unsplash';

/** 本次搜索响应来源（合并 Lookups 为 mixed） */
type GalleryImageProvider = GalleryStock | 'mixed';

interface SearchResult {
  title: string;
  image: string;
  thumbnail: string;
  url: string;
  height: number;
  width: number;
  source: string;
  stock: GalleryStock;
  photographerUrl: string;
  unsplashDownloadLocation?: string;
}

/** 与次要卡片（第 2、3 张）一致：作者署名行（含内链样式） */
const sourceAttributionClass =
  'text-[11px] text-[#A5A5A5] italic mt-1 leading-tight';

const attributionLinkClass =
  'underline decoration-[#A5A5A5]/35 underline-offset-2 hover:text-[#1A1A1A] hover:decoration-[#1A1A1A]/35';

function PhotoAttribution({
  item,
  className,
}: {
  item: SearchResult;
  className?: string;
}) {
  const brand =
    item.stock === 'unsplash'
      ? {
          label: 'Unsplash',
          href: 'https://unsplash.com/?utm_source=sugo_gallery&utm_medium=referral',
        }
      : {
          label: 'Pexels',
          href: 'https://www.pexels.com?utm_source=sugo_gallery&utm_medium=referral',
        };

  return (
    <p className={cn(sourceAttributionClass, className)}>
      Photo by{' '}
      <a
        href={item.photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={attributionLinkClass}
      >
        {item.source}
      </a>{' '}
      on{' '}
      <a
        href={brand.href}
        target="_blank"
        rel="noopener noreferrer"
        className={attributionLinkClass}
      >
        {brand.label}
      </a>
    </p>
  );
}

const LIGHTBOX_HISTORY_STATE = { galleryLightbox: true as const };

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SearchResult | null>(null);
  const [imageProvider, setImageProvider] =
    useState<GalleryImageProvider>('mixed');
  /** 已为当前打开的灯箱 push 过一条 history，关闭时应 history.back 与浏览器后退一致 */
  const lightboxHistoryPushedRef = useRef(false);

  const closeLightbox = useCallback(() => {
    if (lightboxHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setSelectedImage(null);
  }, []);

  /** 仅在「从关闭到打开」时压入 history，换图不重复 push；与浏览器后退、关闭按钮共用一条栈记录 */
  const openOrSwitchPreview = useCallback((item: SearchResult) => {
    setSelectedImage((prev) => {
      if (prev == null) {
        window.history.pushState(LIGHTBOX_HISTORY_STATE, '');
        lightboxHistoryPushedRef.current = true;
      }
      return item;
    });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      lightboxHistoryPushedRef.current = false;
      setSelectedImage(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const searchImages = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/search/combined?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Search failed.');
        setResults([]);
        return;
      }
      if (Array.isArray(data.results) && data.results.length > 0) {
        setResults(data.results);
        setImageProvider(
          data.provider === 'unsplash'
            ? 'unsplash'
            : data.provider === 'mixed'
              ? 'mixed'
              : 'pexels',
        );
      } else {
        setError('No results found.');
        setResults([]);
      }
    } catch (err) {
      setError('Failed to fetch images. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchImages(query);
  };

  const downloadAsset = async (item: SearchResult, filename: string) => {
    if (item.unsplashDownloadLocation) {
      try {
        await fetch('/api/unsplash/track-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            downloadLocation: item.unsplashDownloadLocation,
          }),
        });
      } catch {
        /* 仍尝试打开图片链接 */
      }
    }
    const link = document.createElement('a');
    link.href = item.image;
    link.setAttribute('download', filename);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    searchImages('Switzerland Alps landscape');
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A] selection:text-white p-6 md:p-12 overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto flex flex-col min-h-screen">
        
        {/* Editorial Header */}
        <header className="flex justify-between items-baseline border-b border-[#1A1A1A]/10 pb-6 mb-12">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#A5A5A5] mb-1">Landscape Visuals</span>
            <h1 className="text-4xl font-serif italic tracking-tight">Sugo Gallery</h1>
          </div>
          <div className="hidden md:flex gap-8 text-[11px] uppercase tracking-widest font-semibold">
            <span className="border-b border-[#1A1A1A] cursor-pointer">Discovery</span>
            <span className="text-[#A5A5A5] hover:text-[#1A1A1A] transition-colors cursor-pointer">Archive</span>
            <span className="text-[#A5A5A5] hover:text-[#1A1A1A] transition-colors cursor-pointer">Documentation</span>
          </div>
        </header>

        {/* Main Search Area */}
        <div className="flex flex-col items-center mb-16 px-4">
          <form onSubmit={handleSearch} className="w-full max-w-2xl relative">
            <span className="absolute -top-7 left-0 text-[10px] uppercase font-bold tracking-tighter opacity-40 italic">
              {query ? `Refine discovery: "${query}"` : "Enter destination keyword — Powered by DuckDuckGo"}
            </span>
            <div className="flex border-b-2 border-[#1A1A1A] pb-2 group focus-within:border-[#F27D26] transition-colors">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Santorini Sunset Oia"
                className="bg-transparent text-2xl font-serif outline-none flex-grow placeholder:opacity-20 placeholder:italic transition-all"
              />
              <button 
                type="submit"
                disabled={loading}
                className="px-6 py-1 text-[11px] uppercase tracking-widest font-bold bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
              >
                {loading ? "Discovering..." : "Fetch Images"}
              </button>
            </div>
          </form>
        </div>

        {/* Editorial Content Layout */}
        <main className="flex-grow">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-[10px] uppercase tracking-[0.4em] font-bold animate-pulse text-[#A5A5A5]">
                Scanning Global Assets...
              </div>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <p className="font-serif italic text-xl">{error}</p>
              <button 
                onClick={() => searchImages(query || 'Switzerland Alps')}
                className="text-[11px] font-bold underline uppercase tracking-widest"
              >
                Retry Search
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Feature Selection (First element) */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-1 md:col-span-7 h-[400px] md:h-[600px] relative group cursor-pointer overflow-hidden bg-[#EAE8E4]"
                onClick={() => openOrSwitchPreview(results[0])}
              >
                <img 
                  src={results[0].image} 
                  alt={results[0].title}
                  className="w-full h-full object-cover transition-all duration-1000 grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105"
                />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end bg-white/95 p-6 backdrop-blur-sm border border-[#1A1A1A]/5 shadow-xl">
                  <div className="max-w-[70%]">
                    <h3 className="font-serif text-2xl italic line-clamp-1">{results[0].title}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-[#A5A5A5] mt-2 font-mono">
                      {results[0].width} × {results[0].height} • JPEG
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PhotoAttribution item={results[0]} />
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); void downloadAsset(results[0], 'Sugo-featured.jpg'); }}
                    className="text-[11px] font-bold underline uppercase tracking-widest hover:text-[#F27D26] transition-colors"
                  >
                    Download Link
                  </button>
                </div>
              </motion.div>

              {/* Secondary Results (Next 2-3 items) */}
              <div className="col-span-1 md:col-span-5 flex flex-col gap-8">
                {results.slice(1, 3).map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="flex-grow flex gap-6 pb-8 border-b border-[#1A1A1A]/10 group cursor-pointer"
                    onClick={() => openOrSwitchPreview(item)}
                  >
                    <div className="w-1/3 aspect-square bg-[#EAE8E4] overflow-hidden">
                      <img 
                        src={item.thumbnail || item.image} 
                        alt={item.title} 
                        className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700 hover:scale-110"
                      />
                    </div>
                    <div className="w-2/3 flex flex-col justify-between py-1">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-bold bg-[#1A1A1A] text-white px-2 py-0.5">Asset {idx + 2}</span>
                        <h4 className="font-serif text-lg mt-3 group-hover:italic transition-all">{item.title}</h4>
                        <div onClick={(e) => e.stopPropagation()}>
                          <PhotoAttribution item={item} className="line-clamp-2" />
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openOrSwitchPreview(item); }}
                        className="w-fit text-[10px] uppercase font-bold border border-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-all mt-4"
                      >
                        Get Asset
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Grid for remaining results */}
              <div className="col-span-1 md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-8 mt-4">
                 {results.slice(3).map((item, idx) => (
                   <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    className="group cursor-pointer"
                    onClick={() => openOrSwitchPreview(item)}
                   >
                     <div className="aspect-[4/5] bg-[#EAE8E4] overflow-hidden mb-4 rounded-sm">
                       <img 
                        src={item.thumbnail || item.image} 
                        alt={item.title} 
                        className="w-full h-full object-cover grayscale-[0.6] group-hover:grayscale-0 transition-all duration-700"
                        loading="lazy"
                       />
                     </div>
                     <h5 className="font-serif italic text-sm line-clamp-1">{item.title}</h5>
                     <div onClick={(e) => e.stopPropagation()}>
                       <PhotoAttribution item={item} className="line-clamp-2" />
                     </div>
                     <div className="flex justify-between items-center mt-2">
                        <span className="text-[9px] text-[#A5A5A5] font-mono">{item.width}PX</span>
                        <Download 
                          className="w-3 h-3 text-[#A5A5A5] hover:text-[#1A1A1A] cursor-pointer transition-colors"
                          onClick={(e) => { e.stopPropagation(); void downloadAsset(item, `asset-${idx}.jpg`); }}
                        />
                     </div>
                   </motion.div>
                 ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center opacity-20 italic font-serif text-xl border-2 border-dashed border-[#1A1A1A]/10">
              Standing by for keyword entry
            </div>
          )}
        </main>

        {/* Editorial Footer */}
        <footer className="mt-20 pt-8 border-t border-[#1A1A1A]/10 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] pb-12 text-[#A5A5A5]">
          <div className="flex gap-8 mb-6 md:mb-0">
            <span className="text-[#1A1A1A]">Session ID: ARCH-{Date.now().toString().slice(-4)}</span>
            <div className="hidden sm:block">Assets in current view: {results.length}</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] shadow-[0_0_8px_#00FF00]"></div>
              <span className="text-[#1A1A1A]">
                {imageProvider === 'mixed'
                  ? 'Photos via Pexels & Unsplash'
                  : imageProvider === 'unsplash'
                    ? 'Photos via Unsplash'
                    : 'Photos via Pexels'}
              </span>
            </div>
            <div className="w-[1px] h-3 bg-[#A5A5A5]/20"></div>
            <span className="hover:text-[#1A1A1A] cursor-pointer transition-colors">Privacy Secured</span>
          </div>
        </footer>
      </div>

      {/* Editorial Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#FDFCFB]/98 backdrop-blur-md flex items-center justify-center p-6 md:p-20"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-12 right-12 text-[#1A1A1A] hover:opacity-50 transition-all"
            >
              <X className="w-10 h-10 stroke-[1.5]" />
            </button>

            <motion.div
              layoutId={selectedImage.image}
              className="max-w-[1240px] w-full flex flex-col md:flex-row gap-12 items-center md:items-stretch"
            >
              <div className="flex-grow flex items-center justify-center bg-[#EAE8E4] p-4 md:p-8 rounded-sm shadow-2xl relative overflow-hidden">
                <img
                  src={selectedImage.image}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[75vh] object-contain shadow-2xl transition-transform cursor-zoom-in"
                />
              </div>

              <div className="w-full md:w-[320px] flex flex-col justify-center gap-10">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#A5A5A5] mb-4">Metadata 04 // Asset</div>
                  <h3 className="text-3xl font-serif italic tracking-tight leading-tight mb-4">
                    {selectedImage.title}
                  </h3>
                  <div className="flex flex-col gap-2 font-mono text-[11px] text-[#A5A5A5]">
                    <p>RES: {selectedImage.width} × {selectedImage.height} PX</p>
                  </div>
                  <PhotoAttribution item={selectedImage} className="!mt-0" />
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      void downloadAsset(
                        selectedImage,
                        selectedImage.title.slice(0, 20) + '.jpg',
                      )
                    }
                    className="w-full py-4 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-[0.25em] font-bold hover:bg-[#333] transition-all flex items-center justify-center gap-3"
                  >
                    <Download className="w-4 h-4" />
                    Download Asset
                  </button>
                  <a
                    href={selectedImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 border-2 border-[#1A1A1A] text-[#1A1A1A] text-[11px] uppercase tracking-[0.25em] font-bold hover:bg-[#1A1A1A] hover:text-white transition-all flex items-center justify-center gap-3"
                  >
                    Source Document
                  </a>
                </div>

                <div className="mt-auto opacity-50 text-[9px] uppercase tracking-widest leading-relaxed">
                  Images are hotlinked from Pexels or Unsplash per search. Photographer and platform are credited above; use is subject to each provider&apos;s license and API guidelines.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
