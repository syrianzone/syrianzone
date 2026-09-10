import React, { useEffect, useState } from 'react';
import { Bookmark, Loader2, Trash2 } from 'lucide-react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import { SURA_NAMES_AR } from '../_lib/quran';
import { readGuestBookmarks, toggleGuestBookmark } from '../_lib/guestBookmarks';
import { useMuslimNav } from '../_lib/nav';

interface SavedAyah {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  created_at?: string;
}

interface Props {
  isLoggedIn: boolean;
  onJump: (page: number, ayahKey: string) => void;
}

// Saved Ayahs: open, jump back into reading, or remove. Opened from the
// navbar (mobile) or the reader top row (PC) via the shared nav store.
export default function BookmarksModal({ isLoggedIn, onJump }: Props) {
  const open = useMuslimNav((s) => s.bookmarksOpen);
  const setOpen = useMuslimNav((s) => s.setBookmarksOpen);
  const [items, setItems] = useState<SavedAyah[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!isLoggedIn) {
      // Guests read their device list (synced to the account on login).
      setItems(readGuestBookmarks());
      return;
    }
    let live = true;
    setLoading(true);
    axios.get('/api/v1/quran-bookmarks')
      .then((r) => {
        if (live) setItems((r.data?.bookmarks ?? []) as SavedAyah[]);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [open, isLoggedIn]);

  const remove = async (b: SavedAyah) => {
    const key = `${b.surah}:${b.ayah}`;
    if (!isLoggedIn) {
      toggleGuestBookmark({ surah: b.surah, ayah: b.ayah, page: b.page, juz: b.juz });
      setItems((prev) => prev.filter((x) => !(x.surah === b.surah && x.ayah === b.ayah)));
      return;
    }
    setRemoving(key);
    try {
      await axios.delete(`/api/v1/quran-bookmarks/${b.surah}/${b.ayah}`);
      setItems((prev) => prev.filter((x) => !(x.surah === b.surah && x.ayah === b.ayah)));
    } catch {
      // silent
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="max-h-[80dvh] overflow-hidden sm:max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" /> علامات الآيات
          </DialogTitle>
          <DialogDescription>اضغط على علامة للعودة إلى موضعها في القراءة</DialogDescription>
        </DialogHeader>
        {!isLoggedIn && items.length > 0 && (
          <p className="-mt-1 text-center text-[11px] text-muted-foreground">
            محفوظة على هذا الجهاز — <a href="/auth/google" className="font-semibold text-primary hover:underline">سجّل الدخول</a> لمزامنتها.
          </p>
        )}
        {!isLoggedIn && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا علامات بعد — اضغط على أي آية ثم على زر العلامة لحفظها على هذا الجهاز.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا علامات بعد — اضغط على أي آية ثم على زر العلامة لحفظها.
          </p>
        ) : (
          <div className="-mx-1 max-h-[55dvh] space-y-1 overflow-y-auto px-1 py-1">
            {items.map((b) => {
              const key = `${b.surah}:${b.ayah}`;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 p-2.5"
                >
                  <button
                    className="min-w-0 flex-1 text-right"
                    onClick={() => {
                      setOpen(false);
                      onJump(b.page, key);
                    }}
                  >
                    <span className="block truncate text-sm font-bold">
                      {SURA_NAMES_AR[b.surah] ?? `سورة ${b.surah}`} · آية {b.ayah}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                      صفحة {b.page} · جزء {b.juz}
                    </span>
                  </button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title="إزالة العلامة"
                    disabled={removing === key}
                    onClick={() => void remove(b)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
