import { create } from 'zustand';
import { useEffect, useState } from 'react';

// Sub-view state for /muslim: a tools index with prayer + quran tools.
// The navbar reads this to swap the hamburger for a back button.
export type MuslimView = 'index' | 'prayer' | 'quran';

interface MuslimNavState {
  view: MuslimView;
  setView: (view: MuslimView) => void;
  /** Saved-bookmarks modal visibility (navbar button on mobile). */
  bookmarksOpen: boolean;
  setBookmarksOpen: (open: boolean) => void;
  /** Roznama settings modal visibility (navbar gear on /roznama). */
  roznamaSettingsOpen: boolean;
  setRoznamaSettingsOpen: (open: boolean) => void;
  /** Muslim prayer settings dialog (navbar gear on prayer view). */
  muslimPrayerSettingsOpen: boolean;
  setMuslimPrayerSettingsOpen: (open: boolean) => void;
  /** Homepage settings dialog (navbar gear instead of hamburger on /). */
  homeSettingsOpen: boolean;
  setHomeSettingsOpen: (open: boolean) => void;
  /** "sura:aya" to land on after jumping from a bookmark. */
  targetAyah: string | null;
  setTargetAyah: (key: string | null) => void;
  /** Quran reader focus mode — hides navbar + chrome to enlarge text. */
  quranFocus: boolean;
  setQuranFocus: (focus: boolean) => void;
}

export const useMuslimNav = create<MuslimNavState>((set) => ({
  view: 'index',
  setView: (view) => set({ view }),
  bookmarksOpen: false,
  setBookmarksOpen: (bookmarksOpen) => set({ bookmarksOpen }),
  roznamaSettingsOpen: false,
  setRoznamaSettingsOpen: (roznamaSettingsOpen) => set({ roznamaSettingsOpen }),
  muslimPrayerSettingsOpen: false,
  setMuslimPrayerSettingsOpen: (muslimPrayerSettingsOpen) => set({ muslimPrayerSettingsOpen }),
  homeSettingsOpen: false,
  setHomeSettingsOpen: (homeSettingsOpen) => set({ homeSettingsOpen }),
  targetAyah: null,
  setTargetAyah: (targetAyah) => set({ targetAyah }),
  quranFocus: false,
  setQuranFocus: (quranFocus) => set({ quranFocus }),
}));

/** Mobile breakpoint mirror (matches Tailwind's max-sm) for picking
 *  Sheet-bottom vs Dialog-center settings containers. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
/** Initial view from the URL (?tab=prayer|quran), defaulting to the index. */
export function initialMuslimView(): MuslimView {
  if (typeof window === 'undefined') return 'index';
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'prayer' || t === 'quran' ? t : 'index';
}

/** Cosmetic URL sync (no navigation — the navbar reads the store). */
export function syncMuslimUrl(view: MuslimView): void {
  if (typeof window === 'undefined') return;
  const url = view === 'index' ? '/muslim' : `/muslim?tab=${view}`;
  window.history.replaceState(null, '', url);
}
