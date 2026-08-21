import { useEffect, useState } from 'react';
import { zipSync } from 'fflate';
import { ChevronLeft, ChevronRight, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PlacePhoto } from '../_lib/types';

// media-query hook instead of sm: utilities: the code-split css chunks each emit
// their own tailwind layer, so responsive show/hide classes lose cascade order here
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const narrow = useIsNarrow();

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

  // keep the Arabic name, strip only filesystem-unsafe characters
  const safeName = name.replace(/[\\/:*?"<>|]+/g, '-');

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPhoto = async (target: PlacePhoto, position: number) => {
    const response = await fetch(target.display_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    saveBlob(await response.blob(), `${safeName}-${position}.webp`);
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
    setProgress({ done: 0, total: photos.length });
    const entries: Record<string, Uint8Array> = {};
    let failed = 0;
    for (let i = 0; i < photos.length; i++) {
      try {
        const res = await fetch(photos[i].display_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        entries[`${safeName}-${i + 1}.webp`] = new Uint8Array(await res.arrayBuffer());
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: photos.length });
    }
    if (Object.keys(entries).length > 0) {
      // webp is already compressed: store, don't deflate
      const zipped = zipSync(entries, { level: 0 });
      saveBlob(new Blob([zipped], { type: 'application/zip' }), `${safeName}.zip`);
    }
    if (failed > 0) setError(failed === photos.length ? 'تعذر تحميل الصورة' : 'تعذر تحميل بعض الصور');
    setBusy(null);
    setProgress(null);
  };

  const downloadButtons = (buttonClass: string) => (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={buttonClass}
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
        className={buttonClass}
        onClick={downloadAll}
        disabled={busy !== null}
      >
        {busy === 'all' ? <Loader2 className="animate-spin" /> : <Download />}
        {busy === 'all' ? 'جارٍ التحميل' : 'تحميل الكل'}
        {busy === 'all' && progress && (
          <span dir="ltr" className="tabular-nums">
            {progress.done}/{progress.total}
          </span>
        )}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        onKeyDown={onKeyDown}
        className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 sm:rounded-none [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div className="relative flex items-center gap-2 p-3">
          {!narrow && downloadButtons('')}
          {!narrow && error && <span className="text-sm text-destructive">{error}</span>}
          <span
            dir="ltr"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
          >
            {current + 1}/{photos.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ms-auto h-10 w-10 rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </Button>
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
        {narrow && (
          <div className="flex flex-col gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {error && <span className="text-sm text-destructive">{error}</span>}
            <div className="flex gap-2">{downloadButtons('h-11 flex-1')}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
