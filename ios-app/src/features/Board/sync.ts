import type { BoardDoc } from './model';
export function documentBytes(document: BoardDoc): number { return new TextEncoder().encode(JSON.stringify({ document })).length; }
export function pickWinner(local: BoardDoc, server: BoardDoc): { winner: BoardDoc; loser: BoardDoc | null } {
  return Date.parse(server.updatedAt) > Date.parse(local.updatedAt) ? { winner: server, loser: local } : { winner: local, loser: null };
}
export function createBoardWriter(write: (document: BoardDoc) => Promise<void>) {
  let pending: BoardDoc | null = null, running: Promise<void> | null = null;
  return { save(document: BoardDoc): Promise<void> {
    if (documentBytes(document) > 65536) return Promise.reject(new Error('حجم اللوحة كبير جداً. قلّل النص أو عدد الويدجت.'));
    pending = document;
    if (running) return running;
    const drain = async (): Promise<void> => { while (pending) { const next = pending; pending = null; await write(next); } };
    running = drain().finally(() => { running = null; });
    return running;
  } };
}

// PORT STATUS: source resources/js/Pages/Board/_lib/sync.ts; confidence high; todos 0.
