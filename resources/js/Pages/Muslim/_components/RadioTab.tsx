import React from 'react';
import {
  AlertCircle, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Loader2, MoonStar, Pause, Play,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import RecitationPicker from './RecitationPicker';
import QuranWordWindow from '@/Components/QuranWordWindow';
import QuranUsageCard from '@/Components/QuranUsageCard';
import { QuranRadioIcon } from '@/Components/Icons/ProjectIcons';
import { useQuranPlayer } from '@/Lib/quranPlayer';
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

interface Props {
  /** Jump to the reader at the ayah being recited. */
  onContinue?: (surah: number, ayah: number) => void;
}

/**
 * Followed recitation: continuous MP3Quran v4 playback (the whole mushaf) with
 * the text under it, replacing the old live streams. The player is global, so
 * listening continues if the user opens the Quran tab.
 */
export default function RadioTab({ onContinue }: Props) {
  const setView = useMuslimNav((s) => s.setView);
  const sleepUntil = useMuslimNav((s) => s.radioSleepUntil);
  const setSleepUntil = useMuslimNav((s) => s.setRadioSleepUntil);

  const playing = useQuranPlayer((s) => s.playing);
  const loading = useQuranPlayer((s) => s.loading);
  const error = useQuranPlayer((s) => s.error);
  const current = useQuranPlayer((s) => s.current);
  const recitationCode = useQuranPlayer((s) => s.recitationCode);
  const setRecitation = useQuranPlayer((s) => s.setRecitation);
  const playContinuous = useQuranPlayer((s) => s.playContinuous);
  const toggle = useQuranPlayer((s) => s.toggle);
  const next = useQuranPlayer((s) => s.next);
  const prev = useQuranPlayer((s) => s.prev);

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Sleep timer lives in the nav store, so it keeps running across views.
  const sleepRemaining = sleepUntil === null ? null : sleepUntil - now;
  React.useEffect(() => {
    if (sleepRemaining === null || sleepRemaining > 0) return;
    const p = useQuranPlayer.getState();
    if (p.playing) p.toggle();
    setSleepUntil(null);
  }, [sleepRemaining, setSleepUntil]);

  const backToIndex = () => {
    setView('index');
    syncMuslimUrl('index');
    window.scrollTo({ top: 0 });
  };

  const selectSleep = (minutes: number | null) => {
    setSleepUntil(minutes === null ? null : Date.now() + minutes * 60_000);
  };

  const startOrToggle = () => {
    if (current) toggle();
    else playContinuous({ recitationCode });
  };

  const remainingMinutes = sleepRemaining === null ? null : Math.ceil(sleepRemaining / 60_000);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={backToIndex} className="gap-1 px-2 text-xs text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> رجوع
        </Button>
        <p className="text-xs text-muted-foreground">تلاوة متابَعة</p>
      </div>

      {/* Now playing + text */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <QuranRadioIcon className="h-10 w-10" />
          </div>

          <QuranWordWindow className="text-center" />

          {error && (
            <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-center">{error}</p>
            </div>
          )}

          {/* Transport */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={prev}
              className="p-2 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="الآية السابقة"
              aria-label="الآية السابقة"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={startOrToggle}
              disabled={loading}
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 disabled:opacity-60 ${
                playing ? 'scale-105 ring-4 ring-primary/20' : 'hover:bg-primary/90'
              }`}
              title={playing ? 'إيقاف مؤقت' : 'تشغيل'}
              aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : playing ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="h-7 w-7 fill-current ms-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={next}
              className="p-2 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="الآية التالية"
              aria-label="الآية التالية"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Reciter + continue in reader */}
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <RecitationPicker value={recitationCode} onChange={setRecitation} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={!current}
              onClick={() => current && onContinue?.(current.surah, current.ayah)}
            >
              <BookOpen className="h-4 w-4" /> أكمل في القارئ
            </Button>
          </div>
        </CardContent>
      </Card>

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
            {current ? 'تتوقف التلاوة تلقائياً عند انتهاء المهلة.' : 'اضغط تشغيل لبدء التلاوة.'}
          </p>
        </CardContent>
      </Card>

      {/* Data usage */}
      <QuranUsageCard />
    </div>
  );
}
