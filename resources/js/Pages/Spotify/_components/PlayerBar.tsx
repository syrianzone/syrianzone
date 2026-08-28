import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  MicVocal,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import AudioEngine from './AudioEngine';
import LyricsPanel from './LyricsPanel';
import { formatTime } from '../_lib/lrc';
import { useCurrentSong, usePlayerStore } from '../_lib/playerStore';

// sticky bottom bar: owns the audio element and the lyrics panel
export default function PlayerBar() {
  const song = useCurrentSong();
  const playing = usePlayerStore((s) => s.playing);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const saved = usePlayerStore((s) => (song ? s.savedIds.includes(song.id) : false));
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMuted = usePlayerStore((s) => s.toggleMuted);
  const toggleSaved = usePlayerStore((s) => s.toggleSaved);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  if (!song) return <AudioEngine />;

  const duration = song.duration_seconds ?? 0;
  const repeatLabel =
    repeat === 'off' ? 'التكرار: إيقاف' : repeat === 'all' ? 'التكرار: الكل' : 'التكرار: أغنية واحدة';

  return (
    <>
      <AudioEngine />
      {/* spacer so page content is not hidden behind the fixed bar */}
      <div className="h-28" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div
          className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-2.5"
          style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3">
            {song.cover_url ? (
              <img src={song.cover_url} alt={song.title} className="h-10 w-10 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{song.title}</p>
              {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setLyricsOpen(true)}
                disabled={!song.has_lyrics}
                title={song.has_lyrics ? 'عرض الكلمات' : 'لا توجد كلمات'}
                aria-label="الكلمات"
              >
                <MicVocal />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-9 w-9', saved && 'text-primary hover:text-primary')}
                onClick={() => toggleSaved(song.id)}
                aria-label={saved ? 'إزالة من المحفوظة' : 'حفظ الأغنية'}
              >
                {saved ? <BookmarkCheck className="fill-current" /> : <Bookmark />}
              </Button>
              {/* rtl: back points right, forward points left; the transport mirrors
                  the reading direction so "previous" sits on the right */}
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={prev} aria-label="السابق">
                <SkipForward />
              </Button>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full [&_svg]:size-5"
                onClick={toggle}
                aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={next} aria-label="التالي">
                <SkipBack />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', shuffle ? 'text-primary hover:text-primary' : 'text-muted-foreground')}
              onClick={toggleShuffle}
              aria-label="خلط التشغيل"
              aria-pressed={shuffle}
            >
              <Shuffle />
            </Button>
            <span className="w-9 text-center">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={1}
              value={Math.min(currentTime, duration || currentTime)}
              disabled={!duration}
              onChange={(e) => seek(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-primary disabled:cursor-default"
              aria-label="شريط التقدم"
            />
            <span className="w-9 text-center">{formatTime(duration)}</span>
            {/* volume is pointless on most phones (hardware buttons rule): hide it narrow */}
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={toggleMuted}
                aria-label={muted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-primary"
                aria-label="مستوى الصوت"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', repeat !== 'off' ? 'text-primary hover:text-primary' : 'text-muted-foreground')}
              onClick={cycleRepeat}
              aria-label={repeatLabel}
              title={repeatLabel}
            >
              {repeat === 'one' ? <Repeat1 /> : <Repeat />}
            </Button>
          </div>
        </div>
      </div>
      <LyricsPanel open={lyricsOpen} onOpenChange={setLyricsOpen} />
    </>
  );
}
