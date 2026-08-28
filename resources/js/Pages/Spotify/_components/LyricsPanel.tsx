import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/Components/ui/sheet';
import LyricsView from './LyricsView';
import { fetchSongLyrics } from '../_lib/api';
import { useCurrentSong, usePlayerStore } from '../_lib/playerStore';

const lyricsCache = new Map<string, string | null>();

interface LyricsPanelProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function LyricsPanel({ open, onOpenChange }: LyricsPanelProps) {
  const song = useCurrentSong();
  const currentTime = usePlayerStore((s) => s.currentTime);
  const seek = usePlayerStore((s) => s.seek);
  const [lrc, setLrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !song) return;
    // every early exit must clear loading: a cancelled fetch (panel closed
    // mid-flight) leaves it true and the guarded finally never ran
    if (!song.has_lyrics) {
      setLrc(null);
      setLoading(false);
      return;
    }
    const cached = lyricsCache.get(song.slug);
    if (cached !== undefined) {
      setLrc(cached);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLrc(null);
    fetchSongLyrics(song.slug)
      .then((text) => {
        lyricsCache.set(song.slug, text);
        if (active) setLrc(text);
      })
      .catch(() => {
        if (active) setLrc(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, song?.slug]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[75dvh] flex-col rounded-t-2xl p-0">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-start sm:text-start">
          <SheetTitle className="truncate text-base">{song?.title ?? 'الكلمات'}</SheetTitle>
          <SheetDescription className="truncate text-xs">
            {song?.artist ?? 'كلمات الأغنية'}
          </SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <LyricsView lrc={lrc} currentTime={currentTime} onSeek={seek} className="flex-1" />
        )}
      </SheetContent>
    </Sheet>
  );
}
