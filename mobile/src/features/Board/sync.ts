import { useCallback, useEffect, useRef, useState } from 'react';

import { getBoard, putBoard } from './api';
import {
  createDefaultDocument,
  isBoardDocument,
  migrateDocument,
} from './model';
import {
  clearPreviousDocument,
  readPreviousDocument,
  writePreviousDocument,
} from './storage';
import type { BoardDocument } from './types';

export const BOARD_SAVE_DEBOUNCE_MS = 1_500;

export type BoardSyncStatus = 'error' | 'idle' | 'saving';

export function pickWinner(
  local: BoardDocument,
  server: BoardDocument,
): { loser: BoardDocument | null; winner: BoardDocument } {
  const localTime = Date.parse(local.updatedAt);
  const serverTime = Date.parse(server.updatedAt);
  if (
    Number.isFinite(serverTime) &&
    Number.isFinite(localTime) &&
    serverTime > localTime
  ) {
    return { loser: local, winner: server };
  }
  if (
    Number.isFinite(serverTime) &&
    Number.isFinite(localTime) &&
    localTime > serverTime
  ) {
    return { loser: server, winner: local };
  }
  return { loser: null, winner: local };
}

export function useBoardSync({
  accountId,
  document,
  enabled,
  hadLocal,
  onAdopt,
}: {
  accountId: number | null;
  document: BoardDocument;
  enabled: boolean;
  hadLocal: boolean;
  onAdopt: (document: BoardDocument) => void;
}) {
  const [status, setStatus] = useState<BoardSyncStatus>('idle');
  const [superseded, setSuperseded] = useState<BoardDocument | null>(null);
  const active = useRef(true);
  const enabledRef = useRef(enabled);
  const hydrated = useRef(false);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const saveController = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAdoptedStamp = useRef<string | null>(null);
  const documentRef = useRef(document);
  const onAdoptRef = useRef(onAdopt);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      dirty.current = false;
      saveController.current?.abort();
      saveController.current = null;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    documentRef.current = document;
    onAdoptRef.current = onAdopt;
  }, [document, onAdopt]);

  const save = useCallback(async () => {
    if (!active.current || !enabledRef.current) {
      return;
    }
    if (inFlight.current) {
      dirty.current = true;
      return;
    }
    const controller = new AbortController();
    saveController.current = controller;
    inFlight.current = true;
    setStatus('saving');
    try {
      await putBoard(documentRef.current, controller.signal);
      if (active.current) {
        setStatus('idle');
      }
    } catch {
      if (active.current && !controller.signal.aborted) {
        setStatus('error');
      }
    } finally {
      if (saveController.current === controller) {
        saveController.current = null;
      }
      inFlight.current = false;
      if (active.current && enabledRef.current && dirty.current) {
        dirty.current = false;
        void saveRef.current();
      } else if (!active.current || !enabledRef.current) {
        dirty.current = false;
      }
    }
  }, []);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let requestActive = true;
    void readPreviousDocument(accountId).then((raw) => {
      if (!requestActive || !isBoardDocument(raw)) {
        return;
      }
      const fallback = createDefaultDocument();
      const previous = migrateDocument(raw, fallback);
      if (previous !== fallback) {
        setSuperseded((current) => current ?? previous);
      }
    });
    return () => {
      requestActive = false;
    };
  }, [accountId, enabled]);

  useEffect(() => {
    if (!enabled) {
      hydrated.current = false;
      dirty.current = false;
      saveController.current?.abort();
      saveController.current = null;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }
    if (hydrated.current) {
      return;
    }
    let requestActive = true;
    const controller = new AbortController();
    void getBoard(controller.signal)
      .then(async (response) => {
        if (!requestActive || controller.signal.aborted) {
          return;
        }
        const server = response.document
          ? migrateDocument(response.document, createDefaultDocument())
          : null;
        const local = hadLocal ? documentRef.current : null;
        hydrated.current = true;
        if (!server && !local) {
          void save();
          return;
        }
        if (!server && local) {
          void save();
          return;
        }
        if (server && !local) {
          lastAdoptedStamp.current = server.updatedAt;
          onAdoptRef.current(server);
          return;
        }
        if (server && local) {
          const result = pickWinner(local, server);
          if (result.loser) {
            await writePreviousDocument(result.loser, accountId);
            if (!requestActive || controller.signal.aborted) {
              return;
            }
            setSuperseded(result.loser);
            if (result.winner === server) {
              lastAdoptedStamp.current = result.winner.updatedAt;
              onAdoptRef.current(result.winner);
            } else {
              void save();
            }
          } else {
            void save();
          }
        }
      })
      .catch(() => {
        if (requestActive && !controller.signal.aborted) {
          hydrated.current = true;
        }
      });
    return () => {
      requestActive = false;
      controller.abort();
    };
  }, [accountId, enabled, hadLocal, save]);

  useEffect(() => {
    if (!enabled || !hydrated.current) {
      return;
    }
    if (lastAdoptedStamp.current === document.updatedAt) {
      lastAdoptedStamp.current = null;
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, BOARD_SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [document, enabled, save]);

  const restore = useCallback(() => {
    if (!superseded) {
      return;
    }
    const restored = {
      ...superseded,
      updatedAt: new Date().toISOString(),
    };
    setSuperseded(null);
    void clearPreviousDocument(accountId);
    onAdoptRef.current(restored);
  }, [accountId, superseded]);

  const dismiss = useCallback(() => {
    setSuperseded(null);
    void clearPreviousDocument(accountId);
  }, [accountId]);

  return {
    dismiss,
    restore,
    retry: save,
    status,
    superseded,
  };
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/sync.ts (175 lines)
  confidence: high
  todos:      0
  notes:      Native synchronization preserves debounced saves, status, retries, conflicts, and prior-document recovery.
*/
