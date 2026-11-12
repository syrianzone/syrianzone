import { create } from 'zustand';

// App-shell UI state: the one place that knows whether the global search, the
// page-scoped dialogs the navbar opens and the Quran reader's focus mode are
// open. It lives in `Lib/` because the shell (Navbar, MainLayout, the command
// palette) drives these and must never import a page folder to do it.
interface AppShellState {
  /** Global command palette (Ctrl/Cmd+K, navbar search button) visibility. */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** Saved-bookmarks modal visibility (navbar button + reader top row). */
  bookmarksOpen: boolean;
  setBookmarksOpen: (open: boolean) => void;
  /** Homepage settings dialog (navbar gear instead of the hamburger on `/`). */
  homeSettingsOpen: boolean;
  setHomeSettingsOpen: (open: boolean) => void;
  /** Roznama settings modal visibility (navbar gear on `/roznama`). */
  roznamaSettingsOpen: boolean;
  setRoznamaSettingsOpen: (open: boolean) => void;
  /** Prayer settings dialog (navbar gear on `/muslim/prayer`). */
  muslimPrayerSettingsOpen: boolean;
  setMuslimPrayerSettingsOpen: (open: boolean) => void;
  /** Quran reader focus mode — hides the navbar and chrome to enlarge text. */
  quranFocus: boolean;
  setQuranFocus: (focus: boolean) => void;
  /**
   * Focus function of the search field a page renders inline (the homepage),
   * or null when the current page has none. The page registers it on mount so
   * the global shortcut can honour it without knowing any DOM ids.
   */
  inlineSearchFocus: (() => void) | null;
  registerInlineSearch: (focus: (() => void) | null) => void;
}

export const useAppShell = create<AppShellState>((set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  bookmarksOpen: false,
  setBookmarksOpen: (bookmarksOpen) => set({ bookmarksOpen }),
  homeSettingsOpen: false,
  setHomeSettingsOpen: (homeSettingsOpen) => set({ homeSettingsOpen }),
  roznamaSettingsOpen: false,
  setRoznamaSettingsOpen: (roznamaSettingsOpen) => set({ roznamaSettingsOpen }),
  muslimPrayerSettingsOpen: false,
  setMuslimPrayerSettingsOpen: (muslimPrayerSettingsOpen) => set({ muslimPrayerSettingsOpen }),
  quranFocus: false,
  setQuranFocus: (quranFocus) => set({ quranFocus }),
  inlineSearchFocus: null,
  registerInlineSearch: (inlineSearchFocus) => set({ inlineSearchFocus }),
}));

/**
 * Hand the search shortcut to the page's inline search field. Returns false
 * when the current page has no inline search, so the caller opens the palette
 * instead.
 */
export function focusInlineSearch(): boolean {
  const focus = useAppShell.getState().inlineSearchFocus;
  if (!focus) return false;
  focus();
  return true;
}
