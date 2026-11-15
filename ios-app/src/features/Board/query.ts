import { useCallback, useEffect } from 'react';
import { useResource, type Resource } from '../../resource';
import { useScreenActive } from '../../platform/lifecycle';
import { waitForSignal } from '../../platform/page-protocol';
const cache = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, { controller: AbortController; refs: number; result: Promise<unknown> }>();
export function useWidgetQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>, staleMs: number, intervalMs: number | null = null, enabled = true): Resource<T> {
  const active = useScreenActive();
  const fetch = useCallback(async (signal: AbortSignal): Promise<T> => {
    const saved = cache.get(key);
    if (saved && Date.now() - saved.at < staleMs) return saved.value as T;
    let operation = pending.get(key);
    if (operation?.controller.signal.aborted) { pending.delete(key); operation = undefined; }
    if (!operation) {
      const controller = new AbortController();
      const result = (async () => { try { return await load(controller.signal); } catch (reason) { if (controller.signal.aborted) throw reason; return load(controller.signal); } })()
        .then(value => { cache.set(key, { at: Date.now(), value }); if (cache.size > 100) { const first = cache.keys().next().value; if (first !== undefined) cache.delete(first); } return value; })
        .finally(() => { if (pending.get(key)?.result === result) pending.delete(key); });
      operation = { controller, refs: 0, result }; pending.set(key, operation);
    }
    operation.refs++;
    try { return await waitForSignal(operation.result, signal) as T; }
    finally { if (--operation.refs === 0 && pending.get(key) === operation) operation.controller.abort(); }
  }, [key, load, staleMs]);
  const resource = useResource(fetch, { enabled });
  const { reload } = resource;
  useEffect(() => {
    if (!active || !enabled || !intervalMs) return;
    const timer = setInterval(() => { cache.delete(key); reload(); }, intervalMs);
    return () => clearInterval(timer);
  }, [active, enabled, intervalMs, key, reload]);
  return { ...resource, reload: () => { cache.delete(key); resource.reload(); } };
}
