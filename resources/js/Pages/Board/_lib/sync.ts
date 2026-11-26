import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '@/Lib/api';
import { notify } from '@/Lib/notify';
import { api } from './api';
import { migrate } from './layout';
import { defaultDoc } from './registry';
import { clearPrev, writePrev } from './storage';
import type { BoardDoc } from './types';

const SAVE_DEBOUNCE_MS = 1500;

export type SyncStatus = 'idle' | 'saving' | 'error';

// Last write wins on the whole document. No CRDT, no field-level merge: the
// mitigation for a simultaneous edit on two devices is the one-click restore
// below, not a conflict UI.
export function pickWinner(local: BoardDoc, server: BoardDoc): { winner: BoardDoc; loser: BoardDoc | null } {
  if (Date.parse(server.updatedAt) > Date.parse(local.updatedAt)) return { winner: server, loser: local };
  return { winner: local, loser: null };
}

export function useBoardSync(opts: {
  enabled: boolean;
  hadLocal: boolean;
  doc: BoardDoc;
  onAdopt: (doc: BoardDoc) => void;
}) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [superseded, setSuperseded] = useState<BoardDoc | null>(null);

  const hydrated = useRef(false);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const reqRef = useRef(0);
  // one toast per failure burst, not one per debounced save
  const notifiedFailure = useRef(false);
  // the document adopted from the server, which must not be echoed straight back
  const lastSynced = useRef<BoardDoc | null>(null);

  const docRef = useRef(opts.doc);
  docRef.current = opts.doc;
  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  // a debounced save is waiting; cleared when it fires or is flushed
  const pending = useRef(false);
  // the request a later keepalive save must not overtake (the server keeps
  // whichever whole document arrives last)
  const lastRequest = useRef<Promise<unknown>>(Promise.resolve());

  const onAdoptRef = useRef(opts.onAdopt);
  onAdoptRef.current = opts.onAdopt;

  const save = useCallback(async function save(): Promise<void> {
    // single in-flight request; a mutation during a save re-fires once on
    // settle rather than queueing every intermediate state
    if (inFlight.current) {
      dirty.current = true;
      return;
    }
    inFlight.current = true;
    const id = ++reqRef.current;
    setStatus('saving');
    try {
      const request = api.putBoard(docRef.current);
      lastRequest.current = request.catch(() => undefined);
      await request;
      notifiedFailure.current = false;
      if (id === reqRef.current) setStatus('idle');
    } catch (e) {
      // non-fatal: localStorage already holds the document. The status is shown
      // in the shell; the toast only names the first failure of a burst.
      if (id === reqRef.current) {
        setStatus('error');
        if (!notifiedFailure.current) {
          notifiedFailure.current = true;
          notify.error(apiErrorMessage(e, 'تعذّر حفظ لوحتك على الخادم، محفوظة على هذا الجهاز'));
        }
      }
    } finally {
      inFlight.current = false;
      if (dirty.current) {
        dirty.current = false;
        void save();
      }
    }
  }, []);

  useEffect(() => {
    if (!opts.enabled || hydrated.current) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.getBoard();
        if (cancelled) return;

        const server = res.document ? migrate(res.document, defaultDoc()) : null;
        const local = opts.hadLocal ? docRef.current : null;

        if (!server && !local) {
          hydrated.current = true;
          void save();
        } else if (!server && local) {
          // the anonymous-to-logged-in path: the guest board becomes the account's
          hydrated.current = true;
          void save();
        } else if (server && !local) {
          lastSynced.current = server;
          hydrated.current = true;
          onAdoptRef.current(server);
        } else if (server && local) {
          const { winner, loser } = pickWinner(local, server);
          hydrated.current = true;
          if (loser) {
            writePrev(loser);
            setSuperseded(loser);
            lastSynced.current = winner;
            onAdoptRef.current(winner);
          } else {
            void save();
          }
        }
      } catch {
        // offline or a failed read: keep working from the local document
        hydrated.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, [opts.enabled, opts.hadLocal, save]);

  useEffect(() => {
    if (!opts.enabled || !hydrated.current) return;
    if (opts.doc === lastSynced.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    pending.current = true;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      pending.current = false;
      void save();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [opts.doc, opts.enabled, save]);

  // flush a pending save when the tab goes away. The request outlives the page
  // (keepalive); nothing can be shown to the user at that point.
  useEffect(() => {
    if (!opts.enabled) return;

    function onVisibility() {
      if (document.visibilityState !== 'hidden' || !timer.current) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      sendAfterLast(docRef.current);
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [opts.enabled]);

  // Send a whole-document keepalive save once every earlier request has
  // settled, so an older document can never land after a newer one.
  const sendAfterLast = useCallback((doc: BoardDoc) => {
    const request = lastRequest.current.then(() => api.putBoard(doc, { keepalive: true }));
    lastRequest.current = request.catch(() => undefined);
  }, []);

  // Record the latest document while the board unmounts: a widget flushing
  // its last edit then cannot reach the save effect above through state.
  const stageFinal = useCallback((doc: BoardDoc) => {
    docRef.current = doc;
    pending.current = true;
  }, []);

  // Leaving the board (an Inertia visit) inside the debounce window would
  // otherwise drop the last change on the server. React runs a deleted tree's
  // cleanups parent first, so the widgets' final edits arrive (stageFinal)
  // after this cleanup; the microtask runs once all of them are in and sends
  // one document, ordered after any save still in flight.
  useEffect(() => () => {
    queueMicrotask(() => {
      if (!pending.current || !enabledRef.current || !hydrated.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      sendAfterLast(docRef.current);
    });
  }, [sendAfterLast]);

  const restore = useCallback(() => {
    if (!superseded) return;
    const restored = { ...superseded, updatedAt: new Date().toISOString() };
    setSuperseded(null);
    clearPrev();
    onAdoptRef.current(restored);
  }, [superseded]);

  const dismiss = useCallback(() => {
    setSuperseded(null);
    clearPrev();
  }, []);

  return { status, superseded, restore, dismiss, retry: save, stageFinal };
}
