import React, { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { MapPin, Search, Share2, Clock, Signpost } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import MainLayout from '@/Layouts/MainLayout';
import data from './_data/crossings.json';

type WorkWindow = { label?: string; start?: string; end?: string; h24?: boolean };

type Crossing = {
    n: number;
    name: string;
    intl: string;
    category: 'crossing' | 'port';
    opType: string | null;
    windows: WorkWindow[];
    mapsUrl: string;
    openingSoon: boolean;
    override: { status?: 'open' | 'closed'; message?: string } | null;
};

const { meta, crossings } = data as {
    meta: { source: string; sourceUrl: string; mirrorUrl: string; asOf: string };
    crossings: Crossing[];
};

const LAND = crossings.filter((c) => c.category === 'crossing');
const SEA = crossings.filter((c) => c.category === 'port');

// Syria sits on GMT+3 all year (no DST since 2022), so the offset is a constant
// rather than something we have to look up per date.
const SYRIA_OFFSET_MINUTES = 3 * 60;

function syriaNow(): Date {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + SYRIA_OFFSET_MINUTES * 60000);
}

function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function formatTime12(t: string) {
    const [h, mm] = t.split(':').map(Number);
    const period = h < 12 ? 'ص' : 'م';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

function windowLabel(win: WorkWindow) {
    if (win.h24) return 'على مدار الساعة';
    return `${formatTime12(win.start!)} – ${formatTime12(win.end!)}`;
}

function isWindowOpen(win: WorkWindow, nowMin: number) {
    if (win.h24) return true;
    const start = timeToMinutes(win.start!);
    const end = timeToMinutes(win.end!);
    if (start === end) return true;
    if (start < end) return nowMin >= start && nowMin < end;
    // window that runs past midnight, e.g. 09:00 – 05:00
    return nowMin >= start || nowMin < end;
}

/** 963989860267 -> +963 989 860 267 */
function formatIntl(intl: string) {
    return `+${intl.slice(0, 3)} ${intl.slice(3, 6)} ${intl.slice(6, 9)} ${intl.slice(9)}`;
}

function isOpenNow(c: Crossing, nowMin: number) {
    if (c.override?.status) return c.override.status === 'open';
    return c.windows.some((win) => isWindowOpen(win, nowMin));
}

function buildShareMessage(c: Crossing, open: boolean) {
    const lines = [`🛂 ${c.name}`];

    if (c.openingSoon) {
        lines.push('🟡 قيد الافتتاح');
    } else {
        lines.push(open ? '🟢 مفتوح الآن' : '🔴 مغلق الآن');
        if (c.opType) lines.push(`🚦 ${c.opType}`);
        c.windows.forEach((win) => {
            const label = win.label ? `${win.label}: ` : 'ساعات العمل: ';
            lines.push(`🕘 ${label}${windowLabel(win)}`);
        });
    }

    lines.push(`📞 واتساب: ${formatIntl(c.intl)}`);
    lines.push(`📍 الموقع: ${c.mapsUrl}`);
    lines.push('');
    lines.push(`🔗 التفاصيل: ${window.location.origin}/crossings?c=${c.n}`);
    lines.push('عبر المساحة السورية 🇸🇾');

    return lines.join('\n');
}

async function shareCrossing(c: Crossing, open: boolean) {
    const text = buildShareMessage(c, open);

    if (navigator.share) {
        try {
            await navigator.share({ title: c.name, text });
            return;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
        }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2m0 1.67c2.21 0 4.29.86 5.85 2.42a8.23 8.23 0 0 1 2.42 5.82c0 4.55-3.71 8.26-8.27 8.26a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.32a8.18 8.18 0 0 1-1.26-4.37c0-4.55 3.71-8.24 8.25-8.24m4.5 10.02c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.09 3.62.57.25 1.02.39 1.37.5.57.18 1.1.16 1.51.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28" />
        </svg>
    );
}

function StatusPill({ state }: { state: 'open' | 'closed' | 'opening' | 'pending' }) {
    const styles = {
        open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        closed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
        opening: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        pending: 'bg-muted text-muted-foreground border-border animate-pulse',
    }[state];

    const dot = { open: 'bg-emerald-500', closed: 'bg-red-500', opening: 'bg-amber-500', pending: 'bg-muted-foreground/40' }[state];
    const text = { open: 'مفتوح الآن', closed: 'مغلق الآن', opening: 'قيد الافتتاح', pending: 'جارٍ التحقق' }[state];

    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', styles)}>
            <span className={cn('h-2 w-2 rounded-full', dot)} />
            {text}
        </span>
    );
}

