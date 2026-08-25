import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Copy, ImagePlus, Music, Pause, Play } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Toaster } from '@/Components/ui/sonner';
import AudioEngine from './_components/AudioEngine';
import LyricsView from './_components/LyricsView';
import ShareLyricsDialog from './_components/ShareLyricsDialog';
import { formatTime } from './_lib/lrc';
import { copyText } from './_lib/clipboard';
import { useCurrentSong, usePlayerStore } from './_lib/playerStore';
import type { SongFull } from './types';

interface SpotifySongProps {
  song: SongFull;
}

export default function SpotifySong({ song }: SpotifySongProps) {
  const current = useCurrentSong();
  const isCurrent = current?.id === song.id;
  const playing = usePlayerStore((s) => s.playing) && isCurrent;
  const storeTime = usePlayerStore((s) => s.currentTime);
  const currentTime = isCurrent ? storeTime : 0;
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const [shareOpen, setShareOpen] = useState(false);

  const duration = song.duration_seconds ?? 0;
  const pageTitle = song.artist ? `${song.title} - ${song.artist}` : song.title;

  const handleToggle = () => {
    if (isCurrent) toggle();
    else play([song], 0);
  };

  const handleSeek = (t: number) => {
    if (!isCurrent) play([song], 0);
    seek(t);
  };

  return (
    <MainLayout>
      <Head>
        <title>{`${pageTitle} | Syrian Zone`}</title>
        <meta name="description" content={`استمع إلى ${song.title} مع الكلمات المتزامنة على Syrian Zone.`} />
        <meta property="og:type" content="music.song" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={`استمع إلى ${song.title} مع الكلمات المتزامنة على Syrian Zone.`} />
        <meta property="og:image" content={song.cover_url ?? 'https://syrian.zone/assets/thumbnail.jpg'} />
        {song.audio_url && <meta property="og:audio" content={song.audio_url} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href="/spotify"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            كل الأغاني
          </Link>

          <div className="flex flex-col items-center gap-4 text-center">
            {song.cover_url ? (
              <img
                src={song.cover_url}
                alt={song.title}
                className="aspect-square w-full max-w-xs rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-2xl bg-muted shadow-lg">
                <Music className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black">{song.title}</h1>
              {song.artist && <p className="mt-1 text-sm text-muted-foreground">{song.artist}</p>}
            </div>

            <div className="flex w-full max-w-md flex-col items-center gap-3">
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-md [&_svg]:size-6"
                onClick={handleToggle}
                disabled={!song.audio_url}
                aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
              </Button>
              <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
                <span className="w-9 text-center">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={1}
                  value={Math.min(currentTime, duration || currentTime)}
                  disabled={!duration}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-primary disabled:cursor-default"
                  aria-label="شريط التقدم"
                />
                <span className="w-9 text-center">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(`${window.location.origin}/spotify/song/${song.slug}`, 'تم نسخ رابط الأغنية')
                }
              >
                <Copy className="me-1 h-4 w-4" />
                نسخ الرابط
              </Button>
              {song.lyrics_lrc && (
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  <ImagePlus className="me-1 h-4 w-4" />
                  مشاركة الكلمات كصورة
                </Button>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 text-sm font-bold">الكلمات</h2>
            <LyricsView
              lrc={song.lyrics_lrc}
              currentTime={currentTime}
              onSeek={handleSeek}
              className="max-h-96"
            />
          </div>
        </div>

        <AudioEngine />
        {song.lyrics_lrc && (
          <ShareLyricsDialog open={shareOpen} onOpenChange={setShareOpen} song={song} />
        )}
        <Toaster />
      </div>
    </MainLayout>
  );
}
