import { FilterChip } from '@/Components/ui/filter-chip';
import { cn } from '@/Lib/utils';
import type { DirectoryFacetOption } from './useDirectory';

interface Props {
    /** Names the chip row for screen readers («التصنيف», «النوع»…). */
    label: string;
    options: readonly DirectoryFacetOption[];
    value: readonly string[];
    onChange: (value: string[]) => void;
    /** «الكل» — the language may differ from the rest of the page. */
    allLabel?: string;
    multiple?: boolean;
    /** Single-line horizontal scroll row instead of wrapping into multiple tall rows. */
    scrollable?: boolean;
    className?: string;
}

const CHIP_CLASS = 'h-8 shrink-0 cursor-pointer rounded-full px-3 text-xs font-semibold sm:text-sm';

/**
 * One facet as a start-aligned row of chips.
 * Single-select replaces the chosen value and clicking again clears it; multi-select toggles.
 */
export default function DirectoryFilterChips({
    label,
    options,
    value,
    onChange,
    allLabel = 'الكل',
    multiple = false,
    scrollable = false,
    className,
}: Props) {
    const toggle = (option: string) => {
        if (!multiple) {
            onChange(value.includes(option) ? [] : [option]);
            return;
        }
        onChange(value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option]);
    };

    return (
        <div
            role="group"
            aria-label={label}
            className={cn(
                'flex justify-start gap-2',
                scrollable ? 'flex-nowrap overflow-x-auto no-scrollbar pb-0.5' : 'flex-wrap',
                className,
            )}
        >
            <FilterChip
                active={value.length === 0}
                onClick={() => onChange([])}
                className={CHIP_CLASS}
            >
                {allLabel}
            </FilterChip>
            {options.map((option) => (
                <FilterChip
                    key={option.value}
                    active={value.includes(option.value)}
                    onClick={() => toggle(option.value)}
                    className={CHIP_CLASS}
                >
                    {option.label}
                </FilterChip>
            ))}
        </div>
    );
}
