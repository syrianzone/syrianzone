import { useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import { SYRIAN_MONTHS_AR } from '@/Lib/syrian-date';
import { cn } from '@/Lib/utils';
import {
    CHART_GROUP_LABEL, CHART_GROUPS, chartToday, countGroups, cumulativeTrend, dayNumber, isoDay, lifelines, percentOf,
    sectorBreakdown, speakerBreakdown, type BreakdownRow, type ChartGroup, type GroupCounts, type Lifeline,
    type LifelineChart, type TrendPoint,
} from '../_lib/charts';
import type { ChartFilterKey } from '../_lib/filters';
import { formatDate } from '../_lib/format';
import type { PromiseCardData } from '../_lib/types';
import SpeakerAvatar from './SpeakerAvatar';

/** Rows shown per chart before "show all". */
const ROW_LIMIT = 6;
const LIFELINE_LIMIT = 10;
const SPEAKER_LIMIT = 8;

type Token = '--primary' | '--destructive' | '--muted-foreground';

/**
 * Paint per group, from semantic tokens only so every theme renders it. The
 * two "in between" groups are hatched, so no pair is told apart by hue alone.
 */
const GROUP_PAINT: Record<ChartGroup, { token: Token; alpha?: number; hatched?: boolean }> = {
    fulfilled: { token: '--primary' },
    partial: { token: '--primary', hatched: true },
    open: { token: '--muted-foreground', alpha: 0.5 },
    other: { token: '--muted-foreground', alpha: 0.2 },
    overdue: { token: '--destructive', hatched: true },
    broken: { token: '--destructive' },
};

const stripes = (token: Token): CSSProperties => ({
    backgroundImage: `repeating-linear-gradient(135deg, hsl(var(${token})) 0 3px, hsl(var(${token}) / 0.3) 3px 6px)`,
});

const solid = (group: ChartGroup) => `hsl(var(${GROUP_PAINT[group].token})${GROUP_PAINT[group].alpha ? ` / ${GROUP_PAINT[group].alpha}` : ''})`;

/** CSS fill for an HTML mark. */
const fill = (group: ChartGroup): CSSProperties => GROUP_PAINT[group].hatched ? stripes(GROUP_PAINT[group].token) : { backgroundColor: solid(group) };

const BUTTON = 'cursor-pointer rounded-md transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const MORE = 'mt-2 cursor-pointer rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The third view of the list, next to the card grid and the rows: the promises
 * the filters currently show, drawn as charts. Legend entries, sectors and
 * officials narrow the filters further, so the charts redraw around the
 * selection; timeline rows open the promise. `canFilter` is false for a mark
 * whose promises no filter can single out, which is then not a button.
 */
export default function PromiseCharts({ promises, returnUrl = '/promises', canFilter, onFilter }: {
    promises: PromiseCardData[];
    returnUrl?: string;
    canFilter: (key: ChartFilterKey, value: string) => boolean;
    onFilter: (key: ChartFilterKey, value: string) => void;
}) {
    const today = useMemo(() => chartToday(promises), [promises]);
    const counts = useMemo(() => countGroups(promises), [promises]);
    const trend = useMemo(() => cumulativeTrend(promises, today), [promises, today]);
    const timeline = useMemo(() => lifelines(promises, today), [promises, today]);
    const sectors = useMemo(() => sectorBreakdown(promises), [promises]);
    const speakers = useMemo(() => speakerBreakdown(promises), [promises]);

    return (
        <Card>
            <CardContent className="grid gap-x-10 gap-y-10 p-4 sm:p-5 lg:grid-cols-2">
                <h2 className="sr-only">الوعود المعروضة بالأرقام</h2>

                <Chart title="حالة الوعود">
                    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                        <Donut counts={counts} size={168} thickness={15} label={describeCounts(counts)}>
                            <span className="text-4xl font-black leading-none tabular-nums text-foreground">{promises.length}</span>
                            <span className="mt-1 text-xs text-muted-foreground">وعداً معروضاً</span>
                        </Donut>
                        <ul className="w-full min-w-0 flex-1 space-y-0.5">
                            {CHART_GROUPS.map((group) => (
                                <li key={group}>
                                    <button type="button" onClick={() => onFilter('state', group)}
                                        aria-label={`${CHART_GROUP_LABEL[group]}: ${counts[group]} من ${promises.length}، تصفية الوعود بها`}
                                        className={cn(BUTTON, 'flex w-full items-center gap-2 p-1.5 text-start text-sm')}>
                                        <Swatch group={group} />
                                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{CHART_GROUP_LABEL[group]}</span>
                                        <span className="font-semibold tabular-nums text-foreground">{counts[group]}</span>
                                        <span className="w-9 text-end text-xs tabular-nums text-muted-foreground" dir="ltr">{percentOf(counts[group], promises.length)}%</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Chart>

                <Chart title="الوعود التي أُطلقت والتي حُسمت، تراكمياً">
                    <TrendChart points={trend} />
                </Chart>

                <Chart title="مسار كل وعد: من إطلاقه إلى موعده والحكم عليه" className="lg:col-span-2">
                    <Lifelines chart={timeline} returnUrl={returnUrl} />
                </Chart>

                <Chart title="الوعود حسب القطاع">
                    <SectorBars rows={sectors} onSelect={(id) => onFilter('sector', id)} />
                </Chart>

                <Chart title="الوعود حسب المسؤول">
                    <SpeakerRings rows={speakers} canSelect={(id) => canFilter('speaker', id)} onSelect={(id) => onFilter('speaker', id)} />
                </Chart>
            </CardContent>
        </Card>
    );
}

function Chart({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
    return (
        <section className={cn('min-w-0', className)}>
            <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
            {children}
        </section>
    );
}

function Swatch({ group }: { group: ChartGroup }) {
    return <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={fill(group)} />;
}

const describeCounts = (counts: GroupCounts) => CHART_GROUPS.filter((g) => counts[g] > 0).map((g) => `${CHART_GROUP_LABEL[g]}: ${counts[g]}`).join('، ');

const monthLabel = (point: { year: number; month: number }) => `${SYRIAN_MONTHS_AR[point.month - 1]} ${point.year}`;

/** A ring split by state group, clockwise from the top; children sit in the hole. */
function Donut({ counts, size, thickness, label, children }: {
    counts: GroupCounts;
    /** Rendered diameter in px. */
    size: number;
    /** Ring thickness in viewBox units (the ring is 100 across). */
    thickness: number;
    label: string;
    children?: ReactNode;
}) {
    const id = useId().replace(/:/g, '');
    const groups = CHART_GROUPS.filter((group) => counts[group] > 0);
    const total = groups.reduce((sum, group) => sum + counts[group], 0);
    const radius = 50 - thickness / 2;
    const circumference = 2 * Math.PI * radius;
    const gap = groups.length > 1 ? 1.5 : 0;
    let offset = 0;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"
                {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
                <defs>
                    {groups.filter((group) => GROUP_PAINT[group].hatched).map((group) => (
                        <pattern key={group} id={`${id}-${group}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="5" height="5" fill={`hsl(var(${GROUP_PAINT[group].token}) / 0.3)`} />
                            <rect width="2.5" height="5" fill={`hsl(var(${GROUP_PAINT[group].token}))`} />
                        </pattern>
                    ))}
                </defs>
                {groups.map((group) => {
                    const length = (counts[group] / total) * circumference;
                    const start = offset;
                    offset += length;
                    return (
                        <circle key={group} cx="50" cy="50" r={radius} fill="none" strokeWidth={thickness}
                            stroke={GROUP_PAINT[group].hatched ? `url(#${id}-${group})` : solid(group)}
                            strokeDasharray={`${Math.max(0.5, length - gap)} ${circumference}`} strokeDashoffset={-start}>
                            <title>{`${CHART_GROUP_LABEL[group]}: ${counts[group]}`}</title>
                        </circle>
                    );
                })}
            </svg>
            {children && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
        </div>
    );
}

/**
 * Two running totals as stepped lines; the band between them is what awaits a
 * verdict. Time runs in reading order (oldest at the start). Hovering or the
 * arrow keys pick a month, and the legend doubles as its readout.
 */
function TrendChart({ points }: { points: TrendPoint[] }) {
    const [picked, setPicked] = useState<number | null>(null);
    const last = points.length - 1;
    if (last < 0) return null;

    const active = Math.min(picked ?? last, last);
    const point = points[active];
    const max = Math.max(1, points[last].made);
    /** Percent along the inline axis, and up the block axis. */
    const along = (i: number) => (last === 0 ? 50 : (i / last) * 100);
    const up = (value: number) => (value / max) * 100;
    // The SVG is stretched to the box, so x is mirrored here for RTL.
    const x = (i: number) => 100 - along(i);
    const y = (value: number) => 100 - up(value);
    // A single month has no run to step through, so its totals span the plot.
    const steps = (key: 'made' | 'settled') => (last === 0
        ? `M100,${y(point[key])}H0`
        : points.map((p, i) => (i === 0 ? `M100,${y(p[key])}` : `H${x(i)}V${y(p[key])}`)).join(''));
    const area = (key: 'made' | 'settled') => `${steps(key)}V100H100Z`;

    function pick(event: PointerEvent<HTMLDivElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const fraction = (box.right - event.clientX) / box.width;
        setPicked(Math.max(0, Math.min(last, Math.round(fraction * last))));
    }

    function step(event: KeyboardEvent<HTMLDivElement>) {
        const move = { ArrowLeft: 1, ArrowRight: -1, Home: -last, End: last }[event.key];
        if (move === undefined) return;
        event.preventDefault();
        setPicked(Math.max(0, Math.min(last, active + move)));
    }

    const series = [
        { label: 'أُطلقت', value: point.made, style: { backgroundColor: 'hsl(var(--foreground) / 0.7)' } },
        { label: 'حُسمت', value: point.settled, style: { backgroundColor: 'hsl(var(--primary))' } },
        { label: 'بانتظار الحسم', value: point.made - point.settled, style: { backgroundColor: 'hsl(var(--foreground) / 0.12)' } },
    ];

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-live="polite">
                <span className="font-medium text-foreground">{picked === null ? 'حتى اليوم' : `حتى نهاية ${monthLabel(point)}`}</span>
                {series.map((item) => (
                    <span key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={item.style} />
                        {item.label}
                        <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <div className="flex h-44 flex-col justify-between text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
                    <span className="-translate-y-1/2">{max}</span>
                    <span className="translate-y-1/2">0</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div role="group" tabIndex={0} aria-label="اختر شهراً بالسهمين لقراءة أرقامه"
                        className="relative h-44 cursor-crosshair touch-pan-y rounded-sm border-y border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setPicked(null)} onKeyDown={step} onBlur={() => setPicked(null)}>
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                            <path d={area('made')} fill="hsl(var(--foreground) / 0.08)" />
                            <path d={area('settled')} fill="hsl(var(--primary) / 0.25)" />
                            <path d={steps('made')} fill="none" stroke="hsl(var(--foreground) / 0.7)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                            <path d={steps('settled')} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ insetInlineStart: `${along(active)}%` }} />
                        {(['made', 'settled'] as const).map((key) => (
                            <span key={key} aria-hidden="true"
                                className="absolute h-2.5 w-2.5 translate-x-1/2 translate-y-1/2 rounded-full border-2 border-card"
                                style={{
                                    insetInlineStart: `${along(active)}%`, bottom: `${up(point[key])}%`,
                                    backgroundColor: key === 'made' ? 'hsl(var(--foreground))' : 'hsl(var(--primary))',
                                }} />
                        ))}
                    </div>
                    <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
                        {/* A tick per January; a run too short to reach one names its first month. */}
                        {points.some((p) => p.month === 1)
                            ? points.map((p, i) => p.month === 1 && (
                                <span key={p.key} className={cn('absolute', i > 0 && i < last && 'translate-x-1/2', i === last && 'translate-x-full')} style={{ insetInlineStart: `${along(i)}%` }}>{p.year}</span>
                            ))
                            : <span className="absolute start-0 whitespace-nowrap">{monthLabel(points[0])}</span>}
                    </div>
                </div>
            </div>

            <table className="sr-only">
                <caption>الوعود التي أُطلقت والتي حُسمت حتى نهاية كل شهر</caption>
                <thead><tr><th scope="col">الشهر</th><th scope="col">أُطلقت</th><th scope="col">حُسمت</th></tr></thead>
                <tbody>
                    {points.map((p) => <tr key={p.key}><th scope="row">{monthLabel(p)}</th><td>{p.made}</td><td>{p.settled}</td></tr>)}
                </tbody>
            </table>
        </div>
    );
}

const ROW_GRID = 'grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]';

/**
 * One row per promise on a shared time axis: a track from the statement to the
 * deadline, a hatched overrun past it, and a dot at the verdict coloured by
 * its outcome. A rule marks today; deadlines beyond the window are named.
 */
function Lifelines({ chart, returnUrl }: { chart: LifelineChart; returnUrl: string }) {
    const [expanded, setExpanded] = useState(false);
    const { rows, from, to, today } = chart;
    const shown = expanded ? rows : rows.slice(0, LIFELINE_LIMIT);
    const at = (day: number) => Math.max(0, Math.min(100, ((day - from) / (to - from)) * 100));
    const years: Array<{ year: number; at: number }> = [];
    for (let year = new Date(from * 86_400_000).getUTCFullYear() + 1; ; year += 1) {
        const day = dayNumber(`${year}-01-01`)!;
        if (day > to) break;
        years.push({ year, at: at(day) });
    }
    const query = returnUrl === '/promises' ? '' : `?from=${encodeURIComponent(returnUrl)}`;

    return (
        <div>
            <div className={cn(ROW_GRID, 'mb-1')} aria-hidden="true">
                <span />
                <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground">
                    {years.map((tick) => <span key={tick.year} className="absolute translate-x-1/2" style={{ insetInlineStart: `${tick.at}%` }}>{tick.year}</span>)}
                </div>
            </div>
            <ol>
                {shown.map((row) => (
                    <li key={row.number} className={cn(ROW_GRID, 'rounded-md hover:bg-muted/40')}>
                        <Link href={`/promises/${row.number}${query}`} title={row.title}
                            className="truncate rounded-md py-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {row.title}
                        </Link>
                        <LifelineTrack row={row} at={at} to={to} today={today} years={years} />
                    </li>
                ))}
            </ol>
            {today !== null && (
                <div className={ROW_GRID} aria-hidden="true">
                    <span />
                    <div className="relative h-5 text-[11px] font-medium text-foreground">
                        <span className="absolute top-1 translate-x-1/2" style={{ insetInlineStart: `${at(today)}%` }}>اليوم</span>
                    </div>
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-hidden="true">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-6 rounded-full bg-muted-foreground/30" />من الإطلاق إلى الموعد</span>
                <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-muted-foreground/50" />بلا موعد محدد</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-6 rounded-full" style={stripes('--destructive')} />ما بعد الموعد</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-foreground/70" />الموعد</span>
                {(['fulfilled', 'partial', 'broken', 'other'] as const).map((group) => (
                    <span key={group} className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full" style={fill(group)} />
                        {CHART_GROUP_LABEL[group]}
                    </span>
                ))}
            </div>
            {rows.length > LIFELINE_LIMIT && (
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={MORE}>
                    {expanded ? 'عرض أقل' : `عرض الكل (${rows.length})`}
                </button>
            )}
        </div>
    );
}

function LifelineTrack({ row, at, to, today, years }: {
    row: Lifeline;
    at: (day: number) => number;
    to: number;
    today: number | null;
    years: Array<{ year: number; at: number }>;
}) {
    const { made, deadline, resolved, group } = row;
    // Where the story currently ends: the verdict, or today for an open promise.
    const reached = resolved ?? today ?? made;
    const overrun = deadline !== null && reached > deadline && (resolved !== null || group === 'overdue');
    const beyond = deadline !== null && deadline > to;
    const span = (start: number, end: number): CSSProperties => ({ insetInlineStart: `${at(start)}%`, width: `${Math.max(0, at(end) - at(start))}%` });
    const summary = [
        `أُطلق في ${formatDate(isoDay(made))}`,
        deadline !== null ? `الموعد ${formatDate(isoDay(deadline))}` : 'بلا موعد محدد',
        resolved !== null ? `${CHART_GROUP_LABEL[group]} في ${formatDate(isoDay(resolved))}` : CHART_GROUP_LABEL[group],
    ].join('، ');

    return (
        <div className="relative h-8" title={summary}>
            <span className="sr-only">{summary}</span>
            {years.map((tick) => <span key={tick.year} aria-hidden="true" className="absolute inset-y-0 w-px bg-border/60" style={{ insetInlineStart: `${tick.at}%` }} />)}
            {today !== null && <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/50" style={{ insetInlineStart: `${at(today)}%` }} />}
            {deadline !== null
                ? <span aria-hidden="true" className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/30" style={span(made, deadline)} />
                : <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/50" style={span(made, reached)} />}
            {overrun && <span aria-hidden="true" className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ ...span(deadline, reached), ...stripes('--destructive') }} />}
            <span aria-hidden="true" className="absolute top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-muted-foreground" style={{ insetInlineStart: `${at(made)}%` }} />
            {deadline !== null && !beyond && (
                <span aria-hidden="true" className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 translate-x-1/2 bg-foreground/70" style={{ insetInlineStart: `${at(deadline)}%` }} />
            )}
            {beyond && (
                <span aria-hidden="true" className="absolute end-0 top-1/2 -translate-y-1/2 bg-card ps-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {`حتى ${new Date(deadline * 86_400_000).getUTCFullYear()}`}
                </span>
            )}
            {resolved !== null && (
                <span aria-hidden="true" className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full ring-2 ring-card"
                    style={{ insetInlineStart: `${at(resolved)}%`, ...fill(group) }} />
            )}
        </div>
    );
}

/** One bar split by state group; segment widths are proportional to counts. */
function StackedBar({ counts }: { counts: GroupCounts }) {
    return (
        <div role="img" aria-label={describeCounts(counts)} className="flex h-full w-full gap-0.5 overflow-hidden rounded-sm">
            {CHART_GROUPS.filter((group) => counts[group] > 0).map((group) => (
                <div key={group} title={`${CHART_GROUP_LABEL[group]}: ${counts[group]}`}
                    className="min-w-1" style={{ flex: `${counts[group]} 1 0%`, ...fill(group) }} />
            ))}
        </div>
    );
}

function SectorBars({ rows, onSelect }: { rows: BreakdownRow[]; onSelect: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const max = rows[0]?.total ?? 0;
    const shown = expanded ? rows : rows.slice(0, ROW_LIMIT);

    return (
        <>
            <ul className="space-y-1">
                {shown.map((row) => (
                    <li key={row.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem]">
                        <button type="button" onClick={() => onSelect(row.id)} title={row.label}
                            aria-label={`${row.label}: ${row.total}، تصفية الوعود بها`}
                            className={cn(BUTTON, '-mx-1.5 block max-w-full truncate px-1.5 py-1 text-start text-sm text-muted-foreground hover:text-foreground')}>
                            {row.label}
                        </button>
                        <div className="h-3">
                            <div className="h-full" style={{ width: `${(row.total / max) * 100}%` }}><StackedBar counts={row.counts} /></div>
                        </div>
                        <span className="text-end text-sm font-semibold tabular-nums text-foreground">{row.total}</span>
                    </li>
                ))}
            </ul>
            {rows.length > ROW_LIMIT && (
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={MORE}>
                    {expanded ? 'عرض أقل' : `عرض الكل (${rows.length})`}
                </button>
            )}
        </>
    );
}

/** Each official's portrait inside a ring of how their promises stand. */
function SpeakerRings({ rows, canSelect, onSelect }: { rows: BreakdownRow[]; canSelect: (id: string) => boolean; onSelect: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? rows : rows.slice(0, SPEAKER_LIMIT);

    return (
        <>
            <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
                {shown.map((row) => {
                    const ring = (
                        <>
                            <Donut counts={row.counts} size={68} thickness={9} label="">
                                <SpeakerAvatar name={row.label} image={row.image ?? null} size={48} className="border-0" />
                            </Donut>
                            <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{row.label}</span>
                            <span className="text-sm font-semibold leading-none tabular-nums text-foreground">{row.total}</span>
                        </>
                    );
                    const layout = 'flex w-full flex-col items-center gap-1.5 p-1.5 text-center';
                    return (
                        <li key={row.id} className="min-w-0" title={`${row.label}: ${describeCounts(row.counts)}`}>
                            {canSelect(row.id) ? (
                                <button type="button" onClick={() => onSelect(row.id)}
                                    aria-label={`${row.label}: ${row.total}، ${describeCounts(row.counts)}، تصفية الوعود به`}
                                    className={cn(BUTTON, layout)}>
                                    {ring}
                                </button>
                            ) : (
                                <div className={layout}>{ring}<span className="sr-only">{describeCounts(row.counts)}</span></div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {rows.length > SPEAKER_LIMIT && (
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={MORE}>
                    {expanded ? 'عرض أقل' : `عرض الكل (${rows.length})`}
                </button>
            )}
        </>
    );
}
