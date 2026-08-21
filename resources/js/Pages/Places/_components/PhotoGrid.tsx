import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { discovery, type GridPhoto } from '../_lib/discovery';

// media-query hook instead of md: utilities: the code-split css chunks each emit
// their own tailwind layer, so responsive classes lose cascade order here (see Lightbox)
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function PhotoGrid(props: {
  active: boolean;
  guideId: number | null;
  bannerActive: boolean;
  onPhotoClick: (p: GridPhoto) => void;
}) {
  const { active, guideId, bannerActive, onPhotoClick } = props;
  const [photos, setPhotos] = useState<GridPhoto[]>([]);
  // last successfully fetched page; 0 = nothing loaded yet
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const columns = useMedia('(min-width: 768px)') ? 4 : 2;
  // captions hide-until-hover only where hover exists: a wide iPad has no hover,
  // and tapping a tile opens the lightbox, so a width branch would never reveal them
  const hoverable = useMedia('(hover: hover) and (pointer: fine)');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const fetchPage = useCallback((p: number) => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    discovery.gridPhotos(p, guideId ?? undefined)
      .then((res) => {
        if (id !== requestRef.current) return;
        setPhotos((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
        setPage(res.current_page);
        setLastPage(res.last_page);
      })
      .catch(() => {
        if (id === requestRef.current) setError(true);
      })
      .finally(() => {
        if (id === requestRef.current) setLoading(false);
      });
  }, [guideId]);

  // first activation only; state survives toggling back to the map
  useEffect(() => {
    if (active && requestRef.current === 0) fetchPage(1);
  }, [active, fetchPage]);

  // a guide filter change refetches from page 1 (fetchPage identity changes with guideId)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setPhotos([]);
    setPage(0);
    setLastPage(1);
    if (active) fetchPage(1);
  }, [guideId]);

  useEffect(() => {
    if (!active || loading || error || page === 0 || page >= lastPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchPage(page + 1);
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, loading, error, page, lastPage, fetchPage]);

  if (!active) return null;

  return (
    <div dir="rtl" className="absolute inset-0 z-10 overflow-y-auto bg-background">
      {/* pt-16 clears the slim top row; a guide/notice banner stacks ~34px more below it */}
      <div className={'mx-auto max-w-5xl px-3 pb-8 ' + (bannerActive ? 'pt-28' : 'pt-16')}>
        {photos.length > 0 && (
          <div style={{ columnCount: columns, columnGap: '0.75rem' }}>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPhotoClick(p)}
                className="group relative mb-3 block w-full overflow-hidden rounded-xl text-right [break-inside:avoid]"
              >
                <img
                  src={p.thumb_url}
                  alt={p.place.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full"
                />
                <span
                  aria-hidden
                  className={
                    'pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6 text-xs text-white' +
                    (hoverable ? ' opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100' : '')
                  }
                >
                  {p.place.name}
                </span>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm text-destructive">تعذر تحميل الصور</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(page + 1)}>
              إعادة المحاولة
            </Button>
          </div>
        )}
        {!loading && !error && page > 0 && photos.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد صور بعد</p>
        )}
        <div ref={sentinelRef} className="h-px" />
      </div>
    </div>
  );
}
