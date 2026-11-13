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
  /**
   * The page-owned settings dialog the navbar's gear opens, by id, or null. The
   * page owns the dialog and its form; the shell only knows which trigger
   * belongs to which route, so adding a page adds an id, not a store member.
   */
  pageDialog: PageDialog | null;
  openPageDialog: (dialog: PageDialog | null) => void;
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

/** The page-owned dialogs the navbar can open. */
export type PageDialog = 'home-settings' | 'roznama-settings' | 'muslim-prayer-settings';

export const useAppShell = create<AppShellState>((set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  bookmarksOpen: false,
  setBookmarksOpen: (bookmarksOpen) => set({ bookmarksOpen }),
  pageDialog: null,
  openPageDialog: (pageDialog) => set({ pageDialog }),
  quranFocus: false,
  setQuranFocus: (quranFocus) => set({ quranFocus }),
  inlineSearchFocus: null,
  registerInlineSearch: (inlineSearchFocus) => set({ inlineSearchFocus }),
}));

/**
 * Whether *this page's* dialog is open, plus an `onOpenChange`-shaped setter.
 * Two pages cannot see each other's state, and closing one never closes another.
 */
export function usePageDialog(id: PageDialog): [boolean, (open: boolean) => void] {
  const open = useAppShell((state) => state.pageDialog === id);
  const setPageDialog = useAppShell((state) => state.openPageDialog);
  return [open, (next: boolean) => setPageDialog(next ? id : null)];
}

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
