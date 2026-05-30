"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";

type Series = {
    name: string;
    values: number[];
    color?: string;
    imageUrl?: string;
};

type Props = {
    months: string[]; // e.g., ["2024-06", "2024-07", ...]
    series: Series[];
    height?: number;
};

function hashToColor(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const sat = 65;
    const light = 48;
    return `hsl(${hue} ${sat}% ${light}%)`;
}

function hashString(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
}

export default function MonthlyLineChart({ months, series, height = 260 }: Props) {
    const padding = { top: 16, right: 16, bottom: 36, left: 40 };
    const [containerRef, setContainerRef] = React.useState<HTMLDivElement | null>(null);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    const width = containerRef?.clientWidth || 800;
    const innerWidth = Math.max(10, width - padding.left - padding.right);
    const innerHeight = Math.max(10, height - padding.top - padding.bottom);

    const maxY = React.useMemo(() => {
        let m = 0;
        for (const s of series) {
            for (const v of s.values) m = Math.max(m, v || 0);
        }
        return m || 1;
    }, [series]);

    function xFor(idx: number): number {
        if (months.length <= 1) return padding.left + innerWidth / 2;
        const t = idx / (months.length - 1);
        return padding.left + t * innerWidth;
    }
    function yFor(value: number): number {
        const t = maxY === 0 ? 0 : value / maxY;
        const y = padding.top + (1 - t) * innerHeight;
        return y;
    }

    const yTicks = React.useMemo(() => {
        const ticks = 4;
        const arr: number[] = [];
        for (let i = 0; i <= ticks; i++) arr.push(Math.round((maxY * i) / ticks));
        return arr;
    }, [maxY]);

    function toggleSelect(name: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    const visibleSeries = selected.size ? series.filter((s) => selected.has(s.name)) : series;

    const firstDataIndex = React.useMemo(() => {
        let earliest = months.length;
        for (const s of series) {
            const idx = s.values.findIndex((v) => (v || 0) > 0);
            if (idx !== -1) earliest = Math.min(earliest, idx);
        }
        return earliest === months.length ? 0 : earliest;
    }, [series, months]);

    return (
        <Card className="max-w-screen-md mx-auto">
            <div ref={setContainerRef} className="p-4">
                <div className="text-sm font-medium mb-2">تطوّر النقاط الشهري</div>
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    {/* Axes */}
                    <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke={isDark ? "#27272a" : "#e5e7eb"} />
                    <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke={isDark ? "#27272a" : "#e5e7eb"} />

                    {/* Y grid and ticks */}
                    {yTicks.map((t, i) => {
                        const y = yFor(t);
                        return (
                            <g key={`y-${t}-${i}`}>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={isDark ? "#1f2937" : "#f3f4f6"} />
                                <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={isDark ? "#9ca3af" : "#6b7280"}>
                                    {t}
                                </text>
                            </g>
                        );
                    })}

                    {/* X labels */}
                    {months.map((m, i) => (
                        <text key={`x-${m}`} x={xFor(i)} y={height - padding.bottom + 16} textAnchor="middle" fontSize={10} fill={isDark ? "#9ca3af" : "#6b7280"}>
                            {m}
                        </text>
                    ))}

                    {/* Lines: draw lower-ranked first so top-ranked render on top */}
                    {[...visibleSeries].reverse().map((s) => {
                        const color = s.color || hashToColor(s.name);
                        const points = s.values.map((v, i) => [xFor(i), yFor(v || 0)] as const);
                        const path = points.length
                            ? `M${points[0][0]},${points[0][1]} ${points.slice(1).map(([x, y]) => `L${x},${y}`).join(" ")}`
                            : "";
                        return (
                            <g key={`s-${s.name}`}>
                                <path d={path} fill="none" stroke={color} strokeWidth={2.5} />
                                {s.values.map((v, i) => {
                                    const cx = xFor(i);
                                    const cy = yFor(v || 0);
                                    const r = 9;
                                    const clipId = `clip-${hashString(s.name)}-${i}`;
                                    const allowAvatar = i >= firstDataIndex;
                                    return (
                                        <g key={`pt-${s.name}-${i}`}>
                                            {s.imageUrl && allowAvatar ? (
                                                <>
                                                    <clipPath id={clipId}>
                                                        <circle cx={cx} cy={cy} r={r} />
                                                    </clipPath>
                                                    <image
                                                        href={s.imageUrl}
                                                        xlinkHref={s.imageUrl as any}
                                                        x={cx - r}
                                                        y={cy - r}
                                                        width={r * 2}
                                                        height={r * 2}
                                                        preserveAspectRatio="xMidYMid slice"
                                                        clipPath={`url(#${clipId})`}
                                                    />
                                                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.75} />
                                                </>
                                            ) : (
                                                <circle cx={cx} cy={cy} r={3} fill={color} />
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>

                {/* Legend */}
                <div className="mt-3 max-h-40 overflow-auto pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {series.map((s) => {
                            const color = s.color || hashToColor(s.name);
                            return (
                                <button
                                    type="button"
                                    key={`lg-${s.name}`}
                                    onClick={() => toggleSelect(s.name)}
                                    className={`flex items-center gap-2 text-left ${selected.size && !selected.has(s.name) ? "opacity-50" : "opacity-100"}`}
                                >
                                    <span className="inline-block h-2 w-6 rounded" style={{ backgroundColor: color }} />
                                    <span className="text-gray-700 dark:text-gray-300 underline-offset-2 hover:underline">{s.name}</span>
                                </button>
                            );
                        })}
                    </div>
                    {selected.size ? (
                        <div className="mt-2">
                            <button
                                type="button"
                                className="text-xs text-gray-600 dark:text-gray-300 underline underline-offset-2 hover:opacity-80"
                                onClick={() => setSelected(new Set())}
                            >
                                مسح التحديد
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}
