export interface PendingResult { id: string | number }

export function createPendingSave<T extends PendingResult, R = T>(write: (value: T | null) => Promise<void>, changed: (value: T | null) => void) {
  let pending: T | null = null, revision = 0;
  let request: AbortController | null = null;
  let acknowledged: { original: T; saved: R } | null = null;
  const invalidate = () => { revision += 1; request?.abort(); request = null; };
  const restore = (value: T | null) => { invalidate(); acknowledged = null; pending = value; changed(value); };
  const set = async (value: T | null) => {
    invalidate(); const operation = revision;
    await write(value);
    if (operation === revision) { acknowledged = null; pending = value; changed(value); }
  };
  return {
    current: (): T | null => pending,
    restore,
    set,
    remove: async (id?: string | number): Promise<void> => { if (id === undefined || String(pending?.id) === String(id)) await set(null); },
    consume: async (upload: (value: T, signal: AbortSignal) => Promise<R>, adopt: (saved: R, original: T) => Promise<void>): Promise<boolean> => {
      const original = pending;
      if (!original || request) return false;
      const controller = new AbortController(), operation = revision; request = controller;
      const current = () => operation === revision && !controller.signal.aborted;
      try {
        const saved = acknowledged?.original === original ? acknowledged.saved : await upload(original, controller.signal);
        if (!current()) return false;
        acknowledged = { original, saved };
        await write(null);
        if (!current()) return false;
        acknowledged = null; pending = null; changed(null);
        await adopt(saved, original);
        return true;
      } finally { if (request === controller) request = null; }
    }
  };
}
