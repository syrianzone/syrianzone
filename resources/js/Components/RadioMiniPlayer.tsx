import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Radio, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/Components/ui/sheet';
import QuranWordWindow from '@/Components/QuranWordWindow';
import { useQuranPlayer } from '@/Domain/quran/quranPlayer';
import { SURAH_NAMES_AR, recitationByCode } from '@/Domain/quran/quran';

// A persistent "now playing" for the followed recitation (إذاعة القرآن). It
// appears once the radio owns the player and the user is elsewhere in the app;
// on the radio and reader pages those surfaces already carry the controls, so
// it hides. Everything is themed through the shadcn tokens.
export default function RadioMiniPlayer() {
  const { url } = usePage();
  const pathname = url.split('?')[0];

  const source = useQuranPlayer((s) => s.source);
  const current = useQuranPlayer((s) => s.current);
  const playing = useQuranPlayer((s) => s.playing);
  const loading = useQuranPlayer((s) => s.loading);
  const muted = useQuranPlayer((s) => s.muted);
  const recitationCode = useQuranPlayer((s) => s.recitationCode);
  const toggle = useQuranPlayer((s) => s.toggle);
  const next = useQuranPlayer((s) => s.next);
  const prev = useQuranPlayer((s) => s.prev);
  const stop = useQuranPlayer((s) => s.stop);
  const setMuted = useQuranPlayer((s) => s.setMuted);

  // Only while the radio owns the queue, and never on a page that already
  // shows the full player (the radio view and the Quran reader).
  if (source !== 'continuous' || !current) return null;
  if (pathname === '/muslim/radio' || pathname === '/muslim/quran') return null;

  const surahName = SURAH_NAMES_AR[current.surah] ?? `سورة ${current.surah}`;
  const reciter = recitationByCode(recitationCode).nameAr;

  const transport = (
    <div className="flex items-center justify-center gap-2">
      <Button variant="ghost" size="icon" onClick={prev} title="الآية السابقة" aria-label="الآية السابقة">
        <ChevronRight className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        onClick={toggle}
        disabled={loading}
        className="h-11 w-11 rounded-full"
        title={playing ? 'إيقاف مؤقت' : 'تشغيل'}
        aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ms-0.5 h-5 w-5 fill-current" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={next} title="الآية التالية" aria-label="الآية التالية">
        <ChevronLeft className="h-5 w-5" />
      </Button>
    </div>
  );

  const nowPlaying = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Radio className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{surahName} · آية {current.ayah}</span>
        <span className="block truncate text-xs text-muted-foreground">{reciter}</span>
      </span>
    </div>
  );

  const wordWindow = (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5">
      <QuranWordWindow compact />
    </div>
  );

  return (
    <div dir="rtl">
      {/* Desktop: a floating now-playing card, bottom-right. */}
      <div className="fixed bottom-4 right-4 z-40 hidden w-80 md:block">
        <Card className="border-border/60 bg-card/95 shadow-lg backdrop-blur">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-2">
              {nowPlaying}
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMuted(!muted)}
                  title={muted ? 'إلغاء الكتم' : 'كتم الصوت'}
                  aria-label={muted ? 'إلغاء الكتم' : 'كتم الصوت'}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stop} title="إيقاف الإذاعة" aria-label="إيقاف الإذاعة">
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {wordWindow}

            <div className="flex items-center justify-between gap-2">
              {transport}
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                <Link href="/muslim/radio">
                  <Radio className="h-3.5 w-3.5" />
                  الراديو
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: a floating button that opens the controls. */}
      <div className="fixed bottom-4 right-4 z-40 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="relative h-14 w-14 rounded-full shadow-lg"
              title="إذاعة القرآن"
              aria-label="إذاعة القرآن"
            >
              <Radio className="h-6 w-6" />
              {playing && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden="true" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" dir="rtl" className="rounded-t-3xl border-b-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="text-right">
              <SheetTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                إذاعة القرآن
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-5 pt-4">
              <div className="text-center">
                <p className="text-base font-bold">{surahName} · آية {current.ayah}</p>
                <p className="text-xs text-muted-foreground">{reciter}</p>
              </div>
              {wordWindow}
              {transport}
              <div className="flex items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/muslim/radio">
                    <Radio className="h-4 w-4" />
                    الانتقال إلى الراديو
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={stop}>
                  <Square className="h-3.5 w-3.5" />
                  إيقاف
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
