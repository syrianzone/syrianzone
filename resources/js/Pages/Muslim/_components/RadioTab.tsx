import React from 'react';
import {
  AlertCircle, ArrowRight, ChevronLeft, ChevronRight, HardDrive, Loader2, MoonStar, Pause, Play, Volume2, VolumeX,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import QuranStationPicker from '@/Components/QuranStationPicker';
import { QuranRadioIcon } from '@/Components/Icons/ProjectIcons';
import { useLiveRadio } from '@/Lib/useLiveRadio';
import { useRadioUsage } from '@/Lib/useRadioUsage';
import { formatBytes } from '@/Lib/radioUsage';
import { formatDuration } from '../_lib/format';
import { syncMuslimUrl, useMuslimNav } from '../_lib/nav';

/** Sleep-timer presets in minutes. Endless (null) is the default. */
const SLEEP_OPTIONS: Array<{ minutes: number | null; label: string }> = [
  { minutes: null, label: 'بدون' },
  { minutes: 15, label: '15 د' },
  { minutes: 30, label: '30 د' },
  { minutes: 45, label: '45 د' },
  { minutes: 60, label: 'ساعة' },
  { minutes: 90, label: 'ساعة ونصف' },
];

export default function RadioTab() {
  const setView = useMuslimNav((s) => s.setView);
  const sleepUntil = useMuslimNav((s) => s.radioSleepUntil);
  const setSleepUntil = useMuslimNav((s) => s.setRadioSleepUntil);

  const radio = useLiveRadio();
  const { station, isPlaying, isLoading, error, hasStarted } = radio;

  const [now, setNow] = React.useState(() => Date.now());
  const [confirmClear, setConfirmClear] = React.useState(false);
  const usage = useRadioUsage(isPlaying);
  // Wall clock of the current listening stretch, for the elapsed readout. A
  // ref keeps the transition logic readable across station changes.
  const startedRef = React.useRef<number | null>(null);
  const stationRef = React.useRef<number | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);

  // One ticking clock for both the elapsed readout and the sleep countdown.
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (station?.id !== stationRef.current) {
      stationRef.current = station?.id ?? null;
      startedRef.current = isPlaying ? Date.now() : null;
    } else if (isPlaying && startedRef.current === null) {
      startedRef.current = Date.now();
    } else if (!isPlaying) {
      startedRef.current = null;
    }
    setStartedAt(startedRef.current);
  }, [isPlaying, station?.id]);

  // The timer lives in the nav store, so a deadline set here keeps running
  // while the user reads the Quran or checks prayer times. Endless by default,
  // so with nothing set this never fires.
  const sleepRemaining = sleepUntil === null ? null : sleepUntil - now;
  React.useEffect(() => {
    if (sleepRemaining === null || sleepRemaining > 0) return;
    radio.pause();
    setSleepUntil(null);
  }, [radio, setSleepUntil, sleepRemaining]);

  // Lock-screen / notification controls. Callbacks go through a ref so the
  // handlers are registered once rather than on every render.
  const latest = React.useRef(radio);
  latest.current = radio;
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (station) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: 'إذاعة القرآن الكريم',
        album: 'بث مباشر',
      });
    }
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ['play', () => latest.current.toggle()],
      ['pause', () => latest.current.toggle()],
      ['previoustrack', () => latest.current.prev()],
      ['nexttrack', () => latest.current.next()],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* action unsupported here */
      }
    });
    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      });
    };
  }, [station]);

  const backToIndex = () => {
    setView('index');
    syncMuslimUrl('index');
    window.scrollTo({ top: 0 });
  };

  const selectSleep = (minutes: number | null) => {
    setSleepUntil(minutes === null ? null : Date.now() + minutes * 60_000);
  };

  // Two taps: clearing is not undoable on the server.
  const clearUsage = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    void usage.clear();
  };

  // Highlight whichever preset the remaining time rounds to, so the active
  // chip survives leaving and re-entering the applet.
  const remainingMinutes = sleepRemaining === null ? null : Math.ceil(sleepRemaining / 60_000);

  return (
    <div className="space-y-5">
      <audio {...radio.audioProps} />

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={backToIndex} className="gap-1 px-2 text-xs text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> رجوع
        </Button>
        <p className="text-xs text-muted-foreground">
          {radio.isListLoading && !station ? 'جارٍ جلب الإذاعات…' : `${radio.stations.length} إذاعة`}
        </p>
      </div>

      {/* Now playing */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <QuranRadioIcon className="h-12 w-12" />
          </div>

          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-bold leading-snug">{station?.name ?? '—'}</p>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? 'animate-pulse bg-primary' : 'bg-muted-foreground/50'}`} />
              {isPlaying ? 'بث مباشر' : 'متوقف'}
              {isPlaying && startedAt !== null && (
                <span dir="ltr" className="font-mono tabular-nums text-muted-foreground/80">
                  {formatDuration(now - startedAt)}
                </span>
              )}
            </p>
          </div>

          {error && (
            <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-center">{error}</p>
              {error.includes('جرّب إذاعة أخرى') && (
                <Button variant="outline" size="sm" onClick={radio.retry}>إعادة المحاولة</Button>
              )}
            </div>
          )}

          {/* Transport */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={radio.prev}
              className="p-2 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="القارئ السابق"
              aria-label="القارئ السابق"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={radio.toggle}
              disabled={isLoading || !station}
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 disabled:opacity-60 ${
                isPlaying ? 'scale-105 ring-4 ring-primary/20' : 'hover:bg-primary/90'
              }`}
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="h-7 w-7 fill-current ms-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={radio.next}
              className="p-2 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="القارئ التالي"
              aria-label="القارئ التالي"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex w-full max-w-xs items-center gap-2">
            <button
              type="button"
              onClick={radio.toggleMute}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={radio.isMuted || radio.volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
              aria-label={radio.isMuted || radio.volume === 0 ? 'إلغاء الكتم' : 'كتم الصوت'}
            >
              {radio.isMuted || radio.volume === 0 ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={radio.isMuted ? 0 : radio.volume}
              onChange={(e) => radio.setVolume(Number(e.target.value))}
              // `to left` because the page is RTL: the fill grows from the right.
              style={{
                background: `linear-gradient(to left, hsl(var(--primary)) ${(radio.isMuted ? 0 : radio.volume) * 100}%, hsl(var(--primary) / 0.2) ${(radio.isMuted ? 0 : radio.volume) * 100}%)`,
              }}
              className="sz-range h-1.5 w-full cursor-pointer"
              title={`مستوى الصوت: ${Math.round((radio.isMuted ? 0 : radio.volume) * 100)}%`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Station picker */}
      <div className="space-y-2">
        <QuranStationPicker
          stations={radio.stations}
          value={station}
          onSelect={radio.selectStation}
          drop="top"
          isLoading={radio.isListLoading}
        />
        {radio.isFallbackList && (
          <p className="text-center text-[11px] text-muted-foreground">
            تعذّر جلب القائمة الكاملة — نعرض إذاعات مختارة.
          </p>
        )}
      </div>

      {/* Sleep timer */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <MoonStar className="h-4 w-4 text-primary" />
              مؤقّت النوم
            </p>
            {sleepRemaining !== null && (
              <span dir="ltr" className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatDuration(sleepRemaining)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SLEEP_OPTIONS.map((opt) => {
              const isActive = opt.minutes === null ? remainingMinutes === null : remainingMinutes === opt.minutes;
              return (
                <Button
                  key={opt.label}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => selectSleep(opt.minutes)}
                  className="h-8 px-3 text-xs"
                  aria-pressed={isActive}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {hasStarted ? 'يتوقف البث تلقائياً عند انتهاء المهلة.' : 'اضغط تشغيل لبدء البث.'}
          </p>
        </CardContent>
      </Card>

      {/* Data usage */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <HardDrive className="h-4 w-4 text-primary" />
              استهلاك البيانات
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearUsage}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              {confirmClear ? 'تأكيد المسح' : 'مسح السجل'}
            </Button>
          </div>

          <dl className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">الاستهلاك المتوقع</dt>
              <dd className="whitespace-nowrap font-medium">
                {formatBytes(usage.perHour)} / ساعة
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">هذه الجلسة</dt>
              <dd className="whitespace-nowrap font-mono tabular-nums">
                {formatBytes(usage.session.bytes)}
                <span className="mx-1.5 text-muted-foreground/60">·</span>
                {formatDuration(usage.session.seconds * 1000)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">هذا الجهاز</dt>
              <dd className="whitespace-nowrap font-mono tabular-nums">
                {formatBytes(usage.device.bytes)}
                <span className="mx-1.5 text-muted-foreground/60">·</span>
                {formatDuration(usage.device.seconds * 1000)}
              </dd>
            </div>
            {usage.account && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">حسابك (كل الأجهزة)</dt>
                <dd className="whitespace-nowrap font-mono tabular-nums">
                  {formatBytes(usage.account.bytes)}
                  <span className="mx-1.5 text-muted-foreground/60">·</span>
                  {formatDuration(usage.account.seconds * 1000)}
                </dd>
              </div>
            )}
          </dl>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            محسوب من معدّل البث (128 كيلوبت/ث) — البث متصل بلا ملف كامل، والقياس الفعلي غير متاح من المتصفح.
            {usage.isLoggedIn ? ' حسابك محفوظ على الخادم.' : ' السجل محفوظ على هذا الجهاز فقط لأنك غير مسجّل.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
