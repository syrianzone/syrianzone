import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import RecitationPicker from './RecitationPicker';
import { SURAH_NAMES_AR, recitationByCode, type Ayah } from '../_lib/quran';
import { useSurahAudio, type ActiveWord } from '../_lib/useSurahAudio';

interface Props {
  ayahs: Ayah[];
  /** v4 recitation code (`reciter/rN`). */
  reciterCode: string;
  setReciterCode: (code: string) => void;
  currentKey: string | null;
  onSelectAyah: (key: string) => void;
  /** Incremented when the user taps an Ayah in the text: start playing it. */
  playSignal: number;
  onEndOfList?: () => void;
  /** The word being recited now, so the reader can highlight it. */
  onActiveWordChange?: (word: ActiveWord | null) => void;
}

// Slim bottom player: volume (right), centered transport + bookmark,
// searchable reciter picker (left). Sticky bottom, in-flow, so Mushaf
// text is never hidden under it.
export default function AudioPlayer({
  ayahs, reciterCode, setReciterCode, currentKey, onSelectAyah, playSignal,
  onEndOfList, onActiveWordChange,
}: Props) {
  const recitation = recitationByCode(reciterCode);
  const audio = useSurahAudio({
    ayahs,
    recitation,
    currentKey,
    playSignal,
    onSelectAyah,
    onEndOfList,
  });
  const audioRef = audio.audioProps.ref;

  // Surface the active word to the reader so the Mushaf can highlight it.
  useEffect(() => {
    onActiveWordChange?.(audio.activeWord);
  }, [audio.activeWord, onActiveWordChange]);

  const [volume, setVolume] = useState(() => {
    const v = Number(window.localStorage.getItem('sz-muslim-volume') ?? 1);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);

  const idx = Math.max(0, ayahs.findIndex((a) => a.key === currentKey));
  const current: Ayah | undefined = ayahs[idx];

  // Volume + mute (persisted).
  useEffect(() => {
    window.localStorage.setItem('sz-muslim-volume', String(volume));
  }, [volume]);
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = muted ? 0 : volume;
  }, [audioRef, volume, muted]);

  // Mobile: the voice icon toggles a volume popup (slider stays hidden).
  // Desktop: the icon mutes/unmutes, the slider is inline.
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

  const { playing, loading, error, progress } = audio;
  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const letterText =
    audio.activeWord?.letterIndex != null && audio.activeWord.letterCount
      ? ` · الحرف ${audio.activeWord.letterIndex}/${audio.activeWord.letterCount}`
      : '';

  return (
    // Full-viewport-width background (physical negative margins break out of
    // the centered container; the overflow-hidden page wrapper clips the
    // scrollbar-width excess). Controls stay at the current narrow width.
    <div className="sticky bottom-0 z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] border-t border-border bg-card/95 px-4 py-2 backdrop-blur">
      <audio {...audio.audioProps} />
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        {/* Right: volume (outline to match the reciter button). */}
        <div ref={volumeWrapRef} className="relative flex flex-1 items-center justify-start gap-1">
          <Button
            variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full"
            title={isNarrow ? 'مستوى الصوت' : muted ? 'إلغاء الكتم' : 'كتم الصوت'}
            aria-expanded={isNarrow ? volumeOpen : undefined}
            onClick={() => {
              if (isNarrow) setVolumeOpen((o) => !o);
              else setMuted((m) => !m);
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
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              setMuted(v === 0);
            }}
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                }}
                className="sz-range block w-28"
                style={{
                  background: `linear-gradient(to left, hsl(var(--primary)) ${effectiveVolume * 100}%, hsl(var(--primary) / 0.2) ${effectiveVolume * 100}%)`,
                }}
              />
            </div>
          )}
        </div>

        {/* Center: transport + bookmark */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="الآية السابقة"
            disabled={idx <= 0} onClick={audio.prev}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-11 w-11 rounded-full shadow" title={playing ? 'إيقاف مؤقت' : 'تشغيل'} onClick={audio.toggle}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="ms-0.5 h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="الآية التالية"
            disabled={idx >= ayahs.length - 1} onClick={audio.next}>
            <SkipBack className="h-4 w-4" />
          </Button>
        </div>

        {/* Left: searchable reciter picker */}
        <div className="flex flex-1 items-center justify-end">
          <RecitationPicker value={recitation.code} onChange={setReciterCode} />
        </div>
      </div>
      {/* Ayah progress: fills from the right (RTL) as the Ayah is recited. */}
      <div className="mx-auto mt-1 max-w-3xl">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%`, marginInlineStart: 'auto' }}
          />
        </div>
      </div>
      <div className="mx-auto mt-0.5 max-w-3xl truncate text-center text-[11px] text-muted-foreground">
        {error
          ? <span className="text-destructive">{error}</span>
          : current
            ? `آية ${current.key} · سورة ${SURAH_NAMES_AR[current.surah] ?? current.surah}${letterText}`
            : 'اختر آية من الصفحة'}
      </div>
    </div>
  );
}
