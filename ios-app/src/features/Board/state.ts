import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../../api';
import { useAccount } from '../../platform/account';
import { readDocument, writeDocument } from '../../platform/storage';
import { record } from '../../platform/validation';
import { defaultDocument, migrate, type BoardDoc } from './model';
import { createBoardWriter, pickWinner } from './sync';

const KEY = 'syrian-zone.board.v1', PREVIOUS = 'syrian-zone.board.previous.v1';
function decodeDocument(value: unknown): BoardDoc {
  const row = record(value);
  if (row.v !== 1 || !Array.isArray(row.dashboards) || !row.dashboards.length || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))) throw new Error('نسخة اللوحة المحفوظة غير مدعومة. لم يتم استبدالها.');
  return migrate(value);
}
export function useBoardDocument() {
  const account = useAccount(), [document, setDocument] = useState(defaultDocument), [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null), [status, setStatus] = useState<'local' | 'saving' | 'saved'>('local');
  const [previous, setPrevious] = useState<BoardDoc | null>(null), [attempt, setAttempt] = useState(0);
  const current = useRef(document), localWrites = useRef(Promise.resolve()), hydration = useRef<Promise<void> | null>(null), initialized = useRef(false), hadLocal = useRef(false), owner = useRef(account.sessionGeneration);
  const remote = useRef<ReturnType<typeof createBoardWriter> | null>(null), remoteReady = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  owner.current = account.sessionGeneration;
  const save = useCallback(async (): Promise<void> => {
    if (!remoteReady.current || !remote.current) return;
    setStatus('saving');
    const submitted = current.current;
    try { await remote.current.save(submitted); setStatus(current.current === submitted ? 'saved' : 'local'); setError(null); }
    catch (reason) { setStatus('local'); setError(reason instanceof Error ? reason.message : 'تعذرت المزامنة. بقيت اللوحة محفوظة على الجهاز.'); }
  }, []);
  const change = useCallback((update: (value: BoardDoc) => BoardDoc): Promise<void> => {
    const operation = localWrites.current.catch(() => undefined).then(async () => {
      if (!initialized.current) throw new Error('انتظر اكتمال قراءة اللوحة.');
      const next = update(current.current);
      await writeDocument(KEY, next); current.current = next; hadLocal.current = true; setDocument(next); setError(null); setStatus('local');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; void save(); }, 1500);
    });
    localWrites.current = operation;
    void operation.catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر حفظ اللوحة على الجهاز.'));
    return operation;
  }, [save]);
  const userId = account.user?.id, stamp = account.sessionGeneration;
  useEffect(() => {
    let active = true;
    const controller = new AbortController(); remoteReady.current = false; remote.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!hydration.current) hydration.current = (async () => {
      const fallback = current.current, stored = await readDocument(KEY, decodeDocument, fallback), recovery = await readDocument<BoardDoc | null>(PREVIOUS, value => value === null ? null : decodeDocument(value), null);
      hadLocal.current = stored !== fallback; current.current = stored; initialized.current = true; setDocument(stored); setPrevious(recovery); setReady(true);
    })().catch(reason => { hydration.current = null; throw reason; });
    void (async () => {
      await hydration.current;
      if (!active || userId === undefined) return;
      const response = await api.request('board', value => { const row = record(value); return row.document === null ? null : decodeDocument(row.document); }, { authenticated: true, sessionGeneration: stamp, signal: controller.signal });
      if (!active || owner.current !== stamp) return;
      let upload = true;
      const adoption = localWrites.current.catch(() => undefined).then(async () => {
        if (!active || owner.current !== stamp || !response) return;
        const selected = hadLocal.current ? pickWinner(current.current, response) : { winner: response, loser: null };
        upload = selected.winner !== response;
        if (selected.loser) { await writeDocument(PREVIOUS, selected.loser); setPrevious(selected.loser); }
        if (selected.winner === response) { await writeDocument(KEY, response); if (!active || owner.current !== stamp) return; current.current = response; setDocument(response); }
      });
      localWrites.current = adoption; await adoption;
      if (!active || owner.current !== stamp) return;
      remote.current = createBoardWriter(async next => {
        await api.request('board', record, { method: 'PUT', authenticated: true, sessionGeneration: stamp, body: { document: next } });
      });
      remoteReady.current = true;
      if (upload) await save(); else setStatus('saved');
    })().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل اللوحة. بقيت نسخة الجهاز محفوظة.'); });
    return () => { active = false; controller.abort(); };
  }, [userId, stamp, attempt, save]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') void localWrites.current.catch(() => undefined).then(save); });
    return () => { subscription.remove(); if (timer.current) { clearTimeout(timer.current); timer.current = null; void localWrites.current.catch(() => undefined).then(save); } };
  }, [save]);
  async function restore(): Promise<void> {
    if (!previous) return;
    await change(() => ({ ...previous, updatedAt: new Date().toISOString() })); await writeDocument(PREVIOUS, null); setPrevious(null);
  }
  async function dismiss(): Promise<void> { await writeDocument(PREVIOUS, null); setPrevious(null); }
  return { document, ready, error, status, previous, change, restore, dismiss, retry: () => { if (remoteReady.current) void save(); else setAttempt(value => value + 1); } };
}

// PORT STATUS: source resources/js/Pages/Board/_lib/sync.ts and storage.ts; confidence medium; todos 1 concurrent editing and native background flush verification.
