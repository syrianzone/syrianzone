import { create } from 'zustand';

// Sub-view state for /muslim: a tools index with prayer + quran tools.
// The navbar reads this to swap the hamburger for a back button.
export type MuslimView = 'index' | 'prayer' | 'quran';

interface MuslimNavState {
  view: MuslimView;
  setView: (view: MuslimView) => void;
  /** Saved-bookmarks modal visibility (navbar button on mobile). */
  bookmarksOpen: boolean;
  setBookmarksOpen: (open: boolean) => void;
  /** "sura:aya" to land on after jumping from a bookmark. */
  targetAyah: string | null;
  setTargetAyah: (key: string | null) => void;
}

export const useMuslimNav = create<MuslimNavState>((set) => ({
  view: 'index',
  setView: (view) => set({ view }),
  bookmarksOpen: false,
  setBookmarksOpen: (bookmarksOpen) => set({ bookmarksOpen }),
  targetAyah: null,
  setTargetAyah: (targetAyah) => set({ targetAyah }),
}));

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
