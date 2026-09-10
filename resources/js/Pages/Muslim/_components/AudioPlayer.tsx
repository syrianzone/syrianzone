import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import ReciterPicker from './ReciterPicker';
import { SURA_NAMES_AR, ayahAudioUrl, reciterById, type Ayah } from '../_lib/quran';

interface Props {
  ayat: Ayah[];
  reciterId: string;
  setReciterId: (id: string) => void;
  currentKey: string | null;
  onSelectAyah: (key: string) => void;
  /** Incremented when the user taps an Ayah in the text: start playing it. */
  playSignal: number;
  onEndOfList?: () => void;
}

// Slim bottom player: volume (right), centered transport + bookmark,
// searchable reciter picker (left). Sticky bottom, in-flow, so Mushaf
// text is never hidden under it.
export default function AudioPlayer({
  ayat, reciterId, setReciterId, currentKey, onSelectAyah, playSignal,
  onEndOfList,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = Number(window.localStorage.getItem('sz-muslim-volume') ?? 1);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);
  const reciter = reciterById(reciterId);

  const idx = Math.max(0, ayat.findIndex((a) => a.key === currentKey));
  const current: Ayah | undefined = ayat[idx];

  // Stable player core (refs avoid stale closures in listeners).
  const live = useRef({ ayat, currentKey, reciter, onSelectAyah, onEndOfList });
  live.current = { ayat, currentKey, reciter, onSelectAyah, onEndOfList };

  const playAt = (i: number) => {
    const s = live.current;
    const ayah = s.ayat[i];
    const el = audioRef.current;
    if (!ayah || !el) return;
    s.onSelectAyah(ayah.key);
    el.src = ayahAudioUrl(s.reciter, ayah.surah, ayah.ayah);
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  // Auto-advance to the next Ayah when one ends.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      const s = live.current;
      const i = s.ayat.findIndex((a) => a.key === s.currentKey);
      if (i >= 0 && i + 1 < s.ayat.length) {
        const next = s.ayat[i + 1];
        s.onSelectAyah(next.key);
        el.src = ayahAudioUrl(s.reciter, next.surah, next.ayah);
        el.play().catch(() => setPlaying(false));
      } else if (s.onEndOfList) {
        s.onEndOfList();
      } else {
        setPlaying(false);
      }
    };
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, []);

  // Tap on Ayah text in the Mushaf starts playback from that Ayah.
  const lastSignal = useRef(0);
  useEffect(() => {
    if (playSignal > lastSignal.current) {
      lastSignal.current = playSignal;
      const s = live.current;
      const i = Math.max(0, s.ayat.findIndex((a) => a.key === s.currentKey));
      if (s.ayat.length > 0) {
        const ayah = s.ayat[i];
        s.onSelectAyah(ayah.key);
        const el = audioRef.current;
        if (el) {
          el.src = ayahAudioUrl(s.reciter, ayah.surah, ayah.ayah);
          el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
      }
    }
  });

  // Reciter switch keeps the position and reloads the same Ayah.
  const prevReciter = useRef(reciterId);
  useEffect(() => {
    if (prevReciter.current === reciterId) return;
    prevReciter.current = reciterId;
    const el = audioRef.current;
    if (!el || !el.src || !current) return;
    const wasPlaying = !el.paused;
    el.src = ayahAudioUrl(reciter, current.surah, current.ayah);
    if (wasPlaying) el.play().catch(() => setPlaying(false));
  });

  // Volume + mute (persisted).
  useEffect(() => {
    window.localStorage.setItem('sz-muslim-volume', String(volume));
  }, [volume]);
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = muted ? 0 : volume;
  }, [volume, muted]);

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

  if (ayat.length === 0) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else if (el.src) {
      el.play().catch(() => undefined);
    } else {
      playAt(idx);
    }
  };

  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;

  return (
    // Full-viewport-width background (physical negative margins break out of
    // the centered container; the overflow-hidden page wrapper clips the
    // scrollbar-width excess). Controls stay at the current narrow width.
    <div className="sticky bottom-0 z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] border-t border-border bg-card/95 px-4 py-2 backdrop-blur">
      <audio ref={audioRef} preload="none" onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} />
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
            disabled={idx <= 0} onClick={() => playAt(idx - 1)}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-11 w-11 rounded-full shadow" title={playing ? 'إيقاف مؤقت' : 'تشغيل'} onClick={toggle}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ms-0.5 h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="الآية التالية"
            disabled={idx >= ayat.length - 1} onClick={() => playAt(idx + 1)}>
            <SkipBack className="h-4 w-4" />
          </Button>
        </div>

        {/* Left: searchable reciter picker */}
        <div className="flex flex-1 items-center justify-end">
          <ReciterPicker value={reciter.id} onChange={setReciterId} />
        </div>
      </div>
      <div className="mx-auto mt-0.5 max-w-3xl truncate text-center text-[11px] text-muted-foreground">
        {current ? `آية ${current.key} · سورة ${SURA_NAMES_AR[current.surah] ?? current.surah}` : 'اختر آية من الصفحة'}
      </div>
    </div>
  );
}
