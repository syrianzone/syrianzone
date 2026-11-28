import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ProgressiveListOptions {
    /** Number of items rendered initially (SSR + first paint). */
    initial?: number;
    /** Number of items appended each time the sentinel enters the viewport or "Show more" is clicked. */
    step?: number;
    /** When this key changes (e.g. search/filter state), reset back to `initial`. */
    resetKey?: string;
}

/**
 * Progressive / chunked list renderer that keeps initial DOM lean while
 * seamlessly appending more items as the visitor scrolls (via IntersectionObserver)
 * or clicks the fallback "Show more" button. Filtering still runs on the full
 * array in memory.
 */
export function useProgressiveList<T>(
    items: readonly T[],
    { initial = 30, step = 30, resetKey = '' }: ProgressiveListOptions = {},
) {
    const [limit, setLimit] = useState(initial);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setLimit(initial);
    }, [resetKey, initial]);

    const visibleItems = useMemo(
        () => (limit >= items.length ? items : items.slice(0, limit)),
        [items, limit],
    );

    const remaining = Math.max(0, items.length - visibleItems.length);
    const hasMore = remaining > 0;

    const showMore = useCallback(() => {
        setLimit((prev) => Math.min(items.length, prev + step));
    }, [items.length, step]);

    useEffect(() => {
        if (!hasMore) return;
        const el = sentinelRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setLimit((prev) => Math.min(items.length, prev + step));
                }
            },
            { rootMargin: '600px 0px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, items.length, step]);

    return { visibleItems, hasMore, remaining, showMore, sentinelRef };
}
