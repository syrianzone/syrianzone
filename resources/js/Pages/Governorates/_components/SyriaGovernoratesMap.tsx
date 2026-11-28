import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import type { SvgMapData } from '../_types';

interface SyriaGovernoratesMapProps {
    svgMap: SvgMapData;
    populationById?: Record<string, number | undefined>;
}

/**
 * Server-rendered interactive SVG map of Syria's 14 governorates.
 * Every governorate is a real `<a href="/governorates/{id}">` link so crawlers,
 * keyboard users and no-JS browsers can navigate directly. Always paired with
 * the accessible card grid below so the map is never the only way to navigate.
 */
export function SyriaGovernoratesMap({ svgMap, populationById = {} }: SyriaGovernoratesMapProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    if (!svgMap.shapes.length) {
        return null;
    }

    const activeId = focusedId ?? hoveredId;
    const activeShape = activeId ? svgMap.shapes.find((s) => s.id === activeId) ?? null : null;
    const activePop = activeShape ? populationById[activeShape.id] : undefined;

    return (
        <div
            role="region"
            aria-label="خريطة محافظات سوريا التفاعلية"
            className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6"
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-base font-bold text-foreground sm:text-lg">خريطة محافظات سوريا</h2>
                    <p className="text-xs text-muted-foreground">
                        اختر أي محافظة على الخريطة أو من القائمة أدناه لاستعراض تفاصيلها وخدماتها.
                    </p>
                </div>
                <div
                    role="status"
                    aria-live="polite"
                    className="min-h-7 rounded-lg border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
                >
                    {activeShape ? (
                        <span>
                            محافظة {activeShape.name_ar}
                            {activePop ? (
                                <span className="ms-2 text-muted-foreground">
                                    (<span dir="ltr" className="tabular-nums">{activePop.toLocaleString('en-US')}</span> نسمة)
                                </span>
                            ) : null}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">14 محافظة سورية</span>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-2xl">
                <svg
                    viewBox={svgMap.viewBox}
                    className="h-auto w-full select-none"
                    aria-label="خريطة المحافظات السورية الأربع عشرة"
                >
                    {svgMap.shapes.map((shape) => {
                        const isHovered = hoveredId === shape.id;
                        const isFocused = focusedId === shape.id;
                        const href = `/governorates/${shape.id}`;
                        return (
                            <a
                                key={shape.id}
                                href={href}
                                aria-label={`محافظة ${shape.name_ar}`}
                                onMouseEnter={() => setHoveredId(shape.id)}
                                onMouseLeave={() => setHoveredId((prev) => (prev === shape.id ? null : prev))}
                                onFocus={() => setFocusedId(shape.id)}
                                onBlur={() => setFocusedId((prev) => (prev === shape.id ? null : prev))}
                                onClick={(e) => {
                                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                                    e.preventDefault();
                                    router.visit(href);
                                }}
                                className="group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                            >
                                <path
                                    d={shape.path}
                                    className={
                                        isFocused
                                            ? 'fill-primary/40 stroke-foreground transition-colors'
                                            : isHovered
                                                ? 'fill-primary/35 stroke-primary transition-colors'
                                                : 'fill-primary/15 stroke-border transition-colors group-hover:fill-primary/35 group-hover:stroke-primary group-focus-visible:fill-primary/40 group-focus-visible:stroke-foreground'
                                    }
                                    strokeWidth={isFocused ? 3 : isHovered ? 2 : 1.25}
                                    strokeLinejoin="round"
                                />
                                {shape.id !== 'damascus' && shape.id !== 'quneitra' && (
                                    <text
                                        x={shape.label_x}
                                        y={shape.label_y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        aria-hidden="true"
                                        className="pointer-events-none fill-foreground text-[11px] font-semibold"
                                    >
                                        {shape.name_ar}
                                    </text>
                                )}
                            </a>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
