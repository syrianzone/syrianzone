import React, { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Bookmark, ChevronLeft, MoonStar, Sparkles } from 'lucide-react';
import axios from '@/Lib/axios';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent } from '@/Components/ui/card';
import { MuslimIcon, QuranIcon } from '@/Components/Icons/ProjectIcons';
import BookmarksModal from './_components/BookmarksModal';
import PrayerTab from './_components/PrayerTab';
import QuranReader from './_components/QuranReader';
import { PRAYER_KEYS, PRAYER_LABELS, type PrayerKey } from './_lib/methods';
import { DEFAULT_RECITER_ID, SURA_NAMES_AR } from './_lib/quran';
import { prayerQueryParams, useMuslimPrefs } from './_lib/prefs';
import { initialMuslimView, syncMuslimUrl, useMuslimNav, type MuslimView } from './_lib/nav';

const TOOLS: Array<{
  id: Exclude<MuslimView, 'index'>;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'prayer',
    title: 'مواقيت الصلاة',
    icon: MuslimIcon,
  },
  {
    id: 'quran',
    title: 'قارئ القرآن',
    icon: QuranIcon,
  },
];

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

interface LastBookmark {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
}

export default function Index() {
  const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();
  const view = useMuslimNav((s) => s.view);
  const setView = useMuslimNav((s) => s.setView);
  const setTargetAyah = useMuslimNav((s) => s.setTargetAyah);
  // Sticky navbar height (h-16 + border) for the mobile 100dvh lock.
  const [navH, setNavH] = useState(65);

  // Index top strip: next prayer countdown + Hijri date.
  const [now, setNow] = useState(() => new Date());
  const [timings, setTimings] = useState<Record<string, string> | null>(null);
  const [hijri, setHijri] = useState<string | null>(null);
  const [lastBookmark, setLastBookmark] = useState<LastBookmark | null>(null);

  useEffect(() => {
    setView(initialMuslimView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const measure = () => {
      const h = document.querySelector('header')?.getBoundingClientRect().height;
      if (h) setNavH(Math.round(h));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (view !== 'index') return;
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [view]);

  useEffect(() => {
    if (view !== 'index') return;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(prayerQueryParams(prefs))) params.set(k, String(v));
    fetch(`/api/prayer-times?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setTimings(data.timings ?? null);
        const h = data.hijri;
        setHijri(h?.day && h?.month && h?.year ? `${h.day} ${h.month} ${h.year}` : null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [view, prefs.city, prefs.useCustomCoords, prefs.customLat, prefs.customLon, prefs.method, prefs.locMode, prefs.geo]);

  useEffect(() => {
    if (view !== 'index' || !isLoggedIn) {
      if (!isLoggedIn) setLastBookmark(null);
      return;
    }
    let live = true;
    axios.get('/api/v1/quran-bookmarks').then((r) => {
      if (!live) return;
      const list = (r.data?.bookmarks ?? []) as LastBookmark[];
      setLastBookmark(list[0] ?? null);
    }).catch(() => {});
    return () => { live = false; };
  }, [view, isLoggedIn]);

  const nextPrayer = useMemo(() => {
    if (!timings) return null;
    const cands: { key: PrayerKey; at: Date }[] = [];
    for (const key of PRAYER_KEYS) {
      if (key === 'Sunrise') continue;
      const raw = timings[key];
      if (!raw) continue;
      const [h, m] = raw.slice(0, 5).split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      if (at > now) cands.push({ key: key as PrayerKey, at });
    }
    cands.sort((a, b) => a.at.getTime() - b.at.getTime());
    return cands[0] ?? null;
  }, [timings, now]);

  const open = (v: MuslimView) => {
    setView(v);
    syncMuslimUrl(v);
    window.scrollTo({ top: 0 });
  };

  const jumpToBookmark = (page: number, ayahKey: string) => {
    setPrefs({ quranPage: page });
    setTargetAyah(ayahKey);
    open('quran');
  };

  return (
    <MainLayout>
      <Head>
        <title>الركن الإسلامي | Syrian Zone</title>
        <meta
          name="description"
          content="الركن الإسلامي: مواقيت الصلاة حسب مدينتك وطريقة الحساب، وقارئ القرآن بالرسم العثماني مع التلاوة الصوتية والعلامات."
        />
        <meta property="og:title" content="الركن الإسلامي | Syrian Zone" />
        <meta
          property="og:description"
          content="مواقيت الصلاة، وقارئ القرآن بالرسم العثماني مع التلاوة والعلامات — يعمل دون اتصال."
        />
        <link rel="preload" href="/fonts/quran-hafs.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </Head>

      <div
        className={`text-foreground ${view === 'quran' ? '' : 'min-h-screen'}`}
        dir="rtl"
        style={{ fontFamily: 'var(--site-font, inherit)' }}
      >
        {view === 'index' && (
          <div className="container mx-auto max-w-3xl px-4 py-6">
            <div className="mb-5 text-center">
              <h1 className="mb-1 text-2xl font-bold md:text-3xl">الركن الإسلامي</h1>
              <p className="text-sm text-muted-foreground">أدواتك اليومية في مكان واحد</p>
            </div>

            {/* Time till next prayer + Hijri date. */}
            <button
              onClick={() => open('prayer')}
              className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right transition-colors hover:bg-primary/10"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <MoonStar className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {nextPrayer ? `صلاة ${PRAYER_LABELS[nextPrayer.key]}` : 'مواقيت الصلاة'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {hijri ? `${hijri} هـ` : '…'}
                  </span>
                </span>
              </span>
              <span dir="ltr" className="shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
                {nextPrayer ? formatDuration(nextPrayer.at.getTime() - now.getTime()) : '--:--:--'}
              </span>
            </button>

            {/* Last Quran bookmark: quick access back into reading. */}
            {lastBookmark && (
              <button
                onClick={() => jumpToBookmark(lastBookmark.page, `${lastBookmark.surah}:${lastBookmark.ayah}`)}
                className="mb-4 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-right transition-colors hover:border-primary/40"
              >
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Bookmark className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted-foreground">آخر علامة — تابع القراءة</span>
                  <span className="block truncate text-sm font-bold">
                    {SURA_NAMES_AR[lastBookmark.surah] ?? `سورة ${lastBookmark.surah}`} · آية {lastBookmark.ayah} · صفحة {lastBookmark.page}
                  </span>
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            {/* App-grid tools: icon above, text under, 3 per line. */}
            <div className="grid grid-cols-3 gap-3">
              {TOOLS.map((t) => (
                <Card
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') open(t.id);
                  }}
                  className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    <t.icon className="h-10 w-10" />
                    <span className="text-xs font-bold sm:text-sm">{t.title}</span>
                  </CardContent>
                </Card>
              ))}
              <Card className="opacity-50" aria-disabled="true">
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <span className="rounded-2xl bg-muted p-2.5 text-muted-foreground">
                    <Sparkles className="h-6 w-6" />
                  </span>
                  <span className="text-xs font-bold text-muted-foreground sm:text-sm">قريباً</span>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {view === 'prayer' && (
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <PrayerTab prefs={prefs} setPrefs={setPrefs} isLoggedIn={isLoggedIn} />
          </div>
        )}

        {view === 'quran' && (
          <div
            className="h-[calc(100dvh-var(--muslim-nav,65px))] overflow-hidden"
            style={{ '--muslim-nav': `${navH}px` } as React.CSSProperties}
          >
            <div className="container mx-auto h-full max-w-6xl px-4 py-3">
              <QuranReader
                page={prefs.quranPage}
                setPage={(p) => setPrefs({ quranPage: p })}
                isLoggedIn={isLoggedIn}
                reciterId={prefs.quranReciterId || DEFAULT_RECITER_ID}
                setReciterId={(id) => setPrefs({ quranReciterId: id })}
              />
            </div>
          </div>
        )}

        <BookmarksModal isLoggedIn={isLoggedIn} onJump={jumpToBookmark} />
      </div>
    </MainLayout>
  );
}
