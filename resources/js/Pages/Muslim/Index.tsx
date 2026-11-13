import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Bookmark, ChevronLeft, MoonStar } from 'lucide-react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { formatDuration } from '../../Lib/format';
import { SURAH_NAMES_AR } from '../../Domain/quran/quran';
import { hijriDateLabel } from '../../Domain/prayer/hijri';
import { nextPrayer } from '../../Domain/prayer/nextPrayer';
import { usePrayerTimes } from '../../Domain/prayer/times';
import { useLocationPreference } from '../../Domain/location/preference';
import { useMuslimPrefs } from '../../Domain/settings/prefs';
import { TOOLS, toolHref } from '../../Domain/muslim/tools';
import { useQuranTarget } from '@/Domain/quran/targetAyah';

interface LastBookmark {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
}

const QURAN_DATA_URL = '/quran-data/mushaf-unified.json';

// The mushaf file is ~1.8 MB (443 KB gzipped) and most hub visitors never open
// the reader, so warm it only when the visitor shows intent to follow a link
// into the reader — not on every visit to the hub. Runs once per page load.
let quranDataWarmed = false;

function warmQuranData(): void {
  if (quranDataWarmed || typeof document === 'undefined') return;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  quranDataWarmed = true;
  if (document.head.querySelector(`link[rel="prefetch"][href="${QURAN_DATA_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'fetch';
  link.crossOrigin = 'anonymous';
  link.href = QURAN_DATA_URL;
  document.head.appendChild(link);
}

export default function Index() {
  const { prefs, isLoggedIn } = useMuslimPrefs();
  const location = useLocationPreference();
  const setTargetAyah = useQuranTarget((s) => s.setTargetAyah);

  // Index top strip: next prayer countdown + Hijri date.
  const [now, setNow] = useState(() => new Date());
  const [lastBookmark, setLastBookmark] = useState<LastBookmark | null>(null);
  const { timings, hijri } = usePrayerTimes(location, prefs.method, { timeoutMs: null });
  const apiHijri = hijriDateLabel(hijri);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setLastBookmark(null);
      return;
    }
    let live = true;
    axios.get('/api/v1/quran-bookmarks').then((r) => {
      if (!live) return;
      const list = (r.data?.bookmarks ?? []) as LastBookmark[];
      setLastBookmark(list[0] ?? null);
    }).catch(() => {});
    return () => { live = false; };
  }, [isLoggedIn]);

  // The hub lists the five prayers only, but it still rolls over after Isha.
  const upcoming = useMemo(() => nextPrayer(timings, now, { includeSunrise: false }), [timings, now]);

  // Warm the reader's data file as soon as the visitor aims at a link into it.
  const quranWarmProps = {
    onPointerEnter: warmQuranData,
    onFocus: warmQuranData,
    onTouchStart: warmQuranData,
  };

  return (
    <MainLayout>
      <Head>
        
        
        
        
        <link rel="preload" href="/fonts/quran-hafs.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </Head>

      <div
        className="min-h-[calc(100svh-4rem-1px)] bg-background text-foreground"
        dir="rtl"
        style={{ fontFamily: 'var(--site-font, inherit)' }}
      >
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="mb-5 text-center">
            <h1 className="mb-1 text-2xl font-bold md:text-3xl">الركن الإسلامي</h1>
            <p className="text-sm text-muted-foreground">أدواتك اليومية في مكان واحد</p>
          </div>

          {/* Time till next prayer + Hijri date. */}
          <Link
            href={toolHref('prayer')}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right no-underline transition-colors hover:bg-primary/10"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <MoonStar className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {upcoming ? `صلاة ${upcoming.label}` : 'مواقيت الصلاة'}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {apiHijri ? `${apiHijri} هـ` : '…'}
                </span>
              </span>
            </span>
            <span dir="ltr" className="shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
              {upcoming ? formatDuration(upcoming.remainingMs) : '--:--:--'}
            </span>
          </Link>

          {/* Last Quran bookmark: quick access back into reading. */}
          {lastBookmark && (
            <Link
              href={toolHref('quran')}
              onClick={() => setTargetAyah(`${lastBookmark.surah}:${lastBookmark.ayah}`)}
              {...quranWarmProps}
              className="mb-4 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-right no-underline transition-colors hover:border-primary/40"
            >
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Bookmark className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-muted-foreground">آخر علامة — تابع القراءة</span>
                <span className="block truncate text-sm font-bold">
                  {SURAH_NAMES_AR[lastBookmark.surah] ?? `سورة ${lastBookmark.surah}`} · آية {lastBookmark.ayah} · صفحة {lastBookmark.page}
                </span>
              </span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}

          {/* App-grid tools: icon above, text under — the homepage's borderless
              tile shape. Each card is a real link to its own URL under /muslim. */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5">
            {TOOLS.map((t) => (
              <Link
                key={t.slug}
                href={toolHref(t.slug)}
                {...(t.slug === 'quran' ? quranWarmProps : {})}
                className="group flex flex-col items-center gap-2 py-1 text-center no-underline"
              >
                <t.icon className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
                <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                  {t.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
