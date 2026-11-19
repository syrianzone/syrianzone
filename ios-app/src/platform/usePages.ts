import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import type { Page } from '../domain';
import type { Resource } from '../resource';
import { useScreenActive } from './lifecycle';
import { appendPage } from './pagination';

export function usePages<T extends { id: number | string }>(load: (page: number, signal: AbortSignal) => Promise<Page<T>>, enabled = true, keepPagesOnResume = false): Resource<Page<T>> & { more(): void; loadingMore: boolean } {
  const active = useScreenActive();
  const [stored, setStored] = useState<{ key: typeof load; page: Page<T> } | null>(null);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<{ key: typeof load; message: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null), generation = useRef(0), fetching = useRef(false);
  const loaded = useRef<{ key: typeof load; revision: number } | null>(null);
  const data = stored?.key === load ? stored.page : null;
  const error = failure?.key === load ? failure.message : null;
  useEffect(() => {
    const current = ++generation.current;
    controller.current?.abort();
    if (!active || !enabled) { fetching.current = false; setLoading(false); setLoadingMore(false); return; }
    if (keepPagesOnResume && loaded.current?.key === load && loaded.current.revision === revision) { setLoading(false); setLoadingMore(false); return; }
    const request = new AbortController(); controller.current = request; fetching.current = true;
    setLoading(true); setLoadingMore(false); setFailure(null);
    load(1, request.signal).then(page => { if (current === generation.current && !request.signal.aborted) { loaded.current = { key: load, revision }; setStored({ key: load, page }); } })
      .catch((reason: unknown) => {
        if (current !== generation.current || request.signal.aborted) return;
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) { setStored(null); loaded.current = null; }
        setFailure({ key: load, message: reason instanceof Error ? reason.message : 'تعذر تحميل القائمة.' });
      })
      .finally(() => { if (current === generation.current && !request.signal.aborted) { fetching.current = false; setLoading(false); } });
    return () => { request.abort(); controller.current?.abort(); fetching.current = false; };
  }, [load, active, enabled, revision, keepPagesOnResume]);
  function more(): void {
    if (!active || !enabled || fetching.current || !data || data.currentPage >= data.lastPage) return;
    const current = generation.current, previous = data, request = new AbortController();
    controller.current = request; fetching.current = true; setLoadingMore(true); setFailure(null);
    load(data.currentPage + 1, request.signal).then(page => { if (current === generation.current && !request.signal.aborted) setStored({ key: load, page: appendPage(previous, page) }); })
      .catch((reason: unknown) => {
        if (current !== generation.current || request.signal.aborted) return;
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) { setStored(null); loaded.current = null; }
        setFailure({ key: load, message: reason instanceof Error ? reason.message : 'تعذر تحميل المزيد.' });
      })
      .finally(() => { if (current === generation.current && !request.signal.aborted) { fetching.current = false; setLoadingMore(false); } });
  }
  return { data, loading: active && enabled && (loading || data === null && error === null), loadingMore, error, more, reload: () => setRevision(value => value + 1) };
}
// PORT STATUS: source resources/js/Pages/Places/_components/PlacesPanel.tsx usePagedList and PhotoGrid.tsx; confidence medium; todos 1 mounted lifecycle and retry verification.
