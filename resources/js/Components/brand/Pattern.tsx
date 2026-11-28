import { useId } from 'react';
import { cn } from '@/Lib/utils';

export type PatternVariant = 'orbit' | 'nodes' | 'arcs' | 'bowls' | 'dots' | 'tracks';

/**
 * Lightweight inline-SVG brand texture from the «المدار» mark.
 * Lines follow --sz-orbit; nodes follow --sz-node. Keep opacity subtle (0.04–0.08).
 * Use at most once per page, inside PageHeader or a feature band.
 */
export function Pattern({
    variant = 'dots',
    opacity = 0.06,
    className,
}: {
    variant?: PatternVariant;
    opacity?: number;
    className?: string;
}) {
    const id = useId();
    const patId = `sz-pat-${variant}-${id.replace(/:/g, '')}`;

    return (
        <svg
            aria-hidden="true"
            focusable="false"
            className={cn('pointer-events-none absolute inset-0 h-full w-full select-none', className)}
            style={{ opacity }}
        >
            <defs>
                {variant === 'orbit' && (
                    <pattern id={patId} width="120" height="120" patternUnits="userSpaceOnUse">
                        <g fill="none" stroke="hsl(var(--sz-orbit))" strokeWidth="1.4" strokeLinecap="round">
                            <path d="M 60 40 A 20 20 0 0 1 80 60" />
                            <path d="M 80 60 A 20 20 0 0 1 60 80" />
                            <path d="M 40 60 A 20 20 0 0 1 60 40" />
                            <path d="M 50 60 A 10 10 0 0 0 70 60" />
                        </g>
                        <g fill="hsl(var(--sz-node))">
                            <rect x="57.5" y="37.5" width="5" height="5" rx="1.4" />
                            <rect x="77.5" y="57.5" width="5" height="5" rx="1.4" />
                            <rect x="57.5" y="77.5" width="5" height="5" rx="1.4" />
                        </g>
                    </pattern>
                )}
                {variant === 'dots' && (
                    <pattern id={patId} width="44" height="44" patternUnits="userSpaceOnUse">
                        <rect x="20" y="20" width="3.5" height="3.5" rx="1" fill="hsl(var(--sz-orbit))" />
                        <rect x="42" y="2" width="3" height="3" rx="0.9" fill="hsl(var(--sz-node))" />
                    </pattern>
                )}
                {variant === 'nodes' && (
                    <pattern id={patId} width="80" height="80" patternUnits="userSpaceOnUse">
                        <path
                            d="M 0 40 H 80 M 40 0 V 80"
                            fill="none"
                            stroke="hsl(var(--sz-orbit))"
                            strokeWidth="0.9"
                            strokeDasharray="3 5"
                        />
                        <rect x="37" y="37" width="6" height="6" rx="1.7" fill="hsl(var(--sz-node))" />
                    </pattern>
                )}
                {variant === 'arcs' && (
                    <pattern id={patId} width="96" height="96" patternUnits="userSpaceOnUse">
                        <path
                            d="M 0 48 A 48 48 0 0 1 48 0 M 48 96 A 48 48 0 0 1 96 48"
                            fill="none"
                            stroke="hsl(var(--sz-orbit))"
                            strokeWidth="1.2"
                        />
                        <rect x="45.5" y="45.5" width="5" height="5" rx="1.4" fill="hsl(var(--sz-node))" />
                    </pattern>
                )}
                {variant === 'bowls' && (
                    <pattern id={patId} width="84" height="60" patternUnits="userSpaceOnUse">
                        <path
                            d="M 22 24 A 20 20 0 0 0 62 24"
                            fill="none"
                            stroke="hsl(var(--sz-orbit))"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                        />
                        <rect x="39.5" y="42" width="5" height="5" rx="1.4" fill="hsl(var(--sz-node))" />
                    </pattern>
                )}
                {variant === 'tracks' && (
                    <pattern id={patId} width="72" height="56" patternUnits="userSpaceOnUse">
                        <path d="M 0 28 H 72" fill="none" stroke="hsl(var(--sz-orbit))" strokeWidth="1" />
                        <rect x="14" y="25.5" width="5" height="5" rx="1.4" fill="hsl(var(--sz-node))" />
                        <circle cx="52" cy="28" r="2.2" fill="hsl(var(--sz-orbit))" />
                    </pattern>
                )}
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patId})`} />
        </svg>
    );
}

/**
 * «الحلقات»: architectural broken-orbit rings anchored to the end corner of editorial headers.
 */
export function Rings({
    opacity = 0.09,
    className,
}: {
    opacity?: number;
    className?: string;
}) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 360 240"
            className={cn(
                'pointer-events-none absolute -top-10 end-0 h-[240px] w-[360px] select-none',
                className,
            )}
            style={{ opacity }}
        >
            <g fill="none" stroke="hsl(var(--sz-orbit))" strokeLinecap="round">
                <path d="M 180 28 A 92 92 0 0 1 272 120" strokeWidth="2.5" />
                <path d="M 272 120 A 92 92 0 0 1 180 212" strokeWidth="2.5" />
                <path d="M 88 120 A 92 92 0 0 1 180 28" strokeWidth="2.5" />
                <path d="M 132 120 A 48 48 0 0 0 228 120" strokeWidth="2.5" />
                <circle cx="180" cy="120" r="136" strokeWidth="1.2" strokeDasharray="6 10" />
            </g>
            <g fill="hsl(var(--sz-node))">
                <rect x="172" y="20" width="16" height="16" rx="4.5" />
                <rect x="264" y="112" width="16" height="16" rx="4.5" />
                <rect x="172" y="204" width="16" height="16" rx="4.5" />
            </g>
        </svg>
    );
}
