import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAccount } from '../account';
import { readDocument, writeDocument } from '../storage';
import { record } from '../validation';
import { useScreenActive } from '../lifecycle';
import { bookmarkKey, decodeBookmarks, toggleGuest, unionBookmarks, type QuranBookmark } from './bookmarks-model';
import { createGuestBookmarkStore } from './bookmark-store';

const KEY = 'syrian-zone.quran-bookmarks.v1';
const guestStore = createGuestBookmarkStore({ read: () => readDocument(KEY, decodeBookmarks, []), write: value => writeDocument(KEY, value) });
export function useQuranBookmarks() {
  const focused = useScreenActive();
  const account = useAccount(), [guest, setGuest] = useState<QuranBookmark[]>([]), [server, setServer] = useState<QuranBookmark[]>([]);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  const currentSession = useRef(account.sessionGeneration), locked = useRef(false);
  const userId = account.user?.id;
  currentSession.current = account.sessionGeneration;
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setReady(false); setServer([]); setError(null);
    const stamp = account.sessionGeneration, controller = new AbortController(); let deviceRead = false;
    void (async () => {
      let local = await guestStore.read();
      if (!active) return;
      deviceRead = true;
      setGuest(local);
      if (userId !== undefined) {
        let mergeError: unknown = null;
        for (const bookmark of local) {
          try {
            await api.request('quran-bookmarks', record, { method: 'POST', authenticated: true, sessionGeneration: stamp, signal: controller.signal, body: bookmark });
            if (!active || stamp !== currentSession.current) return;
            local = await guestStore.mutate(previous => previous.filter(item => bookmarkKey(item) !== bookmarkKey(bookmark))); setGuest(local);
          } catch (reason) { if (!active) return; mergeError = reason; }
        }
        const values = await api.request('quran-bookmarks', value => decodeBookmarks(record(value).bookmarks), { authenticated: true, sessionGeneration: stamp, signal: controller.signal });
        if (active) setServer(values);
        if (mergeError) throw mergeError;
      }
    })().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل العلامات.'); })
      .finally(() => { if (active) setReady(deviceRead); });
    return () => { active = false; controller.abort(); };
  }, [focused, userId, account.sessionGeneration, attempt]);
  const toggle = useCallback(async (item: QuranBookmark): Promise<void> => {
    if (locked.current || !ready) return;
    locked.current = true; setBusy(true); setError(null);
    const stamp = account.sessionGeneration, key = bookmarkKey(item), exists = unionBookmarks(server, guest).some(value => bookmarkKey(value) === key);
    try {
      if (account.user) {
        await api.request(exists ? `quran-bookmarks/${item.surah}/${item.ayah}` : 'quran-bookmarks', record,
          { method: exists ? 'DELETE' : 'POST', authenticated: true, sessionGeneration: stamp, ...(exists ? {} : { body: item }) });
        if (stamp !== currentSession.current) return;
        const local = await guestStore.mutate(previous => previous.filter(value => bookmarkKey(value) !== key)); setGuest(local);
        setServer(previous => exists ? previous.filter(value => bookmarkKey(value) !== key) : [item, ...previous]);
      } else { const local = await guestStore.mutate(previous => toggleGuest(previous, item)); if (stamp === currentSession.current) setGuest(local); }
    } catch (reason) { if (stamp === currentSession.current) setError(reason instanceof Error ? reason.message : 'تعذر حفظ العلامة.'); }
    finally { locked.current = false; setBusy(false); }
  }, [account.user, account.sessionGeneration, ready, server, guest]);
  const items = unionBookmarks(server, guest);
  return { items, keys: new Set(items.map(bookmarkKey)), ready, busy, error, toggle, retry: () => setAttempt(value => value + 1) };
}
