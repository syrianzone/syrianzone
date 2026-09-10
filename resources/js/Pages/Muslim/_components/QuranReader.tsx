import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Loader2, Maximize, Minimize } from 'lucide-react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import AudioPlayer from './AudioPlayer';
import MushafPage from './MushafPage';
import { guestBookmarkKeys, toggleGuestBookmark } from '../_lib/guestBookmarks';
import { syncMuslimUrl, useMuslimNav } from '../_lib/nav';
import {
  SURA_NAMES_AR, TOTAL_PAGES, findPageForVerse, renderMushafPage, type Ayah, type QuranPage,
} from '../_lib/quran';

interface Props {
  page: number;
  setPage: (p: number) => void;
  isLoggedIn: boolean;
  reciterId: string;
  setReciterId: (id: string) => void;
}

function clampPage(p: number): number {
  return Math.min(TOTAL_PAGES, Math.max(1, p));
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

export default function QuranReader({ page, setPage, isLoggedIn, reciterId, setReciterId }: Props) {
  const isDesktop = useIsDesktop();
  const step = isDesktop ? 2 : 1;
  // Desktop spread (RTL: right = page, left = page+1); mobile single page.
  const visiblePages = isDesktop ? [page, page + 1].filter((p) => p <= TOTAL_PAGES) : [page];

  const [isFocused, setIsFocused] = useState(false);
  const [pages, setPages] = useState<QuranPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jump, setJump] = useState('');
  const [fontSize, setFontSize] = useState(() => {
    const v = Number(window.localStorage.getItem('sz-muslim-quran-font') ?? 22);
    return Number.isFinite(v) ? Math.min(30, Math.max(14, v)) : 22;
  });
  // Bookmarked "surah:ayah" keys: server list when logged in, guest
  // device list otherwise (union covers partially-pushed leftovers).
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => guestBookmarkKeys());
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [currentAyahKey, setCurrentAyahKey] = useState<string | null>(null);
  const [playSignal, setPlaySignal] = useState(0);
  const [autoPlayPending, setAutoPlayPending] = useState(false);
  const setView = useMuslimNav((s) => s.setView);
  const setBookmarksOpen = useMuslimNav((s) => s.setBookmarksOpen);
  const targetAyah = useMuslimNav((s) => s.targetAyah);
  const setTargetAyah = useMuslimNav((s) => s.setTargetAyah);

  // Mobile 100vh layout refs (the parent locks the exact remaining height).
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const pagesKey = pages.map((d) => d.page).join(',');

  const go = useCallback((p: number) => {
    setPage(clampPage(p));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setPage]);

  // Madina 15-line pages from the vendored skill database (offline-capable).
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all(visiblePages.map((p) => renderMushafPage(p, fontSize, ctrl.signal)))
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setPages(list);
        const ayat = list.flatMap((d) => d.ayat);
        setCurrentAyahKey((k) => (ayat.some((x) => x.key === k) ? k : (ayat[0]?.key ?? null)));
        
        setAutoPlayPending((pending) => {
          if (pending) setTimeout(() => setPlaySignal((s) => s + 1), 50);
          return false;
        });
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError('تعذر تحميل الصفحة — تحقق من الاتصال ثم أعد المحاولة');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isDesktop, fontSize]);

  // Saved ayahs: server list when logged in, guest device list otherwise
  // (union covers partially-pushed leftovers after a login merge).
  useEffect(() => {
    if (!isLoggedIn) {
      setSavedKeys(guestBookmarkKeys());
      return;
    }
    let live = true;
    axios.get('/api/v1/quran-bookmarks').then((r) => {
      if (!live) return;
      const list = (r.data?.bookmarks ?? []) as { surah: number; ayah: number }[];
      setSavedKeys(new Set([...list.map((b) => `${b.surah}:${b.ayah}`), ...guestBookmarkKeys()]));
    }).catch(() => {
      if (live) setSavedKeys(guestBookmarkKeys());
    });
    return () => { live = false; };
  }, [isLoggedIn]);

  const ayat = pages.flatMap((d) => d.ayat);
  const currentAyah: Ayah | undefined = ayat.find((a) => a.key === currentAyahKey) ?? ayat[0];
  const ayahSaved = currentAyah ? savedKeys.has(currentAyah.key) : false;

  // Landing from a bookmark/modal jump: select the target Ayah once loaded.
  useEffect(() => {
    if (targetAyah && ayat.some((a) => a.key === targetAyah)) {
      setCurrentAyahKey(targetAyah);
      setTargetAyah(null);
    }
  }, [targetAyah, pagesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const backToIndex = () => {
    setView('index');
    syncMuslimUrl('index');
    window.scrollTo({ top: 0 });
  };

  const toggleBookmark = async () => {
    if (bookmarkBusy || !currentAyah) return;
    // Guests keep bookmarks on this device; logged-in users on the account.
    if (!isLoggedIn) {
      const saved = toggleGuestBookmark({
        surah: currentAyah.surah,
        ayah: currentAyah.ayah,
        page: currentAyah.page,
        juz: currentAyah.juz,
      });
      const key = currentAyah.key;
      setSavedKeys((prev) => {
        const next = new Set(prev);
        if (saved) next.add(key);
        else next.delete(key);
        return next;
      });
      return;
    }
    const key = currentAyah.key;
    setBookmarkBusy(true);
    try {
      if (savedKeys.has(key)) {
        await axios.delete(`/api/v1/quran-bookmarks/${currentAyah.surah}/${currentAyah.ayah}`);
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        await axios.post('/api/v1/quran-bookmarks', {
          surah: currentAyah.surah,
          ayah: currentAyah.ayah,
          page: currentAyah.page,
          juz: currentAyah.juz,
        });
        setSavedKeys((prev) => new Set(prev).add(key));
      }
    } catch {
      // silent: button stays in previous state
    } finally {
      setBookmarkBusy(false);
    }
  };

  useEffect(() => {
    window.localStorage.setItem('sz-muslim-quran-font', String(fontSize));
  }, [fontSize]);

  // The viewport takes whatever the header/footer leave; each Mushaf page
  // scales into it (ResizeObserver = self-correcting on any shift).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const apply = () => setMaxHeight(Math.max(160, vp.clientHeight));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [isDesktop, page, pagesKey, fontSize]);

  // Keyboard: h/l page (RTL), [ ] Juz jump (~20 pages).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'ArrowLeft') go(page + step);
      else if (e.key === 'l' || e.key === 'ArrowRight') go(page - step);
      else if (e.key === '[') go(page - 20);
      else if (e.key === ']') go(page + 20);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, page, step]);

  const requestPlay = (key: string) => {
    // First tap highlights the Ayah; tapping the highlighted Ayah plays it.
    if (key === currentAyahKey) {
      setPlaySignal((s) => s + 1);
    } else {
      setCurrentAyahKey(key);
    }
  };

  // Jump box accepts a Page ("100") or a verse ("2:255", "2 255", "البقرة 255").
  const [jumpHint, setJumpHint] = useState<string | null>(null);

  const resolveJump = async (raw: string): Promise<{ page: number; ayahKey: string | null } | null> => {
    const input = raw.trim();
    if (/^\d{1,3}$/.test(input)) return { page: clampPage(Number(input)), ayahKey: null };
    const m = input.match(/^(\d{1,3}|[^\d\s:：\-/]+)\s*[:：\-/ ]\s*(\d{1,3})$/);
    if (!m) return null;
    let surah: number;
    if (/^\d+$/.test(m[1])) {
      surah = Number(m[1]);
    } else {
      const name = m[1].replace(/^(سورة|سوره)\s+/, '').trim();
      surah = SURA_NAMES_AR.indexOf(name);
      if (surah <= 0) return null;
    }
    const ayah = Number(m[2]);
    const page = await findPageForVerse(surah, ayah);
    if (!page) return null;
    return { page, ayahKey: `${surah}:${ayah}` };
  };

  // Single header for the visible spread: Surah name(s) right, Juz left.
  const surahs = [...new Set(pages.map((d) => d.suraName))].join(' · ');
  const juzs = [...new Set(pages.map((d) => d.juz))].join('، ');
  const lastVisible = visiblePages[visiblePages.length - 1] ?? page;
  const pageLabel = isDesktop
    ? (lastVisible > page ? `الصفحتان ${page} و ${lastVisible} من ${TOTAL_PAGES}` : `صفحة ${page} من ${TOTAL_PAGES}`)
    : `صفحة ${page} من ${TOTAL_PAGES}`;

  return (
    <div className="flex h-full flex-col">
      {/* Top row: back to index; bookmarks button here on PC
          (on mobile it lives in the navbar). */}
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
        <Button variant="ghost" size="sm" onClick={backToIndex} className="gap-1 px-2 text-xs text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> رجوع
        </Button>
        <Button
          variant="ghost" size="sm" onClick={() => setBookmarksOpen(true)}
          className="hidden gap-1.5 px-2 text-xs text-muted-foreground lg:inline-flex"
        >
          <Bookmark className="h-4 w-4" /> العلامات
        </Button>
      </div>
      {/* Single plain-text header: bookmark right of the Surah name. */}
      <div className="mb-2 flex shrink-0 items-baseline justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-6 w-6 shrink-0"
            title={
              !currentAyah ? 'اختر آية من الصفحة'
              : ayahSaved ? 'إزالة علامة الآية' : 'حفظ علامة على الآية المحددة'
            }
            disabled={!currentAyah || bookmarkBusy}
            onClick={() => void toggleBookmark()}
          >
            {ayahSaved
              ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
              : <Bookmark className="h-3.5 w-3.5" />}
          </Button>
          <span className="truncate text-sm font-bold text-primary">{surahs}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {juzs && <span className="text-xs text-muted-foreground">الجزء {juzs}</span>}
          {isDesktop && (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                disabled={fontSize >= 30} onClick={() => setFontSize((f) => Math.min(30, f + 1))}>أ+</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                disabled={fontSize <= 14} onClick={() => setFontSize((f) => Math.max(14, f - 1))}>أ−</Button>
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">جاري تحميل الصفحة…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-red-500">
          <AlertCircle className="h-8 w-8" /><p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => go(page)}>إعادة المحاولة</Button>
        </div>
      ) : (
        <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden relative">
          {isFocused && (
            <Button variant="secondary" size="icon" className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity" title="إلغاء وضع التركيز" onClick={() => setIsFocused(false)}>
              <Minimize className="h-5 w-5" />
            </Button>
          )}
          {isDesktop ? (
            <div className="flex flex-row items-start justify-center gap-8" dir="rtl">
              {pages.map((d) => (
                <div key={d.page} className="min-w-0">
                  <MushafPage
                    data={d}
                    currentAyahKey={currentAyahKey}
                    onSelectAyah={requestPlay}
                    maxHeight={maxHeight}
                    savedKeys={savedKeys}
                    onToggleBookmark={toggleBookmark}
                    bookmarkBusy={bookmarkBusy}
                  />
                </div>
              ))}
              {page >= TOTAL_PAGES && (
                <div className="flex min-h-64 items-center justify-center px-10 text-xs text-muted-foreground">
                  نهاية المصحف
                </div>
              )}
            </div>
          ) : (
            pages.slice(0, 1).map((d) => (
              <div key={d.page} className="flex h-full items-center justify-center">
                <MushafPage
                  data={d}
                  currentAyahKey={currentAyahKey}
                  onSelectAyah={requestPlay}
                  maxHeight={maxHeight}
                  savedKeys={savedKeys}
                  onToggleBookmark={toggleBookmark}
                  bookmarkBusy={bookmarkBusy}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Pager under the page(s), with the page numbers. */}
      <div className={`mt-3 flex shrink-0 items-center justify-between gap-2 ${isFocused ? 'hidden' : ''}`}>
        <Button variant="outline" size="sm" onClick={() => go(page - step)} disabled={page <= 1}>
          <ChevronRight className="h-4 w-4" /> السابق
        </Button>
        <div className="flex flex-col items-center gap-1.5">
          <span dir="rtl" className="text-xs font-semibold tabular-nums text-muted-foreground">{pageLabel}</span>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const raw = jump;
              setJump('');
              setJumpHint(null);
              void resolveJump(raw).then((res) => {
                if (!res) {
                  setJumpHint('لم يتم العثور على المطلوب — جرّب رقم صفحة أو آية مثل 2:255');
                  return;
                }
                if (res.ayahKey) setTargetAyah(res.ayahKey);
                go(res.page);
              });
            }}
          >
            <Input value={jump} onChange={(e) => { setJump(e.target.value); setJumpHint(null); }}
              placeholder="صفحة أو آية 2:255"
              inputMode="text" dir="auto" className="h-8 w-32 text-center text-xs" />
            <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs">انتقال</Button>
          </form>
          {jumpHint && <span className="text-[11px] text-destructive">{jumpHint}</span>}
        </div>
        <Button variant="outline" size="sm" onClick={() => go(page + step)} disabled={page >= TOTAL_PAGES}>
          التالي <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      {!isLoggedIn && !isFocused && (
        <p className="mt-3 shrink-0 text-center text-[11px] text-muted-foreground">
          <a href="/auth/google" className="font-semibold text-primary hover:underline">سجّل الدخول</a> لمزامنة علاماتك على حسابك (تُحفظ على هذا الجهاز حالياً).
        </p>
      )}

      <div className={`mt-3 shrink-0 ${isFocused ? 'hidden' : ''}`}>
        <AudioPlayer
          ayat={ayat}
          reciterId={reciterId}
          setReciterId={setReciterId}
          currentKey={currentAyahKey}
          onSelectAyah={setCurrentAyahKey}
          playSignal={playSignal}
          onEndOfList={() => {
            if (page + step <= TOTAL_PAGES) {
              go(page + step);
              setAutoPlayPending(true);
            }
          }}
        />
      </div>
    </div>
  );
}
