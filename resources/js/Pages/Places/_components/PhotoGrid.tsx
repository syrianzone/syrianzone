import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { discovery, type GridPhoto } from '../_lib/discovery';

// media-query hook instead of md: utilities: the code-split css chunks each emit
// their own tailwind layer, so responsive classes lose cascade order here (see Lightbox)
function useColumns(): number {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide ? 4 : 2;
}

export function PhotoGrid(props: { active: boolean; onPhotoClick: (p: GridPhoto) => void }) {
  const { active, onPhotoClick } = props;
  const [photos, setPhotos] = useState<GridPhoto[]>([]);
  // last successfully fetched page; 0 = nothing loaded yet
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const columns = useColumns();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const fetchPage = useCallback((p: number) => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    discovery.gridPhotos(p)
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
  }, []);

  // first activation only; state survives toggling back to the map
  useEffect(() => {
    if (active && requestRef.current === 0) fetchPage(1);
  }, [active, fetchPage]);

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
      <div className="mx-auto max-w-5xl px-3 pb-8 pt-28">
        {photos.length > 0 && (
          <div style={{ columnCount: columns, columnGap: '0.5rem' }}>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPhotoClick(p)}
                className="mb-2 block w-full overflow-hidden rounded-md border border-border bg-card text-right [break-inside:avoid]"
              >
                <img
                  src={p.thumb_url}
                  alt={p.place.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full"
                />
                <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
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
