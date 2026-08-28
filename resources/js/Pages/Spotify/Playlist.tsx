import { useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowRight, ArrowUp, Copy, ListMusic, Play, Trash2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Toaster, toast } from '@/Components/ui/sonner';
import PlayerBar from './_components/PlayerBar';
import SongRow from './_components/SongRow';
import { extractError, savedEditToken, updatePlaylist } from './_lib/api';
import { copyText } from './_lib/clipboard';
import { useCurrentSong, usePlayerStore } from './_lib/playerStore';
import type { PlaylistInfo, SongSummary } from './types';

interface SpotifyPlaylistProps {
  playlist: PlaylistInfo;
  songs: SongSummary[];
}

export default function SpotifyPlaylist({ playlist, songs }: SpotifyPlaylistProps) {
  const current = useCurrentSong();
  const playing = usePlayerStore((s) => s.playing);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);

  const [items, setItems] = useState<SongSummary[]>(songs);
  const [name, setName] = useState(playlist.name);
  const [savedName, setSavedName] = useState(playlist.name);
  const [busy, setBusy] = useState(false);
  // read after mount: localStorage is unavailable during ssr
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(savedEditToken(playlist.slug));
  }, [playlist.slug]);

  // a stale token in a signed-out browser must not surface edit UI; the server
  // rejects guest writes regardless, this just keeps the page honest
  const user = usePage<{ auth?: { user: { id: number } | null } }>().props.auth?.user ?? null;
  const isOwner = !!user && token !== null;

  const persistOrder = async (next: SongSummary[]) => {
    if (!token) return;
    const prev = items;
    setItems(next);
    setBusy(true);
    try {
      await updatePlaylist(playlist.slug, token, { song_ids: next.map((s) => s.id) });
    } catch (e) {
      setItems(prev);
      toast.error(extractError(e));
    } finally {
      setBusy(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next);
  };

  const remove = (i: number) => {
    persistOrder(items.filter((_, idx) => idx !== i));
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!token || !trimmed || trimmed === savedName) return;
    setBusy(true);
    try {
      await updatePlaylist(playlist.slug, token, { name: trimmed });
      setSavedName(trimmed);
      toast.success('تم حفظ الاسم');
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePlay = (i: number) => {
    if (current?.id === items[i].id) toggle();
    else play(items, i);
  };

  return (
    <MainLayout>
      <Head>
        <title>{`${savedName} | الموسيقى | Syrian Zone`}</title>
        <meta name="description" content={`قائمة تشغيل ${savedName} على Syrian Zone.`} />
        <meta property="og:type" content="music.playlist" />
        <meta property="og:title" content={`${savedName} | الموسيقى`} />
        <meta property="og:description" content={`استمع إلى قائمة تشغيل ${savedName} على Syrian Zone.`} />
        <meta property="og:image" content="https://syrian.zone/assets/thumbnail.jpg" />
      </Head>
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link
            href="/spotify"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            كل الأغاني
          </Link>

          <div className="mb-6">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ListMusic className="h-4 w-4" />
              قائمة تشغيل
            </p>
            {isOwner ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="max-w-xs text-lg font-bold"
                  aria-label="اسم القائمة"
                />
                <Button size="sm" onClick={saveName} disabled={busy || !name.trim() || name.trim() === savedName}>
                  حفظ
                </Button>
              </div>
            ) : (
              <h1 className="text-2xl font-black">{savedName}</h1>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {items.length === 1 ? 'أغنية واحدة' : `${items.length} أغانٍ`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => play(items, 0)} disabled={items.length === 0}>
                <Play className="me-1 h-4 w-4 fill-current" />
                تشغيل الكل
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(`${window.location.origin}/spotify/playlist/${playlist.slug}`, 'تم نسخ رابط القائمة')
                }
              >
                <Copy className="me-1 h-4 w-4" />
                نسخ الرابط
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
              هذه القائمة فارغة
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {items.map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  isCurrent={current?.id === song.id}
                  isPlaying={playing}
                  onPlay={() => handlePlay(i)}
                  withMenu={!isOwner}
                  trailing={
                    isOwner ? (
                      <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={busy || i === 0}
                          onClick={() => move(i, -1)}
                          aria-label="تحريك للأعلى"
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={busy || i === items.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label="تحريك للأسفل"
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => remove(i)}
                          aria-label="إزالة من القائمة"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        <PlayerBar />
        <Toaster />
      </div>
    </MainLayout>
  );
}
