// Guest Quran bookmarks: localStorage list for non-logged-in users.
// Logged-in users use the server table; on login the guest list is pushed
// (union by surah:ayah, server updateOrCreate wins) and cleared.
export interface GuestBookmark {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  at: number;
}

const LS_KEY = 'sz-muslim-quran-local';
export const GUEST_BOOKMARK_CAP = 50;

export function readGuestBookmarks(): GuestBookmark[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as GuestBookmark[];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b) => Number.isInteger(b?.surah) && Number.isInteger(b?.ayah) && Number.isInteger(b?.page),
    );
  } catch {
    return [];
  }
}

function writeGuestBookmarks(list: GuestBookmark[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, GUEST_BOOKMARK_CAP)));
  } catch {
    // private mode: session-only
  }
}

export function guestBookmarkKeys(): Set<string> {
  return new Set(readGuestBookmarks().map((b) => `${b.surah}:${b.ayah}`));
}

/** Toggle a guest bookmark. Returns true when now saved. */
export function toggleGuestBookmark(b: Omit<GuestBookmark, 'at'>): boolean {
  const list = readGuestBookmarks();
  const key = `${b.surah}:${b.ayah}`;
  const idx = list.findIndex((x) => `${x.surah}:${x.ayah}` === key);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeGuestBookmarks(list);
    return false;
  }
  list.unshift({ ...b, at: Date.now() });
  writeGuestBookmarks(list);
  return true;
}

/** Push the guest list to the account; keeps only what failed to save. */
export async function pushGuestBookmarks(
  post: (b: GuestBookmark) => Promise<unknown>,
): Promise<{ pushed: number; failed: number }> {
  const list = readGuestBookmarks();
  let pushed = 0;
  const leftover: GuestBookmark[] = [];
  for (const b of list) {
    try {
      await post(b);
      pushed += 1;
    } catch {
      leftover.push(b);
    }
  }
  writeGuestBookmarks(leftover);
  return { pushed, failed: leftover.length };
}