// nowMin is null until the page has mounted, so the first paint shows a pending
// pill rather than statuses resolved against a time we do not have yet.
function CrossingCard({ crossing, nowMin, highlighted }: { crossing: Crossing; nowMin: number | null; highlighted: boolean }) {
    const open = nowMin === null ? null : isOpenNow(crossing, nowMin);
    const windowStates = crossing.windows.map((win) => (nowMin === null ? null : isWindowOpen(win, nowMin)));

    return (
        <Card
            id={`crossing-${crossing.n}`}
            className={cn('scroll-mt-24 transition-shadow hover:shadow-lg', highlighted && 'ring-2 ring-primary')}
        >
            <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-snug text-foreground">{crossing.name}</h3>
                    <StatusPill state={crossing.openingSoon ? 'opening' : open === null ? 'pending' : open ? 'open' : 'closed'} />
                </div>

                {!crossing.openingSoon && (
                    <>
                        {crossing.opType && (
                            <span className="w-fit rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{crossing.opType}</span>
                        )}

                        {crossing.override?.message && (
                            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                                {crossing.override.message}
                            </p>
                        )}

                        <div className="space-y-1.5 text-sm">
                            {crossing.windows.map((win, i) => (
                                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                                    {crossing.windows.length > 1 ? (
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                                windowStates[i] === null ? 'bg-muted-foreground/40' : windowStates[i] ? 'bg-emerald-500' : 'bg-red-500'
                                            )}
                                        />
                                    ) : (
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span>{win.label ? `${win.label}:` : 'ساعات العمل:'}</span>
                                    <span className="font-semibold text-foreground">{windowLabel(win)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="mt-auto space-y-2 pt-1">
                    <div className="text-sm font-semibold tabular-nums text-muted-foreground" dir="ltr">
                        {formatIntl(crossing.intl)}
                    </div>

                    <Button
                        asChild
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                        <a href={`https://wa.me/${crossing.intl}`} target="_blank" rel="noopener noreferrer">
                            <WhatsAppIcon className="h-4 w-4" />
                            واتساب
                        </a>
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" asChild>
                            <a href={crossing.mapsUrl} target="_blank" rel="noopener noreferrer">
                                <MapPin className="h-4 w-4" />
                                الموقع
                            </a>
                        </Button>
                        <Button variant="outline" onClick={() => shareCrossing(crossing, open ?? false)}>
                            <Share2 className="h-4 w-4" />
                            مشاركة
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Own interval so the ticking second hand doesn't re-render the whole page.
const SyriaClock = React.memo(function SyriaClock() {
    const [time, setTime] = useState<string>('--:--:--');

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
        <Card className="w-fit bg-card/50 backdrop-blur-sm">
            <CardContent className="px-4 py-2.5 text-center">
                <div className="text-[11px] text-muted-foreground">التوقيت الآن — سوريا (GMT+3)</div>
                <div className="text-2xl font-bold tabular-nums text-foreground" dir="ltr">
                    {time}
                </div>
            </CardContent>
        </Card>
    );
});

export default function CrossingsPage() {
    const [query, setQuery] = useState('');
    const [nowMin, setNowMin] = useState<number | null>(null);
    const [highlighted, setHighlighted] = useState<number | null>(null);

    // Statuses depend on the current time, so they are resolved after mount
    // (keeps SSR and the first client render identical) and refreshed every
    // 30s afterwards.
    useEffect(() => {
        const sync = () => {
            const now = syriaNow();
            setNowMin(now.getHours() * 60 + now.getMinutes());
        };

        sync();
        const timer = setInterval(sync, 30000);
        return () => clearInterval(timer);
    }, []);

    // ?c=17 deep links land on a single crossing, the way a shared card does.
    useEffect(() => {
        const n = Number(new URLSearchParams(window.location.search).get('c'));
        if (!n) return;

        setHighlighted(n);
        requestAnimationFrame(() => {
            document.getElementById(`crossing-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        const timer = setTimeout(() => setHighlighted(null), 2500);
        return () => clearTimeout(timer);
    }, []);

    const counts = useMemo(() => {
        if (nowMin === null) return null;

        return crossings.reduce(
            (acc, c) => {
                if (c.openingSoon) acc.opening++;
                else if (isOpenNow(c, nowMin)) acc.open++;
                else acc.closed++;
                return acc;
            },
            { open: 0, closed: 0, opening: 0 }
        );
    }, [nowMin]);

    const filter = (list: Crossing[]) => (query ? list.filter((c) => c.name.includes(query.trim())) : list);
    const land = filter(LAND);
    const sea = filter(SEA);

    const sections: Array<{ title: string; total: number; list: Crossing[] }> = [
        { title: 'المنافذ البرية', total: LAND.length, list: land },
        { title: 'المنافذ البحرية', total: SEA.length, list: sea },
    ];

    return (
        <MainLayout>
            <Head>
                <title>الحالة الفنية للمنافذ الحدودية في سوريا | Syrian Zone</title>
                <meta
                    name="description"
                    content="الحالة الفنية للمنافذ الحدودية والمرافئ في سوريا: ساعات العمل، وحالة كل منفذ مفتوح أو مغلق الآن، واستعلام مباشر عبر واتساب."
                />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="الحالة الفنية للمنافذ الحدودية في سوريا | Syrian Zone" />
                <meta
                    property="og:description"
                    content="استعلام مباشر عن حالة كل منفذ ومرفأ عبر واتساب، مع ساعات العمل والموقع على الخريطة."
                />
            </Head>

            <main className="container mx-auto max-w-screen-xl px-4 pt-6 pb-16" dir="rtl">
                <header className="mb-8 text-center">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Signpost className="h-7 w-7" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">الحالة الفنية للمنافذ الحدودية في سوريا</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
                        استعلام مباشر عن حالة كل منفذ ومرفأ عبر واتساب
                    </p>
                    <div className="mt-5 flex justify-center">
                        <SyriaClock />
                    </div>
                </header>

                {/* Search + live tally */}
                <div className="mb-8 flex flex-col items-center gap-4 md:flex-row md:justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ابحث عن منفذ أو مرفأ بالاسم…"
                            className="ps-9"
                            aria-label="ابحث عن منفذ أو مرفأ بالاسم"
                        />
                    </div>

                    {counts && (
                        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                مفتوح الآن <span className="tabular-nums">{counts.open}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-400">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                مغلق الآن <span className="tabular-nums">{counts.closed}</span>
                            </span>
                            {counts.opening > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                    قيد الافتتاح <span className="tabular-nums">{counts.opening}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {land.length === 0 && sea.length === 0 ? (
                    <Card className="border-2 border-dashed bg-transparent">
                        <CardContent className="p-12 text-center text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</CardContent>
                    </Card>
                ) : (
                    sections
                        .filter((section) => section.list.length > 0)
                        .map((section) => (
                            <section key={section.title} className="mb-10">
                                <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-foreground">
                                    {section.title}
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                                        {section.total}
                                    </span>
                                </h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {section.list.map((crossing) => (
                                        <CrossingCard
                                            key={crossing.n}
                                            crossing={crossing}
                                            nowMin={nowMin}
                                            highlighted={highlighted === crossing.n}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))
                )}

                <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
                    * الحالة معروضة تلقائياً بمقارنة التوقيت الحالي بتوقيت سوريا (GMT+3 على مدار العام) مع ساعات عمل كل منفذ ومرفأ، وهي إرشادية وقد
                    تختلف عن الواقع الفعلي في ظروف استثنائية. للتأكد الدقيق يرجى التواصل مباشرة عبر واتساب.
                </p>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                    البيانات من{' '}
                    <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {meta.source}
                    </a>{' '}
                    عبر{' '}
                    <a href={meta.mirrorUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        منصة الحالة الفنية للمنافذ الحدودية
                    </a>
                </p>
            </main>
        </MainLayout>
    );
}
