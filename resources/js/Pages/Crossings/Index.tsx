import React, { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Search, Signpost } from 'lucide-react';
import { Input } from '@/Components/ui/input';
import MainLayout from '@/Layouts/MainLayout';
import { CrossingsTable } from './_components/CrossingsTable';
import { CrossingDetail } from './_components/CrossingDetail';
import { MapErrorBoundary } from './_components/MapErrorBoundary';
import {
    CROSSING_ZOOM,
    crossings,
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    meta,
    SOURCE_PAGE_URL,
    statusOf,
    syriaMinutes,
    syriaNow,
    toFeatureCollection,
} from './_lib/crossings';

// maplibre and the basemap style are a large chunk, and the table answers the
// common question on its own, so the map arrives after the first paint.
const CrossingsMap = React.lazy(() =>
    import('./_components/CrossingsMap').then((m) => ({ default: m.CrossingsMap }))
);

// Own interval so the ticking second hand doesn't re-render the table or the map.
const SyriaClock = React.memo(function SyriaClock() {
    const [time, setTime] = useState('--:--:--');

    useEffect(() => {
        const tick = () => {
            const now = syriaNow();
            const pad = (n: number) => String(n).padStart(2, '0');
            setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-end">
            <div className="text-[10px] leading-none text-muted-foreground">سوريا (GMT+3)</div>
            <div className="text-base font-bold tabular-nums text-foreground" dir="ltr">
                {time}
            </div>
        </div>
    );
});

export default function CrossingsPage() {
    const [query, setQuery] = useState('');
    const [nowMin, setNowMin] = useState<number | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [focus, setFocus] = useState<{ lng: number; lat: number; zoom: number; key: number } | null>(null);

    // Statuses depend on the current time, so they are resolved after mount
    // (keeps SSR and the first client render identical) and refreshed every 30s.
    useEffect(() => {
        const sync = () => setNowMin(syriaMinutes());
        sync();
        const timer = setInterval(sync, 30000);
        return () => clearInterval(timer);
    }, []);

    // ?c=17 deep links open one crossing, the way a shared card does.
    useEffect(() => {
        const n = Number(new URLSearchParams(window.location.search).get('c'));
        const target = crossings.find((c) => c.n === n);
        if (!target) return;
        setSelectedId(target.n);
        setFocus({ lng: target.lon, lat: target.lat, zoom: CROSSING_ZOOM, key: Date.now() });
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim();
        if (!q) return crossings;
        return crossings.filter((c) => c.name.includes(q) || (c.country ?? '').includes(q));
    }, [query]);

    const features = useMemo(() => toFeatureCollection(filtered, nowMin), [filtered, nowMin]);

    const counts = useMemo(() => {
        if (nowMin === null) return null;
        return crossings.reduce(
            (acc, c) => {
                const status = statusOf(c, nowMin);
                if (status === 'opening') acc.opening++;
                else if (status === 'open') acc.open++;
                else acc.closed++;
                return acc;
            },
            { open: 0, closed: 0, opening: 0 }
        );
    }, [nowMin]);

    const shownId = hoveredId ?? selectedId;
    const shown = shownId === null ? null : (crossings.find((c) => c.n === shownId) ?? null);

    const select = (n: number) => {
        const target = crossings.find((c) => c.n === n);
        if (!target) return;
        setSelectedId(n);
        setHoveredId(null);
        setFocus({ lng: target.lon, lat: target.lat, zoom: CROSSING_ZOOM, key: Date.now() });
    };

    // Closing the card also undoes the zoom the selection caused, so the map is
    // back to the country view the page opened on rather than parked on whichever
    // crossing was last read.
    const closeDetail = () => {
        setSelectedId(null);
        setHoveredId(null);
        setFocus({ lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1], zoom: DEFAULT_ZOOM, key: Date.now() });
    };

    return (
        <MainLayout>
            <Head>
                <title>الحالة الفنية للمنافذ الحدودية في سوريا | Syrian Zone</title>
                <meta
                    name="description"
                    content="الحالة الفنية للمنافذ الحدودية والمرافئ في سوريا: ساعات العمل، وحالة كل منفذ مفتوح أو مغلق الآن، وخريطة تفاعلية، واستعلام مباشر عبر واتساب."
                />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="الحالة الفنية للمنافذ الحدودية في سوريا | Syrian Zone" />
                <meta
                    property="og:description"
                    content="جدول وخريطة تفاعلية لكل منفذ ومرفأ، مع ساعات العمل والحالة الآن واستعلام مباشر عبر واتساب."
                />
            </Head>

            {/*
              Two layouts from one DOM order. Small screens stack: the map on top
              at a fixed height, the table below it in normal flow, scrolling with
              the page — a viewport-height box with its own scroll container is
              what phones handle worst (browser chrome makes 100vh taller than the
              visible area, and the inner list ends up unreachable). Only from lg
              does this become the pinned split: table left, map right.
            */}
            <div className="flex flex-col-reverse lg:h-[calc(100vh-64px)] lg:flex-row-reverse lg:overflow-hidden" dir="rtl">
                {/* Table side */}
                <aside className="flex flex-col border-border bg-card lg:min-h-0 lg:w-[26%] lg:min-w-[320px] lg:max-w-[440px] lg:border-e">
                    <div className="border-b border-border p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Signpost className="h-5 w-5" />
                                </span>
                                <div>
                                    <h1 className="text-sm font-bold leading-tight text-foreground">المنافذ الحدودية</h1>
                                    <p className="text-[11px] leading-tight text-muted-foreground">الحالة الفنية لكل منفذ ومرفأ</p>
                                </div>
                            </div>
                            <SyriaClock />
                        </div>

                        <div className="relative">
                            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ابحث باسم المنفذ أو الدولة…"
                                className="ps-9"
                                aria-label="ابحث باسم المنفذ أو الدولة"
                            />
                        </div>

                        {counts && (
                            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    مفتوح <span className="tabular-nums">{counts.open}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    مغلق <span className="tabular-nums">{counts.closed}</span>
                                </span>
                                {counts.opening > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        قيد الافتتاح <span className="tabular-nums">{counts.opening}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                        <CrossingsTable crossings={filtered} nowMin={nowMin} selectedId={selectedId} onSelect={select} />
                    </div>

                    <p className="border-t border-border px-4 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
                        الحالة إرشادية، تُحسب بمقارنة توقيت سوريا بساعات العمل. البيانات من{' '}
                        <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {meta.source}
                        </a>
                        ،{' '}
                        {/* TODO(official-portal): swap for the authority's official page once
                            published, and drop "(مؤقتاً)" — see SOURCE_PAGE_URL in _lib/crossings.ts */}
                        <a href={SOURCE_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            الصفحة المصدر
                        </a>{' '}
                        (مؤقتاً).
                    </p>
                </aside>

                {/* Map side */}
                <div className="relative h-[45vh] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
                    <MapErrorBoundary className="h-full w-full">
                        <React.Suspense
                            fallback={
                                <div className="flex h-full w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                                    جاري تحميل الخريطة...
                                </div>
                            }
                        >
                            <CrossingsMap
                                data={features}
                                selectedId={shownId}
                                focus={focus}
                                onSelect={select}
                                onHover={setHoveredId}
                                className="h-full w-full"
                            />
                        </React.Suspense>
                    </MapErrorBoundary>

                    {shown && (
                        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[400] flex justify-start lg:inset-x-auto lg:start-4 lg:top-4 lg:bottom-auto">
                            <CrossingDetail
                                crossing={shown}
                                nowMin={nowMin}
                                interactive={hoveredId === null}
                                onClose={closeDetail}
                            />
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
