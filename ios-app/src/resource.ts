import { useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { useScreenActive } from './platform/lifecycle';

export interface Resource<T> { data: T | null; loading: boolean; error: string | null; reload(): void }

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, { enabled = true }: { enabled?: boolean } = {}): Resource<T> {
  const active = useScreenActive();
  const previousLoad = useRef<typeof load | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [owner, setOwner] = useState(() => load);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !active) { setLoading(false); return () => controller.abort(); }
    if (previousLoad.current !== load) { setData(null); setOwner(() => load); }
    previousLoad.current = load;
    setLoading(true);
    setError(null);
    load(controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) setData(null);
        setError(reason instanceof Error ? reason.message : 'تعذر تحميل البيانات.');
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, revision, enabled, active]);
  const current = owner === load;
  return { data: current ? data : null, loading: enabled && active ? !current || loading : false, error: current ? error : null, reload: () => setRevision(value => value + 1) };
}
