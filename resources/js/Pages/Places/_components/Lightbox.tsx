import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PlacePhoto } from '../_lib/types';

export function Lightbox(props: {
  photos: PlacePhoto[];
  name: string;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { photos, name, index, open, onOpenChange } = props;
  const [current, setCurrent] = useState(index);
  const [busy, setBusy] = useState<'one' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent(Math.min(Math.max(index, 0), photos.length - 1));
      setError(null);
    }
  }, [open, index, photos.length]);

  const photo = photos[Math.min(current, photos.length - 1)];
  if (!photo) return null;

  const goPrev = () => {
    setError(null);
    setCurrent((c) => Math.max(c - 1, 0));
  };
  const goNext = () => {
    setError(null);
    setCurrent((c) => Math.min(c + 1, photos.length - 1));
  };

  // RTL reading direction: ArrowRight goes back, ArrowLeft goes forward
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goPrev();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goNext();
    }
  };

  const downloadPhoto = async (target: PlacePhoto, position: number) => {
    const response = await fetch(target.display_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // keep the Arabic name, strip only filesystem-unsafe characters
    link.download = `${name.replace(/[\\/:*?"<>|]+/g, '-')}-${position}.webp`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadCurrent = async () => {
    setBusy('one');
    setError(null);
    try {
      await downloadPhoto(photo, current + 1);
    } catch {
      setError('تعذر تحميل الصورة');
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy('all');
    setError(null);
    let failed = false;
    for (let i = 0; i < photos.length; i++) {
      try {
        await downloadPhoto(photos[i], i + 1);
      } catch {
        failed = true;
      }
    }
    if (failed) setError('تعذر تحميل الصورة');
    setBusy(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        onKeyDown={onKeyDown}
        className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 sm:rounded-none"
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div className="relative flex items-center gap-2 p-3 pe-14">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadCurrent}
            disabled={busy !== null}
          >
            <Download />
            تحميل
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadAll}
            disabled={busy !== null}
          >
            {busy === 'all' ? <Loader2 className="animate-spin" /> : <Download />}
            {busy === 'all' ? 'جارٍ التحميل' : 'تحميل الكل'}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
          <span
            dir="ltr"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
          >
            {current + 1}/{photos.length}
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="flex h-full w-full items-center justify-center [touch-action:pinch-zoom]">
            <img
              src={photo.display_url}
              alt={name}
              loading="eager"
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {photos.length > 1 && (
            <>
              {/* aria-disabled instead of disabled: a disabled button under focus
                  kills the dialog's arrow-key handler (goPrev/goNext already clamp) */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full ${current === 0 ? 'opacity-50' : ''}`}
                onClick={goPrev}
                aria-disabled={current === 0}
                aria-label="الصورة السابقة"
              >
                <ChevronRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`absolute left-3 top-1/2 -translate-y-1/2 rounded-full ${current === photos.length - 1 ? 'opacity-50' : ''}`}
                onClick={goNext}
                aria-disabled={current === photos.length - 1}
                aria-label="الصورة التالية"
              >
                <ChevronLeft />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
