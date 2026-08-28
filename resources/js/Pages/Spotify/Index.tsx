import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { Bookmark, ListMusic, ListPlus, X } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Toaster } from '@/Components/ui/sonner';
import { cn } from '@/lib/utils';
import CreatePlaylistDialog from './_components/CreatePlaylistDialog';
import PlayerBar from './_components/PlayerBar';
import SongRow from './_components/SongRow';
import { useCurrentSong, usePlayerStore } from './_lib/playerStore';
import type { SongSummary } from './types';

interface SpotifyIndexProps {
  songs: SongSummary[];
}

export default function SpotifyIndex({ songs }: SpotifyIndexProps) {
  // guests can listen and share links; creating playlists needs a signed-in user
  const user = usePage<{ auth?: { user: { id: number } | null } }>().props.auth?.user ?? null;
  const current = useCurrentSong();
  const playing = usePlayerStore((s) => s.playing);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);

  const [selectMode, setSelectMode] = useState(false);
  // selection order becomes the playlist order
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const savedIds = usePlayerStore((s) => s.savedIds);
  const [savedOnly, setSavedOnly] = useState(false);
  const hasSaved = songs.some((s) => savedIds.includes(s.id));
  // unsaving the last track drops the filter instead of stranding an empty list;
  // select mode always offers the full catalog
  const showSavedOnly = savedOnly && hasSaved && !selectMode;
  const visibleSongs = showSavedOnly ? songs.filter((s) => savedIds.includes(s.id)) : songs;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  // the visible (possibly filtered) list becomes the queue
  const handlePlay = (i: number) => {
    if (current?.id === visibleSongs[i].id) toggle();
    else play(visibleSongs, i);
  };

  return (
    <MainLayout>
      {/* share/og meta is server-rendered in app.blade.php: crawlers do not run js */}
      <Head>
        <title>أناشيد | Syrian Zone</title>
      </Head>
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black">
                <ListMusic className="h-7 w-7 text-primary" />
                أناشيد
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                استمع مباشرة، تابع الكلمات المتزامنة، وأنشئ قوائم تشغيل وشاركها
              </p>
            </div>
            {songs.length > 0 &&
              user &&
              (selectMode ? (
                <Button variant="outline" size="sm" onClick={exitSelectMode}>
                  <X className="me-1 h-4 w-4" />
                  إلغاء التحديد
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
                  <ListPlus className="me-1 h-4 w-4" />
                  إنشاء قائمة تشغيل
                </Button>
              ))}
          </div>

          {selectMode && (
            <p className="mb-3 text-xs text-muted-foreground">
              اختر الأغاني بالترتيب الذي تريده في القائمة
            </p>
          )}

          {hasSaved && !selectMode && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                variant={showSavedOnly ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setSavedOnly((v) => !v)}
                aria-pressed={showSavedOnly}
              >
                <Bookmark className={cn('me-1 h-4 w-4', showSavedOnly && 'fill-current')} />
                المحفوظة
              </Button>
            </div>
          )}

          {songs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
              لا توجد أغانٍ بعد، عد قريباً
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {visibleSongs.map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  isCurrent={current?.id === song.id}
                  isPlaying={playing}
                  onPlay={() => handlePlay(i)}
                  selectable={selectMode}
                  selected={selectedIds.includes(song.id)}
                  onToggleSelect={() => toggleSelect(song.id)}
                />
              ))}
            </div>
          )}
        </div>

        {selectMode && selectedIds.length > 0 && (
          <Button
            size="lg"
            className={cn(
              'fixed left-1/2 z-40 -translate-x-1/2 rounded-full shadow-xl',
              current ? 'bottom-32' : 'bottom-6'
            )}
            onClick={() => setDialogOpen(true)}
          >
            <ListPlus className="me-1 h-5 w-5" />
            {selectedIds.length === 1 ? 'إنشاء قائمة (أغنية واحدة)' : `إنشاء قائمة (${selectedIds.length})`}
          </Button>
        )}

        <PlayerBar />
        <CreatePlaylistDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          songIds={selectedIds}
          onCreated={exitSelectMode}
        />
        <Toaster />
      </div>
    </MainLayout>
  );
}
