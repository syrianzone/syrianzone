import { listBookmarks } from '@/Domain/quran/bookmarksApi';
import React, { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Bookmark, ChevronLeft, MoonStar } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { formatDuration } from '../../Lib/format';
import { SURAH_NAMES_AR } from '../../Domain/quran/quran';
import { hijriDateLabel } from '../../Domain/prayer/hijri';
import { nextPrayer } from '../../Domain/prayer/nextPrayer';
import { usePrayerTimes } from '../../Domain/prayer/times';
import { useNow } from '../../Domain/prayer/useNow';
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

/**
 * The hub's prayer line. It owns the one-second tick, so only this link
 * re-renders every second (not the whole hub), and it pauses in hidden tabs.
 */
function NextPrayerLink({ timings, timeZone, hijriLabel }: {
  timings: Record<string, string> | null;
  timeZone: string | undefined;
  hijriLabel: string | null;
}) {
  const now = useNow();
  // The hub lists the five prayers only, but it still rolls over after Isha.
  const upcoming = now ? nextPrayer(timings, now, { includeSunrise: false, timeZone }) : null;

  return (
    <Link
      href={toolHref('prayer')}
      className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-start no-underline transition-colors hover:bg-primary/10"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <MoonStar className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">
            {upcoming ? `صلاة ${upcoming.label}` : 'مواقيت الصلاة'}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {hijriLabel ? `${hijriLabel} هـ` : '…'}
          </span>
        </span>
      </span>
      <span dir="ltr" className="shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
        {upcoming ? formatDuration(upcoming.remainingMs) : '--:--:--'}
      </span>
    </Link>
  );
}

export default function Index() {
  const { prefs, isLoggedIn } = useMuslimPrefs();
  const location = useLocationPreference();
  const setTargetAyah = useQuranTarget((s) => s.setTargetAyah);

  const [lastBookmark, setLastBookmark] = useState<LastBookmark | null>(null);
  const { timings, hijri, timeZone } = usePrayerTimes(location, prefs.method, { timeoutMs: null });
  const apiHijri = hijriDateLabel(hijri);

  useEffect(() => {
    if (!isLoggedIn) {
      setLastBookmark(null);
      return;
    }
    let live = true;
    listBookmarks().then((list) => {
      if (!live) return;
      const first: LastBookmark | undefined = list[0];
      setLastBookmark(first ?? null);
    }).catch(() => {
      // the hub's bookmark line is a nicety; the reader owns the real list
    });
    return () => { live = false; };
  }, [isLoggedIn]);

  const quranWarmProps = {
    onPointerEnter: warmQuranData,
    onFocus: warmQuranData,
    onTouchStart: warmQuranData,
  };

  return (
    <MainLayout>
      <div
        className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground"
        dir="rtl"
        style={{ fontFamily: 'var(--site-font, inherit)' }}
      >
        <PageBody className="space-y-5">
          <PageHeader
            title="الركن الإسلامي"
            description="أدواتك اليومية من مواقيت الصلاة والقرآن الكريم والإذاعات وإمساكية رمضان في مكان واحد."
            divider
          />

          <div className="space-y-3">
            <NextPrayerLink timings={timings} timeZone={timeZone} hijriLabel={apiHijri} />

            <Link
              href={toolHref('ramadan')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start no-underline transition-colors hover:border-primary/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">
                  إمساكية رمضان 1448 هـ / 2027 م
                </span>
                <span className="block text-xs text-muted-foreground">
                  مواعيد الإمساك والفجر والإفطار لجميع المحافظات السورية
                </span>
              </span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>

            {lastBookmark && (
              <Link
                href={toolHref('quran')}
                onClick={() => setTargetAyah(`${lastBookmark.surah}:${lastBookmark.ayah}`)}
                {...quranWarmProps}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start no-underline transition-colors hover:border-primary/40"
              >
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted-foreground">آخر علامة — تابع القراءة</span>
                  <span className="block truncate text-sm font-bold">
                    {SURAH_NAMES_AR[lastBookmark.surah] ?? `سورة ${lastBookmark.surah}`} · آية {lastBookmark.ayah} · صفحة {lastBookmark.page}
                  </span>
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            )}
          </div>

          {/* App-grid tools: icon above, text under — the homepage's borderless
              tile shape. Each card is a real link to its own URL under /muslim. */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5 pt-2">
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
        </PageBody>
      </div>
    </MainLayout>
  );
}
