import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, extractError } from '../_lib/api';
import type { HotelDetail } from '../_lib/types';

export function HotelDetailView(props: { hotelId: number; onClose: () => void }) {
  const { hotelId, onClose } = props;
  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setHotel(null);
    setError(null);
    setImgIdx(0);
    api.getHotel(hotelId)
      .then((h) => { if (!cancelled) setHotel(h); })
      .catch((e) => { if (!cancelled) setError(extractError(e)); });
    return () => { cancelled = true; };
  }, [hotelId]);

  const images = hotel?.images ?? [];
  const hasMultipleImages = images.length > 1;

  const rawDescription = hotel?.description_ar || hotel?.description || '';

  return (
    <div dir="rtl" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="رجوع">
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="truncate font-medium text-foreground">{hotel?.name_ar ?? hotel?.name ?? 'تفاصيل الفندق'}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!hotel && !error && (
          <div className="animate-pulse space-y-3">
            <div className="h-52 rounded-md bg-accent/50" />
            <div className="h-5 w-2/3 rounded bg-accent/50" />
            <div className="h-4 w-full rounded bg-accent/50" />
          </div>
        )}
        {hotel && (
          <>
            {/* Image carousel */}
            {images.length > 0 && (
              <div className="relative overflow-hidden rounded-md">
                <img
                  src={images[imgIdx]}
                  alt={hotel.name}
                  className="h-52 w-full object-cover sm:h-64"
                />
                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImgIdx((i) => (i === 0 ? images.length - 1 : i - 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-xs text-white"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setImgIdx((i) => (i === images.length - 1 ? 0 : i + 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-xs text-white"
                    >
                      ›
                    </button>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                      {imgIdx + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Name + stars */}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{hotel.name_ar ?? hotel.name}</h2>
              {hotel.name_ar && <p className="text-sm text-muted-foreground">{hotel.name}</p>}
            </div>

            {/* Star rating */}
            {hotel.star_rating && (
              <div className="flex items-center gap-1">
                {Array.from({ length: hotel.star_rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="mr-1 text-xs text-muted-foreground">{hotel.star_rating} نجوم</span>
              </div>
            )}

            {/* Description (truncated) */}
            {rawDescription && (
              <div className="space-y-1">
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {rawDescription}
                </p>
              </div>
            )}
            <a
              href={hotel.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              اقرأ المزيد على HalaSyria
            </a>
          </>
        )}
      </div>

      {/* Footer */}
      {hotel && (
        <div className="border-t border-border p-3">
          <a
            href={hotel.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/50"
          >
            <ExternalLink className="h-4 w-4" />
            <span>بيانات من HalaSyria</span>
          </a>
        </div>
      )}
    </div>
  );
}
