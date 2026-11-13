import { useEffect, useRef } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import BookmarksModal from '../_components/BookmarksModal';
import QuranReader from '../_components/QuranReader';
import { DEFAULT_RECITATION_CODE, findPageForAyah } from '../../../Domain/quran/quran';
import { useMuslimPrefs } from '../../../Domain/settings/prefs';
import { useAppShell } from '@/Lib/appShell';
import { useQuranTarget } from '@/Domain/quran/targetAyah';

export default function Index() {
  const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();
  const targetAyah = useQuranTarget((s) => s.targetAyah);
  const setTargetAyah = useQuranTarget((s) => s.setTargetAyah);
  const quranFocus = useAppShell((s) => s.quranFocus);
  // The reader fills the viewport under the navbar, which publishes its height
  // as `--sz-navbar-h`; focus mode hides the navbar and takes the whole height.
  const readerHeight = quranFocus ? '100dvh' : 'calc(100dvh - var(--sz-navbar-h))';

  // Deep link from the hub's last-bookmark strip or the radio's "continue":
  // make sure the page that holds the target ayah is shown. In-page jumps
  // already set the page, so this resolves to the same page and is a no-op.
  const resolved = useRef<string | null>(null);
  useEffect(() => {
    if (!targetAyah || resolved.current === targetAyah) return;
    resolved.current = targetAyah;
    const [surah, ayah] = targetAyah.split(':').map(Number);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;
    void findPageForAyah(surah, ayah).then((p) => {
      if (p) setPrefs({ quranPage: p });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAyah]);

  const jumpToBookmark = (page: number, ayahKey: string) => {
    setPrefs({ quranPage: page });
    setTargetAyah(ayahKey);
  };

  return (
    <MainLayout>
      <Head>
        
        
        
        
        <link rel="preload" href="/fonts/quran-hafs.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="prefetch" href="/quran-data/mushaf-unified.json" as="fetch" crossOrigin="anonymous" />
      </Head>
      <h1 className="sr-only">قارئ القرآن</h1>

      <div dir="rtl" className="text-foreground" style={{ fontFamily: 'var(--site-font, inherit)' }}>
        <div
          className="overflow-hidden"
          style={{ height: readerHeight }}
        >
          <div className={`container mx-auto h-full max-w-6xl px-4 ${quranFocus ? 'py-1' : 'py-3'}`}>
            <QuranReader
              page={prefs.quranPage}
              setPage={(p) => setPrefs({ quranPage: p })}
              isLoggedIn={isLoggedIn}
              reciterCode={prefs.quranReciterId || DEFAULT_RECITATION_CODE}
              setReciterCode={(code) => setPrefs({ quranReciterId: code })}
            />
          </div>
        </div>

        <BookmarksModal isLoggedIn={isLoggedIn} onJump={jumpToBookmark} />
      </div>
    </MainLayout>
  );
}
