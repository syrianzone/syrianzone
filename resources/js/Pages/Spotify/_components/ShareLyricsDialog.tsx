import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/Components/ui/dialog';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { parseLrc } from '../_lib/lrc';
import { exportLyricCard, renderLyricCard } from '../_lib/exportLyricCard';

const MAX_LINES = 5;

type ShareLyricsDialogProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  song: {
    title: string;
    artist: string | null;
    slug: string;
    cover_url: string | null;
    lyrics_lrc: string | null;
  };
};

export default function ShareLyricsDialog({ open, onOpenChange, song }: ShareLyricsDialogProps) {
  const lines = useMemo<string[]>(() => {
    if (!song.lyrics_lrc) return [];
    return parseLrc(song.lyrics_lrc)
      .map((l: { time: number | null; text: string }) => l.text.trim())
      .filter((t: string) => t.length > 0);
  }, [song.lyrics_lrc]);

  const [selected, setSelected] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);

  // card lines follow lyric order, not tap order
  const chosenLines = useMemo(
    () => [...selected].sort((a, b) => a - b).map((i) => lines[i]),
    [selected, lines]
  );
  const atMax = selected.length >= MAX_LINES;

  useEffect(() => {
    if (open) {
      setSelected([]);
      setPreviewUrl(null);
    }
  }, [open]);

  // debounced live preview
  useEffect(() => {
    if (!open || chosenLines.length === 0) {
      setPreviewUrl(null);
      setRendering(false);
      return;
    }
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(async () => {
      try {
        const url = await renderLyricCard({
          title: song.title,
          artist: song.artist,
          lines: chosenLines,
          coverUrl: song.cover_url,
        });
        if (!cancelled) setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, chosenLines, song.title, song.artist, song.cover_url]);

  const toggleLine = (i: number) => {
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, i];
    });
  };

  const handleExport = async () => {
    if (chosenLines.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportLyricCard({
        title: song.title,
        artist: song.artist,
        lines: chosenLines,
        coverUrl: song.cover_url,
      });
    } catch {
      toast.error('تعذر إنشاء الصورة، حاول مرة أخرى');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>مشاركة الكلمات كصورة</DialogTitle>
          <DialogDescription>
            اختر حتى {MAX_LINES} أسطر من الكلمات لإنشاء بطاقة قابلة للمشاركة
          </DialogDescription>
        </DialogHeader>

        <div className="w-full aspect-square rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt="معاينة بطاقة الكلمات" className="w-full h-full object-contain" />
          ) : rendering ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">
              اختر سطراً واحداً على الأقل لعرض المعاينة
            </p>
          )}
        </div>

        {atMax && (
          <p className="text-xs text-muted-foreground">
            وصلت إلى الحد الأقصى ({MAX_LINES} أسطر)، ألغِ تحديد سطر لاختيار غيره
          </p>
        )}

        <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {lines.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لا توجد كلمات متاحة لهذه الأغنية</p>
          ) : (
            lines.map((text, i) => {
              const isSelected = selected.includes(i);
              const disabled = !isSelected && atMax;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleLine(i)}
                  disabled={disabled}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-right text-sm transition-colors',
                    isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50',
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1 leading-relaxed">{text}</span>
                </button>
              );
            })
          )}
        </div>

        <Button onClick={handleExport} disabled={chosenLines.length === 0 || exporting} className="w-full gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'جارٍ إنشاء الصورة...' : 'تنزيل الصورة'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
