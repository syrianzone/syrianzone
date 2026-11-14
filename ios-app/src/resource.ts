import { useEffect, useState } from 'react';

export interface Resource<T> { data: T | null; loading: boolean; error: string | null; reload(): void }

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError(null);
    load(controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل البيانات.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, revision]);
  return { data, loading, error, reload: () => setRevision(value => value + 1) };
}
