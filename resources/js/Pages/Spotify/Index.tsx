import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { ListMusic, ListPlus, X } from 'lucide-react';
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
  const current = useCurrentSong();
  const playing = usePlayerStore((s) => s.playing);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);

  const [selectMode, setSelectMode] = useState(false);
  // selection order becomes the playlist order
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  const handlePlay = (i: number) => {
    if (current?.id === songs[i].id) toggle();
    else play(songs, i);
  };

  return (
    <MainLayout>
      <Head>
        <title>الموسيقى | Syrian Zone</title>
        <meta name="description" content="استمع إلى أغانٍ سورية مع كلمات متزامنة، وأنشئ قوائم تشغيل وشاركها مع أصدقائك." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="الموسيقى | Syrian Zone" />
        <meta property="og:description" content="استمع إلى أغانٍ سورية مع كلمات متزامنة، وأنشئ قوائم تشغيل وشاركها مع أصدقائك." />
        <meta property="og:image" content="https://syrian.zone/assets/thumbnail.jpg" />
      </Head>
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black">
                <ListMusic className="h-7 w-7 text-primary" />
                الموسيقى
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                استمع مباشرة، تابع الكلمات المتزامنة، وأنشئ قوائم تشغيل وشاركها
              </p>
            </div>
            {songs.length > 0 &&
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

          {songs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
              لا توجد أغانٍ بعد، عد قريباً
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {songs.map((song, i) => (
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
