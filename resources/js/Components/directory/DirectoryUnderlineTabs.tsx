import type { ReactNode } from 'react';
import { Node } from '@/Components/brand/Node';
import { cn } from '@/Lib/utils';
import type { DirectoryFacetOption } from './useDirectory';

interface DirectoryUnderlineTabsProps {
    label: string;
    options: readonly DirectoryFacetOption[];
    value: readonly string[];
    onChange: (next: string[]) => void;
    allLabel?: string;
    allCount?: number;
    /** Optional inline trailing control (such as a compact search input) sharing the same baseline. */
    trailing?: ReactNode;
    className?: string;
}

/**
 * Connected underline tab bar for directories with a small set of categories (3–6).
 * Active tab carries a 2px primary rule and the saffron Node; no bordered pill clusters.
 */
export function DirectoryUnderlineTabs({
    label,
    options,
    value,
    onChange,
    allLabel = 'الكل',
    allCount,
    trailing,
    className,
}: DirectoryUnderlineTabsProps) {
    const isAll = value.length === 0;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div
                role="group"
                aria-label={label}
                className="flex items-center gap-5 overflow-x-auto no-scrollbar"
            >
                <button
                    type="button"
                    aria-pressed={isAll}
                    onClick={() => onChange([])}
                    className={cn(
                        'relative inline-flex shrink-0 items-center gap-1.5 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isAll ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {isAll && <Node size="xs" />}
                    <span>{allLabel}</span>
                    {allCount !== undefined && (
                        <span className="text-xs font-normal tabular-nums text-muted-foreground">
                            {allCount}
                        </span>
                    )}
                    {isAll && (
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                        />
                    )}
                </button>

                {options.map((option) => {
                    const active = value.includes(option.value);
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(active ? [] : [option.value])}
                            className={cn(
                                'relative inline-flex shrink-0 items-center gap-1.5 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {active && <Node size="xs" />}
                            <span>{option.label}</span>
                            {active && (
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {trailing && <div className="pb-2 sm:w-64 sm:shrink-0">{trailing}</div>}
        </div>
    );
}
