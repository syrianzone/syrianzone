import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { migrate } from './layout';
import { defaultDoc } from './registry';
import { clearPrev, writePrev } from './storage';
import type { BoardDoc } from './types';

const SAVE_DEBOUNCE_MS = 1500;

export type SyncStatus = 'idle' | 'saving' | 'error';

function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

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
  // the document adopted from the server, which must not be echoed straight back
  const lastSynced = useRef<BoardDoc | null>(null);

  const docRef = useRef(opts.doc);
  docRef.current = opts.doc;

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
      await api.putBoard(docRef.current);
      if (id === reqRef.current) setStatus('idle');
    } catch {
      // non-fatal: localStorage already holds the document
      if (id === reqRef.current) setStatus('error');
    } finally {
      inFlight.current = false;
      if (dirty.current) {
        dirty.current = false;
        void save();
      }
    }
  }, []);

  // hydrate once per login
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

  // debounced save on every change
  useEffect(() => {
    if (!opts.enabled || !hydrated.current) return;
    if (opts.doc === lastSynced.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void save();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [opts.doc, opts.enabled, save]);

  // flush a pending save when the tab goes away. sendBeacon cannot carry the
  // CSRF header, so this uses fetch with keepalive.
  useEffect(() => {
    if (!opts.enabled) return;

    function onVisibility() {
      if (document.visibilityState !== 'hidden' || !timer.current) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      void fetch('/api/v1/board', {
        method: 'PUT',
        keepalive: true,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({ document: docRef.current }),
      }).catch(() => undefined);
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [opts.enabled]);

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

  return { status, superseded, restore, dismiss, retry: save };
}
