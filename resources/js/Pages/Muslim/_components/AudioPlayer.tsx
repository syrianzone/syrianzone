import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import RecitationPicker from './RecitationPicker';
import { SURAH_NAMES_AR, type Ayah } from '../_lib/quran';
import { useQuranPlayer } from '@/Lib/quranPlayer';

interface Props {
  /** Ayahs on the visible page (only used to know the reader has content). */
  ayahs: Ayah[];
  /** v4 recitation code (`reciter/rN`). */
  reciterCode: string;
  setReciterCode: (code: string) => void;
  /** Start (or restart) playback from the selected ayah. */
  onPlayRequest: () => void;
}

// Reader transport bar. Playback itself lives in the global player; this binds
// to it, and only reflects/controls it while the reader owns the queue.
export default function AudioPlayer({ ayahs, reciterCode, setReciterCode, onPlayRequest }: Props) {
  const playing = useQuranPlayer((s) => s.playing);
  const loading = useQuranPlayer((s) => s.loading);
  const error = useQuranPlayer((s) => s.error);
  const progress = useQuranPlayer((s) => s.progress);
  const source = useQuranPlayer((s) => s.source);
  const current = useQuranPlayer((s) => s.current);
  const activeWord = useQuranPlayer((s) => s.activeWord);
  const volume = useQuranPlayer((s) => s.volume);
  const muted = useQuranPlayer((s) => s.muted);
  const setVolume = useQuranPlayer((s) => s.setVolume);
  const setMuted = useQuranPlayer((s) => s.setMuted);
  const toggle = useQuranPlayer((s) => s.toggle);
  const next = useQuranPlayer((s) => s.next);
  const prev = useQuranPlayer((s) => s.prev);

  const readerActive = source === 'reader';
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);

  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const letterText =
    readerActive && activeWord?.letterIndex != null && activeWord.letterCount
      ? ` · الحرف ${activeWord.letterIndex}/${activeWord.letterCount}`
      : '';

  // Mobile: the voice icon toggles a volume popup (slider stays hidden).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 419px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!volumeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!volumeWrapRef.current?.contains(e.target as Node)) setVolumeOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [volumeOpen]);

  if (ayahs.length === 0) return null;

  const playButton = () => {
    if (readerActive && playing) toggle();
    else onPlayRequest();
  };

  return (
    <div className="sticky bottom-0 z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] border-t border-border bg-card/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        {/* Right: volume */}
        <div ref={volumeWrapRef} className="relative flex flex-1 items-center justify-start gap-1">
          <Button
            variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full"
            title={isNarrow ? 'مستوى الصوت' : muted ? 'إلغاء الكتم' : 'كتم الصوت'}
            aria-expanded={isNarrow ? volumeOpen : undefined}
            onClick={() => {
              if (isNarrow) setVolumeOpen((o) => !o);
              else setMuted(!muted);
            }}
          >
            <VolumeIcon className="h-4 w-4" />
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={effectiveVolume}
            aria-label="مستوى الصوت"
            onChange={(e) => setVolume(Number(e.target.value))}
            className="sz-range hidden w-20 min-[420px]:block sm:w-24"
            style={{
              background: `linear-gradient(to left, hsl(var(--primary)) ${effectiveVolume * 100}%, hsl(var(--primary) / 0.2) ${effectiveVolume * 100}%)`,
            }}
          />
          {isNarrow && volumeOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-1.5 rounded-md border border-border bg-popover p-2.5 shadow-md">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={effectiveVolume}
                aria-label="مستوى الصوت"
                onChange={(e) => setVolume(Number(e.target.value))}
                className="sz-range block w-28"
                style={{
                  background: `linear-gradient(to left, hsl(var(--primary)) ${effectiveVolume * 100}%, hsl(var(--primary) / 0.2) ${effectiveVolume * 100}%)`,
                }}
              />
            </div>
          )}
        </div>

        {/* Center: transport */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="الآية السابقة"
            disabled={!readerActive} onClick={prev}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-11 w-11 rounded-full shadow" title={readerActive && playing ? 'إيقاف مؤقت' : 'تشغيل'} onClick={playButton}>
            {readerActive && loading ? <Loader2 className="h-5 w-5 animate-spin" /> : readerActive && playing ? <Pause className="h-5 w-5" /> : <Play className="ms-0.5 h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="الآية التالية"
            disabled={!readerActive} onClick={next}>
            <SkipBack className="h-4 w-4" />
          </Button>
        </div>

        {/* Left: searchable reciter picker */}
        <div className="flex flex-1 items-center justify-end">
          <RecitationPicker value={reciterCode} onChange={setReciterCode} />
        </div>
      </div>
      {/* Ayah progress: fills from the right (RTL) as the Ayah is recited. */}
      <div className="mx-auto mt-1 max-w-3xl">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-linear"
            style={{ width: `${Math.round((readerActive ? progress : 0) * 100)}%`, marginInlineStart: 'auto' }}
          />
        </div>
      </div>
      <div className="mx-auto mt-0.5 max-w-3xl truncate text-center text-[11px] text-muted-foreground">
        {readerActive && error
          ? <span className="text-destructive">{error}</span>
          : current
            ? `آية ${current.surah}:${current.ayah} · سورة ${SURAH_NAMES_AR[current.surah] ?? current.surah}${letterText}`
            : 'اختر آية من الصفحة'}
      </div>
    </div>
  );
}
